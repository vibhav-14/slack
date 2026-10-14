"""Heuristic extraction from text PDFs: syllabi, past papers and notes.

Scanned PDFs without a text layer yield no text; callers report that rather
than guessing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8}
UNIT_RE = re.compile(r"^\s*(?:UNIT|Unit|MODULE|Module)[\s\-–:]*([IVX]+|\d+)\b[\s:.\-–]*(.*)$")
HOURS_RE = re.compile(r"\(?\b(\d{1,2})\s*(?:hours|hrs|hr|lectures|L)\b\)?", re.I)
CODE_RE = re.compile(r"\b([A-Z]{2,5}\s?\d{3,6})\b")
QUESTION_RE = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,2})\s*[.)]\s*(?:\(?([a-h])\)\s*)?(.+)$")
SUBPART_RE = re.compile(r"^\s*\(?([a-h])\)\s+(.+)$")
MARKS_RE = re.compile(r"[\(\[]\s*(\d{1,2})\s*(?:M|marks?)?\s*[\)\]]\s*$|\b(\d{1,2})\s*marks?\b", re.I)
SESSION_RE = re.compile(
    r"\b((?:Mid|End)[\s\-]?Sem(?:ester)?|Sessional|Supplementary)\b.*?\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*[-,]?\s*(\d{4})",
    re.I | re.S,
)


@dataclass
class PdfText:
    pages: int
    text: str

    @property
    def has_text(self) -> bool:
        return len(self.text.strip()) > 40


def read_pdf(path: str | Path) -> PdfText:
    doc = pymupdf.open(path)
    try:
        return PdfText(len(doc), "\n".join(page.get_text() for page in doc))
    finally:
        doc.close()


# ------------------------------------------------------------------ syllabus


@dataclass
class SyllabusUnit:
    number: int
    title: str
    hours: float | None
    topics: list[str] = field(default_factory=list)


@dataclass
class Syllabus:
    course_code: str | None
    course_name: str | None
    units: list[SyllabusUnit]


def parse_syllabus(text: str) -> Syllabus:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    code = next((m.group(1).replace(" ", "") for ln in lines[:15] if (m := CODE_RE.search(ln))), None)
    name = None
    for ln in lines[:15]:
        if re.search(r"course\s*(title|name)\s*[:\-]", ln, re.I):
            name = re.split(r"[:\-]", ln, 1)[1].strip()
            break

    units: list[SyllabusUnit] = []
    body: list[str] = []
    for ln in lines:
        if m := UNIT_RE.match(ln):
            if units:
                units[-1].topics = _split_topics(" ".join(body))
            raw = m.group(1).upper()
            number = ROMAN.get(raw) or (int(raw) if raw.isdigit() else len(units) + 1)
            rest = m.group(2)
            hours = HOURS_RE.search(rest)
            title = HOURS_RE.sub("", rest).strip(" :-–") or f"Unit {number}"
            units.append(SyllabusUnit(number, title, float(hours.group(1)) if hours else None))
            body = []
        elif units:
            if not units[-1].hours and (h := HOURS_RE.search(ln)) and len(ln) < 30:
                units[-1].hours = float(h.group(1))
                continue
            if re.match(r"^(text\s*books?|reference|course outcomes?|suggested reading)", ln, re.I):
                units[-1].topics = _split_topics(" ".join(body))
                body = []
                units.append(SyllabusUnit(-1, "", None))  # sentinel stops collection
                continue
            body.append(ln)
    if units and units[-1].number != -1:
        units[-1].topics = _split_topics(" ".join(body))
    return Syllabus(code, name, [u for u in units if u.number != -1 and (u.topics or u.title)])


def _split_topics(body: str) -> list[str]:
    parts = re.split(r"[;,]|\s[–—-]\s|\.\s", body)
    topics = [" ".join(p.split()).strip(" .") for p in parts]
    return [t[0].upper() + t[1:] for t in topics if 4 <= len(t) <= 120][:20]


# --------------------------------------------------------------- past papers


@dataclass
class PaperQuestion:
    number: str  # "Q3(b)"
    text: str
    marks: float | None


@dataclass
class Paper:
    session: str  # "End-Sem May 2024"
    questions: list[PaperQuestion]


def parse_paper(text: str, filename: str) -> Paper:
    m = SESSION_RE.search(text[:2000]) or SESSION_RE.search(filename.replace("_", " "))
    if m:
        kind = re.sub(r"[\s\-]?sem(ester)?", "-Sem", m.group(1), flags=re.I).title().replace("-Sem", "-Sem")
        session = f"{kind} {m.group(2).title()} {m.group(3)}"
    else:
        session = Path(filename).stem.replace("_", " ")

    questions: list[PaperQuestion] = []
    current_q: str | None = None
    for raw in text.splitlines():
        ln = raw.strip()
        if not ln:
            continue
        if m := QUESTION_RE.match(ln):
            current_q = m.group(1)
            label = f"Q{current_q}" + (f"({m.group(2)})" if m.group(2) else "")
            questions.append(PaperQuestion(label, m.group(3), None))
        elif current_q and (s := SUBPART_RE.match(ln)):
            questions.append(PaperQuestion(f"Q{current_q}({s.group(1)})", s.group(2), None))
        elif questions and len(questions[-1].text) < 400:
            questions[-1].text += " " + ln
    for q in questions:
        if mk := MARKS_RE.search(q.text):
            q.marks = float(mk.group(1) or mk.group(2))
            q.text = MARKS_RE.sub("", q.text).strip()
        q.text = " ".join(q.text.split())
    return Paper(session, [q for q in questions if len(q.text) > 15])


# --------------------------------------------------------------------- notes


def paragraphs(text: str) -> list[str]:
    blocks = re.split(r"\n\s*\n", text)
    out = [" ".join(b.split()) for b in blocks]
    return [b for b in out if len(b) > 60]
