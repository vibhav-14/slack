"""Document processing: turn an uploaded file into subjects, topics, evidence,
quiz questions, lab courses and timetable slots.

Re-processing a source first deletes everything it produced, so retries and
re-uploads are idempotent.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import models as m
from ..config import CLAUDE_ENABLED, DEFAULT_EXAM_DATE
from ..db import SessionLocal
from ..extract import pdf as pdfx
from ..extract.slides import LectureDeck, deck_text, parse_deck
from ..extract.timetable import parse_timetable, subject_key

log = logging.getLogger(__name__)

SMALL = {"of", "and", "for", "in", "the", "to", "a", "an", "with"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".heic", ".webp"}


class IngestError(Exception):
    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


# ----------------------------------------------------------------- helpers


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70]


def abbreviation(name: str) -> str:
    """"Object Oriented Programming" -> "OOP", "Industry Readiness Programme-I" -> "IRP-I"."""
    suffix = ""
    if m_ := re.search(r"[-\s]+(I{1,3}|IV|V)$", name):
        suffix = f"-{m_.group(1)}"
        name = name[: m_.start()]
    words = [w for w in re.split(r"[\s\-]+", name) if w and w.lower() not in SMALL]
    return ("".join(w[0].upper() for w in words) or name[:4].upper()) + suffix


def _title(name: str) -> str:
    words = name.split()
    return " ".join(w if w.isupper() or i and w.lower() in SMALL else w[0].upper() + w[1:] for i, w in enumerate(words)).replace(
        "Iot", "IoT"
    )


def find_subject(db: Session, name: str) -> m.Subject | None:
    key = subject_key(name)
    for s in db.scalars(select(m.Subject)).all():
        if subject_key(s.name) == key:
            return s
    return None


def find_or_create_subject(db: Session, name: str, code: str | None = None, faculty: str | None = None) -> m.Subject:
    name = _title(name.strip())
    s = find_subject(db, name)
    if not s:
        s = m.Subject(
            id=slugify(subject_key(name)),
            name=name,
            code=code or abbreviation(name),
            official_code=bool(code),
            faculty=faculty,
            exam_date=date.fromisoformat(DEFAULT_EXAM_DATE),
            exam_date_confirmed=False,
        )
        db.add(s)
        db.flush()
    else:
        if code and not s.official_code:
            s.code, s.official_code = code, True
        if faculty and not s.faculty:
            s.faculty = faculty
    return s


def _reset_source_outputs(db: Session, source_id: str) -> None:
    db.execute(delete(m.Evidence).where(m.Evidence.source_id == source_id))
    db.execute(delete(m.Question).where(m.Question.source_id == source_id))


# ------------------------------------------------------------------ dispatch


def process_source(source_id: str) -> None:
    """Background task entry point. Owns its own DB session."""
    db = SessionLocal()
    try:
        src = db.get(m.Source, source_id)
        if not src:
            return
        src.status, src.error = "processing", None
        db.commit()
        try:
            deck = _process(db, src)
            src.status = "ready"
            db.commit()
        except IngestError as e:
            db.rollback()
            src = db.get(m.Source, source_id)
            src.status, src.error, src.retryable = "failed", str(e), e.retryable
            db.commit()
            return
        except Exception:  # noqa: BLE001 - report any parser crash as a failed source
            log.exception("Processing %s failed", source_id)
            db.rollback()
            src = db.get(m.Source, source_id)
            src.status, src.error, src.retryable = "failed", "Something went wrong reading this file. Try again, or re-export it.", True
            db.commit()
            return
        if deck is not None and CLAUDE_ENABLED:
            add_claude_questions(db, src, deck)
    finally:
        db.close()


def _process(db: Session, src: m.Source) -> LectureDeck | None:
    path = src.file
    ext = path.suffix.lower()
    if ext in IMAGE_EXT:
        raise IngestError("Photos and scans need text recognition, which isn't set up yet. Upload a PDF with selectable text, or the original slides.", retryable=False)
    if src.kind == "timetable":
        if ext != ".pdf":
            raise IngestError("Timetables must be the PDF export from aSc Timetables.", retryable=False)
        ingest_timetable(db, src)
        return None
    if ext == ".pptx":
        deck = parse_deck(path)
        ingest_deck(db, src, deck)
        return deck
    if ext == ".pdf":
        text = pdfx.read_pdf(path)
        src.pages = text.pages
        if not text.has_text:
            raise IngestError("This PDF has no selectable text (it's probably a scan). Upload a text PDF or the original document.", retryable=False)
        if src.kind == "syllabus":
            ingest_syllabus(db, src, text.text)
        elif src.kind == "past_paper":
            ingest_paper(db, src, text.text)
        else:
            ingest_notes(db, src, pdfx.paragraphs(text.text))
        return None
    if ext == ".txt":
        ingest_notes(db, src, pdfx.paragraphs(path.read_text(encoding="utf-8", errors="replace")))
        return None
    raise IngestError("This file type isn't supported. Upload PDF, PPTX or TXT.", retryable=False)


# ------------------------------------------------------------------- slides


def ingest_deck(db: Session, src: m.Source, deck: LectureDeck) -> None:
    src.pages = len(deck.slides)
    if not deck.course_name and not src.subject_id:
        raise IngestError("Couldn't tell which course these slides belong to. Pick a subject and try again.")
    subject = db.get(m.Subject, src.subject_id) if src.subject_id else None
    if subject is None:
        subject = find_or_create_subject(db, deck.course_name, deck.course_code)
    elif deck.course_code and not subject.official_code:
        subject.code, subject.official_code = deck.course_code, True
    src.subject_id = subject.id

    profile = db.get(m.Profile, 1)
    if profile and deck.institution and not profile.institution:
        profile.institution = deck.institution
    if profile and deck.program_line and not profile.program:
        profile.program = deck.program_line.split("|")[0].strip()

    unit_no = deck.unit_number or 1
    unit_id = f"{subject.id}-u{unit_no}"
    unit = db.get(m.Unit, unit_id) or m.Unit(id=unit_id, subject_id=subject.id, number=unit_no, title=None, hours=None)
    db.add(unit)
    db.flush()  # no ORM relationship orders Unit before Topic, so insert it explicitly

    title = deck.session_title or Path(src.filename).stem
    topic_id = f"{unit_id}-s{deck.session_number}" if deck.session_number else f"{unit_id}-{slugify(title)}"
    topic = db.get(m.Topic, topic_id)
    if topic is None:
        topic = m.Topic(id=topic_id, subject_id=subject.id, unit_id=unit_id, status="not_started", position=deck.session_number or 999)
        db.add(topic)
    topic.title = title
    topic.concepts = deck.agenda or [title]
    topic.session_number = deck.session_number
    topic.course_outcome = deck.course_outcome
    topic.bloom = deck.bloom
    db.flush()

    _reset_source_outputs(db, src.id)
    pos = 0

    def ev(kind: str, label: str, excerpt: str, level: str | None = None) -> None:
        nonlocal pos
        pos += 1
        db.add(m.Evidence(topic_id=topic.id, source_id=src.id, kind=kind, label=label, excerpt=excerpt, level=level, position=pos))

    bloom_k = deck.bloom.split(" ")[0] if deck.bloom else None
    for focus in deck.assessment_focus:
        ev("assessment", "What the assessment will ask", focus, bloom_k)
    for level, prompt in deck.practice_prompts:
        ev("assessment", f"Check your understanding · {level}", prompt, level)
    if deck.course_outcome:
        session = f"Session {deck.session_number} of Unit {unit_no}" if deck.session_number else f"Unit {unit_no}"
        ev("syllabus", f"Course outcome {deck.course_outcome}", f"{session} is mapped to {deck.course_outcome}, Bloom level {deck.bloom}.", bloom_k)
    for i, outcome in enumerate(deck.outcomes, 1):
        ev("slides", f"Learning outcome {i}", outcome)
    for myth, truth in deck.misconceptions:
        ev("slides", "Common misconception", f"Students often think “{myth.rstrip('.')}”. In fact: {truth}")

    for i, q in enumerate(deck.questions, 1):
        db.add(
            m.Question(
                id=f"{topic.id}-q{i}",
                topic_id=topic.id,
                source_id=src.id,
                concept=q.concept,
                prompt=q.prompt,
                options=q.options,
                answer_index=q.answer_index,
                explanation=q.explanation,
                origin="slides",
                slide_ref=f"Slide {q.slide}: {q.slide_title}",
            )
        )
    src.extracted = {
        "units": 1,
        "topics": 1,
        "questions": len(deck.questions),
        "evidence": pos,
        "summary": f"{subject.code} · Unit {unit_no}" + (f", Session {deck.session_number}" if deck.session_number else ""),
    }


def add_claude_questions(db: Session, src: m.Source, deck: LectureDeck) -> int:
    from .claude_gen import ClaudeUnavailable, generate_questions

    topic = db.scalars(select(m.Topic).join(m.Question, m.Question.topic_id == m.Topic.id).where(m.Question.source_id == src.id)).first()
    if topic is None:
        return 0
    existing = db.scalars(select(m.Question.prompt).where(m.Question.topic_id == topic.id)).all()
    try:
        generated = generate_questions(topic.title, deck_text(deck), topic.concepts, list(existing))
    except ClaudeUnavailable as e:
        src.extracted = {**(src.extracted or {}), "aiError": str(e)}
        db.commit()
        return 0
    start = len(db.scalars(select(m.Question.id).where(m.Question.topic_id == topic.id, m.Question.origin == "claude")).all())
    for i, q in enumerate(generated, start + 1):
        db.add(
            m.Question(
                id=f"{topic.id}-c{i}",
                topic_id=topic.id,
                source_id=src.id,
                concept=q["concept"],
                prompt=q["prompt"],
                options=q["options"],
                answer_index=q["answerIndex"],
                explanation=q["explanation"],
                origin="claude",
                slide_ref=f"Slide {q['slide']}",
            )
        )
    src.extracted = {**(src.extracted or {}), "aiQuestions": (src.extracted or {}).get("aiQuestions", 0) + len(generated)}
    db.commit()
    return len(generated)


# ---------------------------------------------------------------- timetable


def ingest_timetable(db: Session, src: m.Source) -> None:
    classes = parse_timetable(src.file)
    if not classes:
        raise IngestError("No class timetables found. Is this an aSc Timetables PDF export?", retryable=False)
    src.pages = len(classes)
    labels = [c.label for c in classes]
    profile = db.get(m.Profile, 1)
    wanted = " ".join((profile.class_label or "").split()).upper() if profile else ""
    tt = next((c for c in classes if " ".join(c.label.split()).upper() == wanted), None)
    if tt is None:
        src.extracted = {"classes": labels}
        raise IngestError("Pick your class in Settings, then retry. This file has timetables for " + ", ".join(labels) + ".")

    db.execute(delete(m.TimetableSlot))
    profile.periods = [{"number": p.number, "start": p.start, "end": p.end} for p in tt.periods]
    profile.semester = tt.semester
    if tt.effective_from:
        profile.timetable_effective_from = date.fromisoformat(tt.effective_from)

    lectures = [s for s in tt.slots if s.kind == "lecture" and not s.subject.lower().endswith(" lab")]
    for s in lectures:
        find_or_create_subject(db, s.subject, faculty=s.faculty)
    db.flush()

    labs = 0
    for s in tt.slots:
        subject = lab = None
        if s.kind == "lab" or s.subject.lower().endswith(" lab"):
            lab = _find_or_create_lab(db, s.subject, s.faculty)
            subject = find_subject(db, s.subject)
            labs += 1
        elif s.kind == "lecture":
            subject = find_subject(db, s.subject)
        db.add(
            m.TimetableSlot(
                day=s.day,
                periods=s.periods,
                title=_title(s.subject),
                kind="lab" if lab else s.kind,
                subject_id=subject.id if subject else None,
                lab_id=lab.id if lab else None,
                room=s.room,
                faculty=s.faculty,
                group=s.group,
            )
        )
    src.extracted = {
        "classes": labels,
        "selected": tt.label,
        "slots": len(tt.slots),
        "subjects": len({subject_key(s.subject) for s in lectures}),
        "summary": f"{tt.label} · {len(tt.slots)} weekly slots",
    }


def _find_or_create_lab(db: Session, name: str, faculty: str | None) -> m.LabCourse:
    name = _title(name)
    lab_id = slugify(name)
    lab = db.get(m.LabCourse, lab_id)
    if lab is None:
        subject = find_subject(db, name)
        lab = m.LabCourse(id=lab_id, code=abbreviation(re.sub(r"\s+lab$", "", name, flags=re.I)) + " Lab", name=name, subject_id=subject.id if subject else None, faculty=faculty)
        db.add(lab)
        db.flush()
    elif faculty and not lab.faculty:
        lab.faculty = faculty
    return lab


# ----------------------------------------------------------- syllabus / pdfs


def ingest_syllabus(db: Session, src: m.Source, text: str) -> None:
    syl = pdfx.parse_syllabus(text)
    if not syl.units:
        raise IngestError("Couldn't find units in this syllabus. Unit headings should look like “Unit 1: …” or “UNIT II”.")
    subject = db.get(m.Subject, src.subject_id) if src.subject_id else None
    if subject is None and syl.course_name:
        subject = find_or_create_subject(db, syl.course_name, syl.course_code)
    if subject is None:
        raise IngestError("Pick which subject this syllabus is for, then retry.")
    if syl.course_code and not subject.official_code:
        subject.code, subject.official_code = syl.course_code, True
    src.subject_id = subject.id
    _reset_source_outputs(db, src.id)

    n_topics = 0
    for u in syl.units:
        unit_id = f"{subject.id}-u{u.number}"
        unit = db.get(m.Unit, unit_id) or m.Unit(id=unit_id, subject_id=subject.id, number=u.number)
        unit.title, unit.hours = u.title, u.hours
        db.add(unit)
        db.flush()
        existing = {t.title.lower(): t for t in db.scalars(select(m.Topic).where(m.Topic.unit_id == unit_id)).all()}
        for i, title in enumerate(u.topics):
            t = existing.get(title.lower())
            if t is None:
                t = m.Topic(id=f"{unit_id}-{slugify(title)}", subject_id=subject.id, unit_id=unit_id, title=title, concepts=[title], position=100 + i)
                db.add(t)
                db.flush()
            n_topics += 1
            db.add(
                m.Evidence(
                    topic_id=t.id, source_id=src.id, kind="syllabus", label=f"Syllabus · Unit {u.number}",
                    excerpt=f"Unit {u.number}: {u.title}" + (f" ({u.hours:g} lecture hours)" if u.hours else "") + f". Listed: {title}.",
                )
            )
    src.extracted = {"units": len(syl.units), "topics": n_topics, "questions": 0, "summary": f"{subject.code} · {len(syl.units)} units"}


def _match_topics(db: Session, subject_id: str | None, text: str, min_shared: int = 2) -> list[m.Topic]:
    from ..extract.slides import _tokens

    words = _tokens(text)
    q = select(m.Topic)
    if subject_id:
        q = q.where(m.Topic.subject_id == subject_id)
    scored = []
    for t in db.scalars(q).all():
        shared = len(words & _tokens(" ".join([t.title, *t.concepts])))
        if shared >= min_shared:
            scored.append((shared, t))
    scored.sort(key=lambda x: -x[0])
    return [t for _, t in scored[:2]]


def ingest_paper(db: Session, src: m.Source, text: str) -> None:
    paper = pdfx.parse_paper(text, src.filename)
    if not paper.questions:
        raise IngestError("Couldn't find numbered questions in this paper.")
    _reset_source_outputs(db, src.id)
    matched = 0
    for q in paper.questions:
        for t in _match_topics(db, src.subject_id, q.text):
            matched += 1
            db.add(
                m.Evidence(
                    topic_id=t.id, source_id=src.id, kind="past_paper", label=f"{paper.session} · {q.number}",
                    excerpt=q.text, marks=q.marks, paper=paper.session,
                )
            )
    src.extracted = {"units": 0, "topics": 0, "questions": len(paper.questions), "matched": matched, "summary": paper.session}


def ingest_notes(db: Session, src: m.Source, paras: list[str]) -> None:
    _reset_source_outputs(db, src.id)
    topics: set[str] = set()
    for p in paras:
        for t in _match_topics(db, src.subject_id, p, min_shared=3)[:1]:
            topics.add(t.id)
            db.add(m.Evidence(topic_id=t.id, source_id=src.id, kind="notes", label=f"Your notes · {src.filename}", excerpt=p[:400]))
    src.extracted = {"units": 0, "topics": len(topics), "questions": 0}
