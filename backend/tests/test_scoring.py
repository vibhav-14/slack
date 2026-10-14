from datetime import date

from app.services.planner import build_plan
from app.services.scoring import EvidenceIn, ScoringInput, score_topic


def _input(**kw):
    base = dict(
        status="not_started", evidence=[], unit_hours=None, unit_number=1, topics_in_unit=1,
        max_topic_hours=None, papers_analysed=0, attempts=0, correct=0,
    )
    return ScoringInput(**{**base, **kw})


def test_missing_data_is_unavailable_not_zero():
    p = score_topic(_input())
    avail = {f["key"]: f["available"] for f in p["factors"]}
    assert avail == {"frequency": False, "marks": False, "syllabus": False, "assessment": False, "weakness": True, "coverage": True}
    # Only weakness (0.5) and coverage (1.0) count, re-weighted to sum to 1.
    assert p["score"] == round(100 * (0.5 * 0.25 + 1.0 * 0.15) / 0.40)


def test_past_papers_raise_frequency():
    ev = [EvidenceIn("past_paper", paper=f"End-Sem {y}", marks=10) for y in (2023, 2024, 2025)]
    p = score_topic(_input(evidence=ev, papers_analysed=4))
    freq = next(f for f in p["factors"] if f["key"] == "frequency")
    assert freq["value"] == 0.75 and freq["detail"] == "Asked in 3 of 4 past papers"


def test_mastery_needs_three_answers_and_lowers_score():
    weak = score_topic(_input(attempts=4, correct=1))
    strong = score_topic(_input(attempts=4, correct=4))
    early = score_topic(_input(attempts=2, correct=0))
    assert weak["score"] > strong["score"]
    assert next(f for f in early["factors"] if f["key"] == "weakness")["value"] == 0.5


def test_assessment_signals_from_slides():
    ev = [
        EvidenceIn("assessment", label="What the assessment will ask", level="K3"),
        EvidenceIn("assessment", label="Check your understanding · K4", level="K4"),
    ]
    f = next(f for f in score_topic(_input(evidence=ev))["factors"] if f["key"] == "assessment")
    assert f["available"] and 0.9 < f["value"] <= 1
    assert "1 assessment question" in f["detail"] and "1 practice question" in f["detail"]


def _topic(tid, subject, score, tier="high", status="not_started"):
    return {
        "id": tid, "subjectId": subject, "status": status,
        "priority": {"score": score, "tier": tier, "factors": [
            {"key": "weakness", "available": True, "value": 0.5, "effectiveWeight": 1, "detail": "No quiz attempts yet"}
        ]},
    }


def test_plan_puts_lecture_subject_first_and_respects_exam():
    monday = date(2026, 10, 12)  # a Monday
    topics = [_topic("a", "math", 90), _topic("b", "oop", 70)]
    slots = [{"day": 0, "periods": [2], "subjectId": "oop", "kind": "lecture", "start": "10:00"}]
    plan = build_plan(
        topics, {"math": date(2026, 10, 20), "oop": date(2026, 10, 20)}, {"oop": "OOP"}, slots,
        start=monday, hours_per_day=1, rest_days=[0],
    )
    first_day = [s for s in plan if s["date"] == monday]
    assert first_day[0]["topicId"] == "b"  # lower priority, but its lecture is today
    assert "OOP class today at 10:00" in first_day[0]["reason"]
    assert all(s["date"] < date(2026, 10, 20) for s in plan)
    assert not any(s["date"].weekday() == 6 for s in plan)  # Sunday is a rest day
