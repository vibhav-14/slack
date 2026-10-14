from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Profile(Base):
    """The single student using this workspace."""

    __tablename__ = "profile"
    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    program: Mapped[str | None] = mapped_column(String(120))
    institution: Mapped[str | None] = mapped_column(String(120))
    class_label: Mapped[str | None] = mapped_column(String(60))  # "B.TECH SEM 3 A"
    semester: Mapped[int | None] = mapped_column(Integer)
    lab_group: Mapped[int] = mapped_column(Integer, default=1)
    hours_per_day: Mapped[float] = mapped_column(Float, default=2.0)
    rest_days: Mapped[list[int]] = mapped_column(JSON, default=lambda: [0])  # 0 = Sunday
    periods: Mapped[list[dict]] = mapped_column(JSON, default=list)  # [{number, start, end}]
    timetable_effective_from: Mapped[date | None] = mapped_column(Date)
    plan_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    code: Mapped[str] = mapped_column(String(30))  # official code, or an abbreviation until one is known
    official_code: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(200))
    faculty: Mapped[str | None] = mapped_column(String(120))
    exam_date: Mapped[date] = mapped_column(Date)
    exam_date_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    exam_pattern: Mapped[dict | None] = mapped_column(JSON)
    units: Mapped[list[Unit]] = relationship(back_populates="subject", cascade="all, delete-orphan")


class Unit(Base):
    __tablename__ = "units"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(200))
    hours: Mapped[float | None] = mapped_column(Float)
    subject: Mapped[Subject] = relationship(back_populates="units")


class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    concepts: Mapped[list[str]] = mapped_column(JSON, default=list)
    session_number: Mapped[int | None] = mapped_column(Integer)
    course_outcome: Mapped[str | None] = mapped_column(String(20))
    bloom: Mapped[str | None] = mapped_column(String(40))  # "K3 · Applying"
    position: Mapped[int] = mapped_column(Integer, default=0)


class Source(Base):
    __tablename__ = "sources"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_id: Mapped[str | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(20))
    filename: Mapped[str] = mapped_column(String(300))
    path: Mapped[str] = mapped_column(String(500))
    pages: Mapped[int] = mapped_column(Integer, default=0)
    size_kb: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    error: Mapped[str | None] = mapped_column(Text)
    retryable: Mapped[bool] = mapped_column(Boolean, default=True)
    extracted: Mapped[dict | None] = mapped_column(JSON)


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))  # past_paper | syllabus | notes | slides | assessment
    label: Mapped[str] = mapped_column(String(200))
    excerpt: Mapped[str] = mapped_column(Text)
    marks: Mapped[float | None] = mapped_column(Float)
    level: Mapped[str | None] = mapped_column(String(4))  # Bloom level, e.g. "K3"
    paper: Mapped[str | None] = mapped_column(String(80))  # past-paper session, e.g. "End-Sem May 2024"
    position: Mapped[int] = mapped_column(Integer, default=0)


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    concept: Mapped[str] = mapped_column(String(200))
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str]] = mapped_column(JSON)
    answer_index: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str] = mapped_column(Text)
    origin: Mapped[str] = mapped_column(String(20))  # "slides" (rule-based) | "claude"
    slide_ref: Mapped[str | None] = mapped_column(String(120))


class Answer(Base):
    """One answered quiz question: the raw material for concept accuracy."""

    __tablename__ = "answers"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    concept: Mapped[str] = mapped_column(String(200))
    correct: Mapped[bool] = mapped_column(Boolean)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    question_ids: Mapped[list[str]] = mapped_column(JSON)
    # Snapshot so later re-ingestion never changes a quiz already taken.
    questions: Mapped[list[dict]] = mapped_column(JSON)
    answers: Mapped[list[int | None] | None] = mapped_column(JSON)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[int | None] = mapped_column(Integer)


class PlanSession(Base):
    __tablename__ = "plan_sessions"
    id: Mapped[str] = mapped_column(String(200), primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))
    minutes: Mapped[int] = mapped_column(Integer)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(String(200))


class LabCourse(Base):
    __tablename__ = "labs"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    code: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(200))
    subject_id: Mapped[str | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    faculty: Mapped[str | None] = mapped_column(String(120))
    practical_exam_date: Mapped[date | None] = mapped_column(Date)


class Experiment(Base):
    __tablename__ = "experiments"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    lab_id: Mapped[str] = mapped_column(ForeignKey("labs.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    aim: Mapped[str] = mapped_column(Text, default="")
    performed_on: Mapped[date | None] = mapped_column(Date)
    due: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    checklist: Mapped[dict] = mapped_column(
        JSON, default=lambda: {"aim": False, "procedure": False, "code": False, "output": False, "conclusion": False}
    )
    attachments: Mapped[list[dict]] = mapped_column(JSON, default=list)
    viva_questions: Mapped[list[str]] = mapped_column(JSON, default=list)


class TimetableSlot(Base):
    __tablename__ = "timetable_slots"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    day: Mapped[int] = mapped_column(Integer)  # 0 = Monday
    periods: Mapped[list[int]] = mapped_column(JSON)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20))  # lecture | lab | other
    subject_id: Mapped[str | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"))
    lab_id: Mapped[str | None] = mapped_column(ForeignKey("labs.id", ondelete="SET NULL"))
    room: Mapped[str | None] = mapped_column(String(40))
    faculty: Mapped[str | None] = mapped_column(String(120))
    group: Mapped[int | None] = mapped_column(Integer)
