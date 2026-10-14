"""Parse aSc Timetables PDF exports into class slots.

Each page is one class (e.g. "B.TECH SEM 3 A"). Days are rows, periods are
columns, and every class is a "card" bounded by ruled lines. Labs span two
periods and are split vertically into Group 1 / Group 2 halves.

Strategy: read the ruled lines, find the box that encloses each text span,
group spans by box, then map each box onto the day/period grid.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf as fitz

DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa"]
ROOM_RE = re.compile(r"^(Lab\s*\S+|CR\d+|T-\d+|\d{2,3})$", re.I)
FACULTY_RE = re.compile(r"^(Dr\.?|Ms\.?|Mr\.?|Prof\.?)\s*\S", re.I)
GROUP_RE = re.compile(r"^Group\s*(\d)$", re.I)
TIME_RE = re.compile(r"^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$")
CLASS_RE = re.compile(r"B\.TECH\s+SEM\s+(\d+)\s*([A-Z])?", re.I)


@dataclass
class Period:
    number: int
    start: str
    end: str
    x0: float
    x1: float


@dataclass
class Slot:
    day: int  # 0 = Monday
    periods: list[int]
    subject: str
    kind: str  # "lecture" | "lab" | "other"
    room: str | None = None
    faculty: str | None = None
    group: int | None = None


@dataclass
class ClassTimetable:
    label: str  # "B.TECH SEM 3 A"
    semester: int | None
    section: str | None
    effective_from: str | None
    periods: list[Period] = field(default_factory=list)
    slots: list[Slot] = field(default_factory=list)


@dataclass
class _Span:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    size: float

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


def parse_timetable(path: str | Path) -> list[ClassTimetable]:
    doc = fitz.open(path)
    try:
        return [t for page in doc if (t := _parse_page(page))]
    finally:
        doc.close()


def _spans(page: fitz.Page) -> list[_Span]:
    out: list[_Span] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                text = " ".join(span["text"].split())
                if text:
                    x0, y0, x1, y1 = span["bbox"]
                    out.append(_Span(text, x0, y0, x1, y1, span["size"]))
    return out


def _segments(page: fitz.Page):
    vertical: list[tuple[float, float, float]] = []
    horizontal: list[tuple[float, float, float]] = []
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                p, q = item[1], item[2]
                if abs(p.x - q.x) < 0.5:
                    vertical.append((p.x, min(p.y, q.y), max(p.y, q.y)))
                elif abs(p.y - q.y) < 0.5:
                    horizontal.append((p.y, min(p.x, q.x), max(p.x, q.x)))
            elif item[0] == "re":
                r = item[1]
                vertical += [(r.x0, r.y0, r.y1), (r.x1, r.y0, r.y1)]
                horizontal += [(r.y0, r.x0, r.x1), (r.y1, r.x0, r.x1)]
    return vertical, horizontal


def _enclosing_box(s: _Span, vertical, horizontal):
    eps = 0.5
    left = max((x for x, y0, y1 in vertical if x <= s.x0 + eps and y0 - eps <= s.cy <= y1 + eps), default=None)
    right = min((x for x, y0, y1 in vertical if x >= s.x1 - eps and y0 - eps <= s.cy <= y1 + eps), default=None)
    top = max((y for y, x0, x1 in horizontal if y <= s.y0 + eps and x0 - eps <= s.cx <= x1 + eps), default=None)
    bottom = min((y for y, x0, x1 in horizontal if y >= s.y1 - eps and x0 - eps <= s.cx <= x1 + eps), default=None)
    if None in (left, right, top, bottom):
        return None
    return (round(left, 1), round(top, 1), round(right, 1), round(bottom, 1))


def _parse_page(page: fitz.Page) -> ClassTimetable | None:
    spans = _spans(page)
    full = " ".join(s.text for s in spans)
    m = CLASS_RE.search(full)
    if not m:
        return None
    label_span = next(s for s in spans if CLASS_RE.search(s.text))
    eff = re.search(r"w\.e\.f\s+(\d{2})-(\d{2})-(\d{4})", full)
    tt = ClassTimetable(
        label=" ".join(label_span.text.split()),
        semester=int(m.group(1)),
        section=m.group(2),
        effective_from=f"{eff.group(3)}-{eff.group(2)}-{eff.group(1)}" if eff else None,
    )

    # Period columns: the header row holds "1" .. "7" above "8:50 - 9:50" etc.
    times = [s for s in spans if TIME_RE.match(s.text)]
    numbers = {round(s.cx): s for s in spans if s.text.isdigit() and len(s.text) == 1 and s.size > 14}
    vertical, horizontal = _segments(page)
    for t in sorted(times, key=lambda s: s.cx):
        box = _enclosing_box(t, vertical, horizontal)
        num = next((n for x, n in numbers.items() if abs(x - t.cx) < 25 and n.y1 <= t.y0 + 1), None)
        if num is None or box is None:
            continue  # the lunch-break column has a time but no period number
        start, end = TIME_RE.match(t.text).groups()
        tt.periods.append(Period(int(num.text), start, end, box[0], box[2]))

    # Day rows: the big "Mo".."Sa" labels in the first column.
    day_spans = {s.text: s for s in spans if s.text in DAYS and s.size > 14}
    rows = []
    for i, day in enumerate(DAYS):
        if day in day_spans:
            box = _enclosing_box(day_spans[day], vertical, horizontal)
            if box:
                rows.append((i, box[1], box[3]))
    if not tt.periods or not rows:
        return tt

    grid_x0 = min(p.x0 for p in tt.periods)
    grid_y0 = min(r[1] for r in rows)
    cards: dict[tuple, list[_Span]] = {}
    for s in spans:
        if s.cx < grid_x0 or s.cy < grid_y0 or s.text in DAYS or "LUNCH" in s.text.upper():
            continue
        box = _enclosing_box(s, vertical, horizontal)
        if box:
            cards.setdefault(box, []).append(s)

    for box, items in cards.items():
        slot = _card_to_slot(box, items, tt.periods, rows)
        if slot:
            tt.slots.append(slot)
    tt.slots.sort(key=lambda s: (s.day, s.periods[0], s.group or 0))
    return tt


def _card_to_slot(box, items: list[_Span], periods: list[Period], rows) -> Slot | None:
    x0, y0, x1, y1 = box
    cy = (y0 + y1) / 2
    day = next((i for i, top, bottom in rows if top - 1 <= cy <= bottom + 1), None)
    covered = [p.number for p in periods if x0 - 1 <= (p.x0 + p.x1) / 2 <= x1 + 1]
    if day is None or not covered:
        return None

    items = sorted(items, key=lambda s: (round(s.y0), s.x0))
    group = room = faculty = None
    name_parts: list[str] = []
    for s in items:
        if g := GROUP_RE.match(s.text):
            group = int(g.group(1))
        elif ROOM_RE.match(s.text) and room is None:
            room = s.text
        elif FACULTY_RE.match(s.text):
            faculty = s.text if faculty is None else f"{faculty} / {s.text}"
        else:
            name_parts.append(s.text)

    subject = " ".join(name_parts).strip()
    if not subject:
        return None
    kind = "lab" if re.search(r"\bLab$", subject) else "lecture"
    if re.search(r"xebia|readiness|sustainable", subject, re.I):
        kind = "other" if "xebia" in subject.lower() else kind
    return Slot(day=day, periods=covered, subject=subject, kind=kind, room=room, faculty=faculty, group=group)


def subject_key(name: str) -> str:
    """Lecture and lab share a key: "Object Oriented Programming Lab" -> "object oriented programming"."""
    return re.sub(r"\s+lab$", "", name.strip(), flags=re.I).lower()
