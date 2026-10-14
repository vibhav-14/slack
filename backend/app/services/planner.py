"""Revision planner.

Greedy over days, highest priority first, with three timetable-aware rules:
- a topic whose subject has a lecture that day jumps the queue ("revise while
  it's fresh"),
- heavy class days (6+ periods) get 30 minutes less study,
- nothing is scheduled on or after the subject's exam.

Every session carries a one-line reason so the plan explains itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

SPACING_DAYS = 2
HEAVY_DAY_PERIODS = 6


@dataclass
class _Item:
    topic: dict
    kind: str
    minutes: int
    not_before: date | None
    deadline: date
    rank: float
    reason: str


def _top_reason(topic: dict) -> str:
    factors = [f for f in topic["priority"]["factors"] if f["available"] and f["key"] != "coverage"]
    best = max(factors, key=lambda f: f["value"] * f["effectiveWeight"], default=None)
    lead = f"Priority {topic['priority']['score']}"
    return f"{lead} · {best['detail']}" if best else lead


def build_plan(
    topics: list[dict],
    exam_dates: dict[str, date],
    subject_codes: dict[str, str],
    slots: list[dict],
    start: date,
    hours_per_day: float,
    rest_days: list[int],
) -> list[dict]:
    ranked = sorted(topics, key=lambda t: -t["priority"]["score"])
    queue: list[_Item] = []
    for rank, t in enumerate(ranked):
        deadline = exam_dates.get(t["subjectId"])
        if not deadline or deadline <= start:
            continue
        reason = _top_reason(t)
        if t["status"] == "not_started":
            queue.append(_Item(t, "learn", 60, start, deadline, rank, reason))
        else:
            queue.append(_Item(t, "revise", 45 if t["status"] == "in_progress" else 30, start, deadline, rank, reason))
        if t["priority"]["tier"] != "low" or t["status"] != "done":
            queue.append(_Item(t, "practice", 30, None, deadline, rank + 0.5, "Spaced practice two days after studying it"))
        if t["priority"]["tier"] == "high":
            queue.append(
                _Item(t, "revise", 30, deadline - timedelta(days=7), deadline, 1000 - t["priority"]["score"], "Final revision in the week before the exam")
            )

    by_day: dict[int, list[dict]] = {}
    for s in slots:
        by_day.setdefault(s["day"], []).append(s)

    budget_base = max(30, round(hours_per_day * 60))
    last = max(exam_dates.values(), default=start)
    first_scheduled: dict[str, date] = {}
    sessions: list[dict] = []

    d = start
    while d < last:
        js_weekday = (d.weekday() + 1) % 7  # 0 = Sunday, matching the frontend
        if js_weekday in rest_days:
            d += timedelta(days=1)
            continue
        todays = by_day.get(d.weekday(), [])
        periods = {p for s in todays for p in s["periods"]}
        budget = budget_base - (30 if len(periods) >= HEAVY_DAY_PERIODS else 0)
        lectures: dict[str, dict] = {}
        for s in sorted(todays, key=lambda s: s["periods"][0]):
            if s["subjectId"] and s["subjectId"] not in lectures:
                lectures[s["subjectId"]] = s

        def available(item: _Item) -> bool:
            if item.kind == "practice" and item.not_before is None:
                first = first_scheduled.get(item.topic["id"])
                if not first:
                    return False
                item.not_before = first + timedelta(days=SPACING_DAYS)
            return item.not_before <= d < item.deadline

        todays_items = sorted(
            (i for i in queue if available(i)),
            key=lambda i: (i.topic["subjectId"] not in lectures or i.kind == "practice", i.rank),
        )
        used = 0
        for item in todays_items:
            if used + item.minutes > budget:
                continue
            if any(s["date"] == d.isoformat() and s["topicId"] == item.topic["id"] for s in sessions):
                continue
            reason = item.reason
            lec = lectures.get(item.topic["subjectId"])
            if lec and item.kind != "practice":
                code = subject_codes.get(item.topic["subjectId"], "")
                reason = f"{code} {lec['kind'] if lec['kind'] == 'lab' else 'class'} today at {lec['start']} — revise while it's fresh"
            sessions.append(
                {
                    "id": f"{d.isoformat()}:{item.topic['id']}:{item.kind}",
                    "date": d,
                    "topicId": item.topic["id"],
                    "kind": item.kind,
                    "minutes": item.minutes,
                    "reason": reason,
                }
            )
            used += item.minutes
            if item.kind != "practice":
                first_scheduled.setdefault(item.topic["id"], d)
            queue.remove(item)
            if budget - used < 30:
                break
        d += timedelta(days=1)
    return sessions
