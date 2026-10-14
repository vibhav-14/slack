from __future__ import annotations

import random
import shutil
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from . import models as m
from .config import CLAUDE_ENABLED, MAX_UPLOAD_MB, UPLOAD_DIR
from .db import get_db
from .services import views as v
from .services.ingest import abbreviation, process_source
from .services.planner import build_plan

router = APIRouter()

TopicStatus = Literal["not_started", "in_progress", "done"]
RecordStatus = Literal["not_started", "draft", "written", "checked"]
SourceKind = Literal["syllabus", "notes", "past_paper", "exam_pattern", "slides", "timetable"]
ALLOWED_EXT = {".pdf", ".pptx", ".txt", ".png", ".jpg", ".jpeg", ".heic", ".webp"}


class Body(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


def profile(db: Session) -> m.Profile:
    p = db.get(m.Profile, 1)
    if p is None:
        p = m.Profile(id=1)
        db.add(p)
        db.commit()
    return p


def not_found(what: str) -> HTTPException:
    return HTTPException(404, f"{what} not found")


def my_slots(db: Session, p: m.Profile) -> list[dict]:
    rows = db.scalars(select(m.TimetableSlot).order_by(m.TimetableSlot.day, m.TimetableSlot.id)).all()
    return [v.slot_dict(s, p.periods) for s in rows if s.group in (None, p.lab_group)]


# ---------------------------------------------------------------- profile


@router.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    return v.profile_dict(profile(db), CLAUDE_ENABLED)


class ProfilePatch(Body):
    class_label: str | None = None
    lab_group: int | None = Field(None, ge=1, le=2)
    hours_per_day: float | None = Field(None, gt=0, le=12)
    rest_days: list[int] | None = None


@router.patch("/profile")
def patch_profile(body: ProfilePatch, db: Session = Depends(get_db)):
    p = profile(db)
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(p, k, val)
    db.commit()
    return v.profile_dict(p, CLAUDE_ENABLED)


# -------------------------------------------------------------- timetable


@router.get("/timetable")
def get_timetable(db: Session = Depends(get_db)):
    p = profile(db)
    latest = db.scalars(select(m.Source).where(m.Source.kind == "timetable").order_by(m.Source.uploaded_at.desc())).first()
    rows = db.scalars(select(m.TimetableSlot).order_by(m.TimetableSlot.day, m.TimetableSlot.id)).all()
    return {
        "classLabel": p.class_label,
        "labGroup": p.lab_group,
        "effectiveFrom": v.iso(p.timetable_effective_from),
        "periods": p.periods,
        "slots": [v.slot_dict(s, p.periods) for s in rows],
        "availableClasses": (latest.extracted or {}).get("classes", []) if latest else [],
    }


# --------------------------------------------------------------- overview


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    p = profile(db)
    today = date.today()
    idx = v.TopicIndex(db)
    topics = idx.all()
    subjects = db.scalars(select(m.Subject).order_by(m.Subject.exam_date, m.Subject.name)).all()
    units = db.scalars(select(m.Unit)).all()
    out_subjects = []
    for s in subjects:
        ts = [t for t in topics if t["subjectId"] == s.id]
        us = [u for u in units if u.subject_id == s.id]
        out_subjects.append(
            {
                **v.subject_dict(s),
                "topicsTotal": len(ts),
                "topicsDone": sum(t["status"] == "done" for t in ts),
                "unitsTotal": len(us),
                "unitsDone": sum(1 for u in us if (uts := [t for t in ts if t["unitId"] == u.id]) and all(t["status"] == "done" for t in uts)),
            }
        )
    _ensure_plan(db, p)
    sessions = db.scalars(select(m.PlanSession).where(m.PlanSession.date == today)).all()
    experiments = db.scalars(select(m.Experiment).where(m.Experiment.status.in_(["not_started", "draft"]))).all()
    due = sorted((e for e in experiments if e.due), key=lambda e: e.due)[:5]
    sources = db.scalars(select(m.Source).order_by(m.Source.uploaded_at.desc()).limit(3)).all()
    return {
        "subjects": out_subjects,
        "todayClasses": [s for s in my_slots(db, p) if s["day"] == today.weekday()],
        "todaySessions": [v.session_dict(s) for s in sessions],
        "dueExperiments": [v.experiment_dict(e) for e in due],
        "weakest": [c for c in v.concept_stats(db) if v.is_weak(c)][:4],
        "recentSources": [v.source_dict(s) for s in sources],
    }


# --------------------------------------------------------------- subjects


@router.get("/subjects")
def list_subjects(db: Session = Depends(get_db)):
    return [v.subject_dict(s) for s in db.scalars(select(m.Subject).order_by(m.Subject.name)).all()]


@router.get("/subjects/{subject_id}")
def get_subject(subject_id: str, db: Session = Depends(get_db)):
    s = db.get(m.Subject, subject_id)
    if not s:
        raise not_found("Subject")
    units = db.scalars(select(m.Unit).where(m.Unit.subject_id == s.id).order_by(m.Unit.number)).all()
    return {"subject": v.subject_dict(s), "units": [v.unit_dict(u) for u in units], "topics": v.TopicIndex(db, s.id).all()}


class SubjectPatch(Body):
    exam_date: date | None = None
    name: str | None = Field(None, min_length=2, max_length=200)
    code: str | None = Field(None, min_length=2, max_length=30)


@router.patch("/subjects/{subject_id}")
def patch_subject(subject_id: str, body: SubjectPatch, db: Session = Depends(get_db)):
    s = db.get(m.Subject, subject_id)
    if not s:
        raise not_found("Subject")
    data = body.model_dump(exclude_unset=True)
    if "exam_date" in data and data["exam_date"]:
        s.exam_date, s.exam_date_confirmed = data["exam_date"], True
    if data.get("name"):
        s.name = data["name"]
    if data.get("code"):
        s.code, s.official_code = data["code"], True
    db.commit()
    return v.subject_dict(s)


@router.get("/units")
def list_units(db: Session = Depends(get_db)):
    return [v.unit_dict(u) for u in db.scalars(select(m.Unit).order_by(m.Unit.subject_id, m.Unit.number)).all()]


# ----------------------------------------------------------------- topics


@router.get("/topics")
def list_topics(subjectId: str | None = None, tier: str | None = None, db: Session = Depends(get_db)):  # noqa: N803
    topics = v.TopicIndex(db, subjectId).all()
    if tier:
        topics = [t for t in topics if t["priority"]["tier"] == tier]
    return sorted(topics, key=lambda t: -t["priority"]["score"])


@router.get("/topics/{topic_id}")
def get_topic(topic_id: str, db: Session = Depends(get_db)):
    t = db.get(m.Topic, topic_id)
    if not t:
        raise not_found("Topic")
    idx = v.TopicIndex(db, t.subject_id)
    origins = dict(
        db.execute(select(m.Question.origin, func.count()).where(m.Question.topic_id == t.id).group_by(m.Question.origin)).all()
    )
    return {
        **idx.view(t),
        "evidence": [v.evidence_dict(e) for e in idx.evidence[t.id]],
        "conceptStats": v.concept_stats(db, t.id),
        "questionCounts": {"slides": origins.get("slides", 0), "claude": origins.get("claude", 0)},
    }


class TopicPatch(Body):
    status: TopicStatus


@router.patch("/topics/{topic_id}")
def patch_topic(topic_id: str, body: TopicPatch, db: Session = Depends(get_db)):
    t = db.get(m.Topic, topic_id)
    if not t:
        raise not_found("Topic")
    t.status = body.status
    db.commit()
    return v.TopicIndex(db, t.subject_id).view(t)


@router.post("/topics/{topic_id}/questions")
def generate_topic_questions(topic_id: str, db: Session = Depends(get_db)):
    """Ask Claude for more questions grounded in this topic's slides."""
    if not CLAUDE_ENABLED:
        raise HTTPException(400, "Claude isn't configured. Set ANTHROPIC_API_KEY on the server to enable this.")
    from .extract.slides import parse_deck
    from .services.ingest import add_claude_questions

    t = db.get(m.Topic, topic_id)
    if not t:
        raise not_found("Topic")
    src = db.scalars(
        select(m.Source).join(m.Question, m.Question.source_id == m.Source.id).where(m.Question.topic_id == t.id, m.Source.path.like("%.pptx"))
    ).first()
    if not src:
        raise HTTPException(400, "Upload this topic's lecture slides first. Questions are only written from your own material.")
    added = add_claude_questions(db, src, parse_deck(src.path))
    db.refresh(src)
    if not added and (src.extracted or {}).get("aiError"):
        raise HTTPException(502, src.extracted["aiError"])
    return {"added": added}


# ---------------------------------------------------------------- sources


@router.get("/sources")
def list_sources(db: Session = Depends(get_db)):
    return [v.source_dict(s) for s in db.scalars(select(m.Source).order_by(m.Source.uploaded_at.desc())).all()]


@router.post("/sources")
async def upload_source(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    kind: SourceKind = Form(...),
    subjectId: str | None = Form(None),  # noqa: N803
    db: Session = Depends(get_db),
):
    name = Path(file.filename or "upload").name
    ext = Path(name).suffix.lower()
    if subjectId and not db.get(m.Subject, subjectId):
        raise HTTPException(400, "That subject doesn't exist.")
    sid = uuid.uuid4().hex[:12]
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / f"{sid}{ext}"
    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1 << 20):
            size += len(chunk)
            if size > MAX_UPLOAD_MB << 20:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"Files must be under {MAX_UPLOAD_MB} MB.")
            out.write(chunk)
    src = m.Source(
        id=sid, subject_id=subjectId or None, kind=kind, filename=name, path=str(dest), size_kb=max(1, size // 1024),
        status="queued" if ext in ALLOWED_EXT else "failed",
        error=None if ext in ALLOWED_EXT else "This file type isn't supported. Upload PDF, PPTX or TXT.",
        retryable=ext in ALLOWED_EXT,
    )
    db.add(src)
    db.commit()
    if src.status == "queued":
        background.add_task(process_source, sid)
    return v.source_dict(src)


@router.post("/sources/{source_id}/retry")
def retry_source(source_id: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    s = db.get(m.Source, source_id)
    if not s:
        raise not_found("Source")
    if not s.retryable:
        raise HTTPException(400, s.error or "This file can't be retried. Upload it in a supported format.")
    s.status, s.error = "queued", None
    db.commit()
    background.add_task(process_source, s.id)
    return v.source_dict(s)


@router.delete("/sources/{source_id}")
def delete_source(source_id: str, db: Session = Depends(get_db)):
    s = db.get(m.Source, source_id)
    if not s:
        raise not_found("Source")
    path = Path(s.path)
    db.delete(s)
    db.flush()
    # Topics that existed only because of this file go with it, unless studied.
    for t in db.scalars(select(m.Topic)).all():
        has_ev = db.scalar(select(func.count()).select_from(m.Evidence).where(m.Evidence.topic_id == t.id))
        has_q = db.scalar(select(func.count()).select_from(m.Question).where(m.Question.topic_id == t.id))
        has_ans = db.scalar(select(func.count()).select_from(m.Answer).where(m.Answer.topic_id == t.id))
        if not (has_ev or has_q or has_ans) and t.status == "not_started":
            db.delete(t)
    db.commit()
    path.unlink(missing_ok=True)
    return {"ok": True}


# --------------------------------------------------------------- concepts


@router.get("/concepts")
def list_concepts(db: Session = Depends(get_db)):
    return v.concept_stats(db)


# ---------------------------------------------------------------- quizzes


@router.get("/quizzes")
def list_quizzes(db: Session = Depends(get_db)):
    return [v.quiz_dict(q) for q in db.scalars(select(m.Quiz).order_by(m.Quiz.created_at.desc())).all()]


@router.get("/quizzes/{quiz_id}")
def get_quiz(quiz_id: str, db: Session = Depends(get_db)):
    q = db.get(m.Quiz, quiz_id)
    if not q:
        raise not_found("Quiz")
    return v.quiz_dict(q)


class QuizCreate(Body):
    mode: Literal["weak", "priority", "topics"]
    topic_ids: list[str] = []
    count: int = Field(10, ge=1, le=40)


@router.post("/quizzes")
def create_quiz(body: QuizCreate, db: Session = Depends(get_db)):
    questions = db.scalars(select(m.Question)).all()
    rng = random.Random()
    if body.mode == "weak":
        weak = [c for c in v.concept_stats(db) if v.is_weak(c)]
        keys = {(c["topicId"], c["concept"]) for c in weak}
        topics = {c["topicId"] for c in weak}
        first = [q for q in questions if (q.topic_id, q.concept) in keys]
        rest = [q for q in questions if q.topic_id in topics and (q.topic_id, q.concept) not in keys]
        rng.shuffle(first)
        rng.shuffle(rest)
        pool, title = first + rest, "Weak concepts"
    elif body.mode == "priority":
        ranked = [t for t in v.TopicIndex(db).all() if t["priority"]["tier"] == "high"]
        ranked.sort(key=lambda t: -t["priority"]["score"])
        pool = []
        for t in ranked:
            qs = [q for q in questions if q.topic_id == t["id"]]
            rng.shuffle(qs)
            pool += qs
        title = "High-priority topics"
    else:
        pool = [q for q in questions if q.topic_id in body.topic_ids]
        rng.shuffle(pool)
        names = db.scalars(select(m.Topic.title).where(m.Topic.id.in_(body.topic_ids))).all()
        title = names[0] if len(names) == 1 else f"{len(names)} topics"
    if not pool:
        raise HTTPException(400, "No quiz questions are available for that yet. Upload lecture slides for these topics first.")
    chosen = pool[: body.count]
    rng.shuffle(chosen)
    quiz = m.Quiz(
        id=f"quiz-{uuid.uuid4().hex[:10]}",
        title=title,
        question_ids=[q.id for q in chosen],
        questions=[v.question_dict(q) for q in chosen],
        answers=None,
    )
    db.add(quiz)
    db.commit()
    return v.quiz_dict(quiz)


class QuizSubmit(Body):
    answers: list[int | None]


@router.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, body: QuizSubmit, db: Session = Depends(get_db)):
    q = db.get(m.Quiz, quiz_id)
    if not q:
        raise not_found("Quiz")
    if q.submitted_at:
        return v.quiz_dict(q)
    if len(body.answers) != len(q.questions):
        raise HTTPException(400, "Answer count doesn't match the quiz.")
    now = datetime.now(timezone.utc)
    q.answers, q.submitted_at = body.answers, now
    q.score = sum(a == qq["answerIndex"] for a, qq in zip(body.answers, q.questions))
    existing_topics = set(db.scalars(select(m.Topic.id)).all())
    for a, qq in zip(body.answers, q.questions):
        if qq["topicId"] in existing_topics:
            db.add(m.Answer(topic_id=qq["topicId"], concept=qq["concept"], correct=a == qq["answerIndex"], answered_at=now))
    db.commit()
    return v.quiz_dict(q)


# ------------------------------------------------------------------- plan


def _regenerate(db: Session, p: m.Profile) -> None:
    today = date.today()
    keep = db.scalars(select(m.PlanSession).where((m.PlanSession.date < today) | (m.PlanSession.done.is_(True)))).all()
    keep_ids = {s.id for s in keep}
    db.execute(delete(m.PlanSession).where(m.PlanSession.id.not_in(keep_ids)) if keep_ids else delete(m.PlanSession))
    subjects = db.scalars(select(m.Subject)).all()
    fresh = build_plan(
        topics=v.TopicIndex(db).all(),
        exam_dates={s.id: s.exam_date for s in subjects},
        subject_codes={s.id: abbreviation(s.name) if s.official_code else s.code for s in subjects},
        slots=my_slots(db, p),
        start=today,
        hours_per_day=p.hours_per_day,
        rest_days=p.rest_days,
    )
    for s in fresh:
        if s["id"] not in keep_ids:
            db.add(
                m.PlanSession(
                    id=s["id"], date=s["date"], topic_id=s["topicId"], kind=s["kind"], minutes=s["minutes"], reason=s["reason"]
                )
            )
    p.plan_generated_at = datetime.now(timezone.utc)
    db.commit()


def _ensure_plan(db: Session, p: m.Profile) -> None:
    if p.plan_generated_at is None and db.scalar(select(func.count()).select_from(m.Topic)):
        _regenerate(db, p)


def _plan_dict(db: Session, p: m.Profile) -> dict:
    sessions = db.scalars(select(m.PlanSession).order_by(m.PlanSession.date, m.PlanSession.id)).all()
    return {
        "generatedAt": v.iso(p.plan_generated_at),
        "hoursPerDay": p.hours_per_day,
        "restDays": p.rest_days,
        "sessions": [v.session_dict(s) for s in sessions],
    }


@router.get("/plan")
def get_plan(db: Session = Depends(get_db)):
    p = profile(db)
    _ensure_plan(db, p)
    return _plan_dict(db, p)


class PlanCreate(Body):
    hours_per_day: float = Field(gt=0, le=12)
    rest_days: list[int]


@router.post("/plan")
def regenerate_plan(body: PlanCreate, db: Session = Depends(get_db)):
    p = profile(db)
    p.hours_per_day, p.rest_days = body.hours_per_day, sorted(set(body.rest_days))
    _regenerate(db, p)
    return _plan_dict(db, p)


class SessionPatch(Body):
    done: bool


@router.patch("/plan/sessions/{session_id:path}")
def patch_session(session_id: str, body: SessionPatch, db: Session = Depends(get_db)):
    s = db.get(m.PlanSession, session_id)
    if not s:
        raise not_found("Session")
    s.done = body.done
    db.commit()
    return v.session_dict(s)


# ------------------------------------------------------------------- labs


@router.get("/labs")
def list_labs(db: Session = Depends(get_db)):
    labs = db.scalars(select(m.LabCourse).order_by(m.LabCourse.name)).all()
    exps = db.scalars(select(m.Experiment).order_by(m.Experiment.lab_id, m.Experiment.number)).all()
    return {"labs": [v.lab_dict(lab) for lab in labs], "experiments": [v.experiment_dict(e) for e in exps]}


class LabPatch(Body):
    practical_exam_date: date | None = None


@router.patch("/labs/{lab_id}")
def patch_lab(lab_id: str, body: LabPatch, db: Session = Depends(get_db)):
    lab = db.get(m.LabCourse, lab_id)
    if not lab:
        raise not_found("Lab")
    lab.practical_exam_date = body.practical_exam_date
    db.commit()
    return v.lab_dict(lab)


class ExperimentCreate(Body):
    title: str = Field(min_length=2, max_length=200)
    aim: str = ""
    due: date | None = None


@router.post("/labs/{lab_id}/experiments")
def add_experiment(lab_id: str, body: ExperimentCreate, db: Session = Depends(get_db)):
    if not db.get(m.LabCourse, lab_id):
        raise not_found("Lab")
    n = (db.scalar(select(func.max(m.Experiment.number)).where(m.Experiment.lab_id == lab_id)) or 0) + 1
    e = m.Experiment(id=f"{lab_id}-e{uuid.uuid4().hex[:6]}", lab_id=lab_id, number=n, title=body.title.strip(), aim=body.aim.strip(), due=body.due)
    db.add(e)
    db.commit()
    return v.experiment_dict(e)


class Checklist(Body):
    aim: bool | None = None
    procedure: bool | None = None
    code: bool | None = None
    output: bool | None = None
    conclusion: bool | None = None


class ExperimentPatch(Body):
    title: str | None = Field(None, min_length=2, max_length=200)
    aim: str | None = None
    status: RecordStatus | None = None
    performed_on: date | None = None
    due: date | None = None
    checklist: Checklist | None = None
    viva_questions: list[str] | None = None


@router.patch("/experiments/{experiment_id}")
def patch_experiment(experiment_id: str, body: ExperimentPatch, db: Session = Depends(get_db)):
    e = db.get(m.Experiment, experiment_id)
    if not e:
        raise not_found("Experiment")
    data = body.model_dump(exclude_unset=True)
    if "checklist" in data and data["checklist"] is not None:
        e.checklist = {**e.checklist, **{k: val for k, val in data.pop("checklist").items() if val is not None}}
    for k, val in data.items():
        setattr(e, k, val)
    db.commit()
    return v.experiment_dict(e)


@router.delete("/experiments/{experiment_id}")
def delete_experiment(experiment_id: str, db: Session = Depends(get_db)):
    e = db.get(m.Experiment, experiment_id)
    if not e:
        raise not_found("Experiment")
    for a in e.attachments:
        (UPLOAD_DIR / "attachments" / a.get("stored", "")).unlink(missing_ok=True)
    db.delete(e)
    db.commit()
    return {"ok": True}


@router.post("/experiments/{experiment_id}/attachments")
async def attach_file(experiment_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    e = db.get(m.Experiment, experiment_id)
    if not e:
        raise not_found("Experiment")
    folder = UPLOAD_DIR / "attachments"
    folder.mkdir(parents=True, exist_ok=True)
    name = Path(file.filename or "file").name
    stored = f"{uuid.uuid4().hex[:10]}{Path(name).suffix.lower()}"
    with (folder / stored).open("wb") as out:
        shutil.copyfileobj(file.file, out)
    size = (folder / stored).stat().st_size
    e.attachments = [*e.attachments, {"name": name, "sizeKb": max(1, size // 1024), "stored": stored}]
    db.commit()
    return v.experiment_dict(e)
