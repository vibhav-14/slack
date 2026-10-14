"""Read models: turn database rows into the shapes the API returns.

All dict keys here are camelCase because they go straight to the frontend
(see frontend/src/api/types.ts).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .scoring import EvidenceIn, ScoringInput, WEAK_THRESHOLD, MIN_ATTEMPTS, mastery, score_topic


def iso(d: date | datetime | None) -> str | None:
    return d.isoformat() if d else None


def subject_dict(s: m.Subject) -> dict:
    return {
        "id": s.id,
        "code": s.code,
        "officialCode": s.official_code,
        "name": s.name,
        "faculty": s.faculty,
        "examDate": iso(s.exam_date),
        "examDateConfirmed": s.exam_date_confirmed,
        "examPattern": s.exam_pattern,
    }


def unit_dict(u: m.Unit) -> dict:
    return {"id": u.id, "subjectId": u.subject_id, "number": u.number, "title": u.title, "hours": u.hours}


class TopicIndex:
    """Loads everything scoring needs in a handful of queries."""

    def __init__(self, db: Session, subject_id: str | None = None):
        q = select(m.Topic)
        if subject_id:
            q = q.where(m.Topic.subject_id == subject_id)
        self.topics = db.scalars(q.order_by(m.Topic.subject_id, m.Topic.position)).all()
        self.units = {u.id: u for u in db.scalars(select(m.Unit)).all()}
        self.evidence: dict[str, list[m.Evidence]] = defaultdict(list)
        for e in db.scalars(select(m.Evidence).order_by(m.Evidence.position, m.Evidence.id)).all():
            self.evidence[e.topic_id].append(e)
        self.answers: dict[str, list[m.Answer]] = defaultdict(list)
        for a in db.scalars(select(m.Answer).order_by(m.Answer.answered_at)).all():
            self.answers[a.topic_id].append(a)

        all_topics = db.scalars(select(m.Topic)).all()
        self.topics_per_unit: dict[str, int] = defaultdict(int)
        for t in all_topics:
            self.topics_per_unit[t.unit_id] += 1
        self.max_topic_hours: dict[str, float] = {}
        self.papers_per_subject: dict[str, int] = defaultdict(int)
        for u in self.units.values():
            if u.hours and self.topics_per_unit[u.id]:
                share = u.hours / self.topics_per_unit[u.id]
                self.max_topic_hours[u.subject_id] = max(self.max_topic_hours.get(u.subject_id, 0), share)
        sessions: dict[str, set[str]] = defaultdict(set)
        topic_subject = {t.id: t.subject_id for t in all_topics}
        for e in db.scalars(select(m.Evidence).where(m.Evidence.kind == "past_paper")).all():
            if e.paper:
                sessions[topic_subject.get(e.topic_id, "")].add(e.paper)
        for sid, papers in sessions.items():
            self.papers_per_subject[sid] = len(papers)

    def view(self, t: m.Topic) -> dict:
        unit = self.units[t.unit_id]
        ev = self.evidence[t.id]
        ans = self.answers[t.id]
        attempts, correct = len(ans), sum(a.correct for a in ans)
        papers = {e.paper for e in ev if e.kind == "past_paper" and e.paper}
        priority = score_topic(
            ScoringInput(
                status=t.status,
                evidence=[EvidenceIn(e.kind, e.paper, e.marks, e.level, e.label) for e in ev],
                unit_hours=unit.hours,
                unit_number=unit.number,
                topics_in_unit=self.topics_per_unit[unit.id],
                max_topic_hours=self.max_topic_hours.get(t.subject_id),
                papers_analysed=self.papers_per_subject.get(t.subject_id, 0),
                attempts=attempts,
                correct=correct,
            )
        )
        return {
            "id": t.id,
            "subjectId": t.subject_id,
            "unitId": t.unit_id,
            "title": t.title,
            "status": t.status,
            "concepts": t.concepts,
            "sessionNumber": t.session_number,
            "courseOutcome": t.course_outcome,
            "bloom": t.bloom,
            "priority": priority,
            "mastery": mastery(attempts, correct),
            "evidenceCount": len(ev),
            "papers": {"asked": len(papers), "total": self.papers_per_subject.get(t.subject_id, 0)},
        }

    def all(self) -> list[dict]:
        return [self.view(t) for t in self.topics]


def evidence_dict(e: m.Evidence) -> dict:
    return {
        "id": str(e.id),
        "topicId": e.topic_id,
        "kind": e.kind,
        "sourceId": e.source_id,
        "label": e.label,
        "marks": e.marks,
        "level": e.level,
        "excerpt": e.excerpt,
    }


def concept_stats(db: Session, topic_id: str | None = None) -> list[dict]:
    q = select(m.Answer).order_by(m.Answer.answered_at)
    if topic_id:
        q = q.where(m.Answer.topic_id == topic_id)
    grouped: dict[tuple[str, str], list[m.Answer]] = defaultdict(list)
    for a in db.scalars(q).all():
        grouped[(a.topic_id, a.concept)].append(a)
    subject_of = {t.id: t.subject_id for t in db.scalars(select(m.Topic)).all()}
    out = []
    for (tid, concept), rows in grouped.items():
        if tid not in subject_of:
            continue
        out.append(
            {
                "concept": concept,
                "topicId": tid,
                "subjectId": subject_of[tid],
                "attempts": len(rows),
                "correct": sum(r.correct for r in rows),
                "recent": [r.correct for r in rows[-8:]],
                "lastSeen": iso(rows[-1].answered_at),
            }
        )
    return sorted(out, key=lambda c: c["correct"] / c["attempts"])


def is_weak(c: dict) -> bool:
    return c["attempts"] >= MIN_ATTEMPTS and c["correct"] / c["attempts"] < WEAK_THRESHOLD


def source_dict(s: m.Source) -> dict:
    return {
        "id": s.id,
        "subjectId": s.subject_id,
        "kind": s.kind,
        "filename": s.filename,
        "pages": s.pages,
        "sizeKb": s.size_kb,
        "uploadedAt": iso(s.uploaded_at),
        "status": s.status,
        "extracted": s.extracted,
        "error": s.error,
        "retryable": s.retryable,
    }


def quiz_dict(q: m.Quiz) -> dict:
    return {
        "id": q.id,
        "title": q.title,
        "createdAt": iso(q.created_at),
        "topicIds": sorted({x["topicId"] for x in q.questions}),
        "questions": q.questions,
        "answers": q.answers,
        "submittedAt": iso(q.submitted_at),
        "score": q.score,
    }


def question_dict(q: m.Question) -> dict:
    return {
        "id": q.id,
        "topicId": q.topic_id,
        "concept": q.concept,
        "prompt": q.prompt,
        "options": q.options,
        "answerIndex": q.answer_index,
        "explanation": q.explanation,
        "origin": q.origin,
        "slideRef": q.slide_ref,
    }


def session_dict(s: m.PlanSession) -> dict:
    return {
        "id": s.id,
        "date": iso(s.date),
        "topicId": s.topic_id,
        "kind": s.kind,
        "minutes": s.minutes,
        "done": s.done,
        "reason": s.reason,
    }


def lab_dict(lab: m.LabCourse) -> dict:
    return {
        "id": lab.id,
        "code": lab.code,
        "name": lab.name,
        "subjectId": lab.subject_id,
        "faculty": lab.faculty,
        "practicalExamDate": iso(lab.practical_exam_date),
    }


def experiment_dict(e: m.Experiment) -> dict:
    return {
        "id": e.id,
        "labId": e.lab_id,
        "number": e.number,
        "title": e.title,
        "aim": e.aim,
        "performedOn": iso(e.performed_on),
        "due": iso(e.due),
        "status": e.status,
        "checklist": e.checklist,
        "attachments": e.attachments,
        "vivaQuestions": e.viva_questions,
    }


def slot_dict(s: m.TimetableSlot, periods: list[dict]) -> dict:
    by_num = {p["number"]: p for p in periods}
    first, last = by_num.get(s.periods[0]), by_num.get(s.periods[-1])
    return {
        "id": s.id,
        "day": s.day,
        "periods": s.periods,
        "start": first["start"] if first else None,
        "end": last["end"] if last else None,
        "title": s.title,
        "kind": s.kind,
        "subjectId": s.subject_id,
        "labId": s.lab_id,
        "room": s.room,
        "faculty": s.faculty,
        "group": s.group,
    }


def profile_dict(p: m.Profile, ai_available: bool) -> dict:
    return {
        "program": p.program,
        "institution": p.institution,
        "classLabel": p.class_label,
        "semester": p.semester,
        "labGroup": p.lab_group,
        "hoursPerDay": p.hours_per_day,
        "restDays": p.rest_days,
        "timetableEffectiveFrom": iso(p.timetable_effective_from),
        "aiAvailable": ai_available,
    }
