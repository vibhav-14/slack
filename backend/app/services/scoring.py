"""Evidence-based topic priority.

Six factors, each 0..1 times a weight. A factor with no data behind it (no
past papers uploaded, no syllabus hours known) is reported as unavailable and
its weight is shared out among the factors that do have evidence, so a topic
is never penalised or boosted by data that doesn't exist yet.
"""

from __future__ import annotations

from dataclasses import dataclass

WEIGHTS = {
    "frequency": 0.25,
    "marks": 0.10,
    "syllabus": 0.10,
    "assessment": 0.15,
    "weakness": 0.25,
    "coverage": 0.15,
}
LABELS = {
    "frequency": "Exam frequency",
    "marks": "Marks when asked",
    "syllabus": "Syllabus weight",
    "assessment": "Assessment signals",
    "weakness": "Your weakness",
    "coverage": "Not yet covered",
}
TIERS = {"high": 65, "medium": 45}
MIN_ATTEMPTS = 3
WEAK_THRESHOLD = 0.6
MAX_QUESTION_MARKS = 10
BLOOM_WEIGHT = {"K1": 0.1, "K2": 0.2, "K3": 0.3, "K4": 0.4, "K5": 0.45, "K6": 0.5}


@dataclass
class EvidenceIn:
    kind: str
    paper: str | None = None
    marks: float | None = None
    level: str | None = None
    label: str = ""


@dataclass
class ScoringInput:
    status: str
    evidence: list[EvidenceIn]
    unit_hours: float | None
    unit_number: int
    topics_in_unit: int
    max_topic_hours: float | None  # largest hours-per-topic share in the subject
    papers_analysed: int  # distinct past-paper sessions uploaded for the subject
    attempts: int
    correct: int


def mastery(attempts: int, correct: int) -> float | None:
    return correct / attempts if attempts >= MIN_ATTEMPTS else None


def tier_for(score: int) -> str:
    return "high" if score >= TIERS["high"] else "medium" if score >= TIERS["medium"] else "low"


def score_topic(inp: ScoringInput) -> dict:
    factors: list[dict] = []

    def add(key: str, value: float | None, detail: str) -> None:
        factors.append(
            {"key": key, "label": LABELS[key], "value": value, "weight": WEIGHTS[key], "available": value is not None, "detail": detail}
        )

    papers = [e for e in inp.evidence if e.kind == "past_paper"]
    asked = len({e.paper for e in papers if e.paper})
    if inp.papers_analysed:
        add("frequency", asked / inp.papers_analysed, f"Asked in {asked} of {inp.papers_analysed} past papers")
        marked = [e.marks for e in papers if e.marks]
        avg = sum(marked) / len(marked) if marked else 0
        add(
            "marks",
            min(1.0, avg / MAX_QUESTION_MARKS),
            f"Averages {avg:.1f} marks per question" if marked else "Not asked in the papers uploaded",
        )
    else:
        add("frequency", None, "No past papers uploaded yet")
        add("marks", None, "No past papers uploaded yet")

    if inp.unit_hours and inp.max_topic_hours:
        share = inp.unit_hours / max(1, inp.topics_in_unit)
        add(
            "syllabus",
            min(1.0, share / inp.max_topic_hours),
            f"Unit {inp.unit_number} has {inp.unit_hours:g} lecture hours across {inp.topics_in_unit} topic{'s' if inp.topics_in_unit != 1 else ''}",
        )
    else:
        add("syllabus", None, "Lecture hours unknown — upload the syllabus")

    focus = [e for e in inp.evidence if e.kind == "assessment" and not (e.level and e.label.startswith("Check"))]
    prompts = [e for e in inp.evidence if e.kind == "assessment" and e.level and e.label.startswith("Check")]
    has_slides = any(e.kind in ("slides", "assessment") for e in inp.evidence)
    if has_slides:
        raw = len(focus) * 1.0 + sum(BLOOM_WEIGHT.get(e.level or "", 0.2) for e in prompts)
        levels = sorted({e.level for e in prompts if e.level})
        parts = []
        if focus:
            parts.append(f"slides name {len(focus)} assessment question{'s' if len(focus) != 1 else ''}")
        if prompts:
            span = levels[0] if len(levels) == 1 else f"{levels[0]}–{levels[-1]}"
            parts.append(f"{len(prompts)} practice question{'s' if len(prompts) != 1 else ''} ({span})")
        detail = ("Your " + " and ".join(parts)) if parts else "Slides uploaded, no assessment cues found"
        add("assessment", min(1.0, raw / 1.5), detail[0].upper() + detail[1:])
    else:
        add("assessment", None, "No lecture slides uploaded for this topic")

    m = mastery(inp.attempts, inp.correct)
    if m is None:
        detail = (
            f"Only {inp.attempts} quiz answer{'s' if inp.attempts != 1 else ''} so far — treated as average"
            if inp.attempts
            else "No quiz attempts yet — treated as average"
        )
        add("weakness", 0.5, detail)
    else:
        add("weakness", 1 - m, f"{round(m * 100)}% correct over {inp.attempts} quiz answers")

    coverage = {"not_started": 1.0, "in_progress": 0.5}.get(inp.status, 0.15)
    add(
        "coverage",
        coverage,
        {"not_started": "You haven't started this topic", "in_progress": "In progress"}.get(inp.status, "Marked done — kept for revision"),
    )

    available = [f for f in factors if f["available"]]
    total_w = sum(f["weight"] for f in available) or 1
    score = round(100 * sum(f["value"] * f["weight"] for f in available) / total_w)
    for f in factors:
        f["effectiveWeight"] = f["weight"] / total_w if f["available"] else 0
    return {"score": score, "tier": tier_for(score), "factors": factors}
