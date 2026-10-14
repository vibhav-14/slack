"""Extract study evidence and quiz questions from lecture slide decks (.pptx).

Works on the slide XML directly (no python-pptx). Tables in these decks are
usually built from grouped text boxes rather than real PowerPoint tables, so
rows are recovered from shape x-offsets: within a row x increases left to
right, and it resets at the start of the next row.
"""

from __future__ import annotations

import random
import re
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}
YES_NO = re.compile(r"^(yes|no)\b", re.I)
# Slides whose layout looks tabular but is not a fact table.
NOT_A_TABLE = re.compile(
    r"agenda|check your understanding|activity|your turn|summary|next session|industry connect|recap|quick reference|roadmap",
    re.I,
)
NUMBERISH = re.compile(r"^(\d{1,2}\.?|K\d)$", re.I)
FOOTER = re.compile(r"\|\s*Unit\s*\d+\s*\|\s*Session\s*\d+", re.I)
STOP = set(
    "the and for with that this from into your what when which their there about have than then they them only also "
    "does each must just more most some such very will would should could while where".split()
)


@dataclass
class Shape:
    paragraphs: list[str]
    x: int | None

    @property
    def text(self) -> str:
        return " ".join(self.paragraphs)


@dataclass
class Slide:
    number: int
    title: str
    shapes: list[Shape]

    @property
    def paragraphs(self) -> list[str]:
        return [p for s in self.shapes for p in s.paragraphs]

    @property
    def text(self) -> str:
        return "\n".join(self.paragraphs)


@dataclass
class GeneratedQuestion:
    prompt: str
    options: list[str]
    answer_index: int
    explanation: str
    slide: int
    slide_title: str
    concept: str = ""


@dataclass
class LectureDeck:
    course_name: str | None = None
    course_code: str | None = None
    unit_number: int | None = None
    session_number: int | None = None
    session_title: str | None = None
    course_outcome: str | None = None
    bloom: str | None = None  # "K3 · Applying"
    program_line: str | None = None
    institution: str | None = None
    outcomes: list[str] = field(default_factory=list)
    assessment_focus: list[str] = field(default_factory=list)
    agenda: list[str] = field(default_factory=list)
    practice_prompts: list[tuple[str, str]] = field(default_factory=list)  # (K-level, question)
    misconceptions: list[tuple[str, str]] = field(default_factory=list)  # (myth, truth)
    questions: list[GeneratedQuestion] = field(default_factory=list)
    slides: list[Slide] = field(default_factory=list)


# ------------------------------------------------------------------ reading


def read_slides(path: str | Path) -> list[Slide]:
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        names.sort(key=lambda n: int(re.search(r"(\d+)\.xml$", n).group(1)))
        return [_read_slide(i + 1, z.read(n)) for i, n in enumerate(names)]


def _read_slide(number: int, xml: bytes) -> Slide:
    root = ET.fromstring(xml)
    shapes: list[Shape] = []
    title = ""
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag == "sp":
            paras = [_para_text(p) for p in el.iter(f"{{{NS['a']}}}p")]
            paras = [p for p in paras if p]
            if not paras:
                continue
            off = el.find("p:spPr/a:xfrm/a:off", NS)
            x = int(off.get("x")) if off is not None else None
            ph = el.find("p:nvSpPr/p:nvPr/p:ph", NS)
            if ph is not None and ph.get("type") in ("title", "ctrTitle") and not title:
                title = " ".join(paras)
                continue
            if FOOTER.search(" ".join(paras)):
                continue
            shapes.append(Shape(paras, x))
        elif tag == "tbl":  # a real PowerPoint table
            for tr in el.findall("a:tr", NS):
                for i, tc in enumerate(tr.findall("a:tc", NS)):
                    text = " ".join(filter(None, (_para_text(p) for p in tc.iter(f"{{{NS['a']}}}p"))))
                    shapes.append(Shape([text or "—"], i))
    if not title and shapes:
        title = shapes.pop(0).text
    return Slide(number, _clean(title), shapes)


def _para_text(p: ET.Element) -> str:
    return _clean("".join(t.text or "" for t in p.iter(f"{{{NS['a']}}}t")))


def _clean(s: str) -> str:
    return " ".join(s.replace(" ", " ").split())


# ----------------------------------------------------------------- parsing


def parse_deck(path: str | Path) -> LectureDeck:
    slides = read_slides(path)
    deck = LectureDeck(slides=slides)
    if slides:
        _parse_title_slide(slides[0], deck)

    for s in slides:
        t = s.title.lower()
        if "learning outcome" in t:
            for p in s.paragraphs:
                m = re.match(r"what the assessment will ask\s*:\s*(.+)", p, re.I)
                if m:
                    deck.assessment_focus.append(_requote(m.group(1)))
                elif not p.isdigit() and len(p) > 25:
                    deck.outcomes.append(p)
        elif t == "agenda" or "agenda" in t:
            deck.agenda = [p for p in s.paragraphs if not re.fullmatch(r"\d{1,2}", p)]
        elif "check your understanding" in t:
            deck.practice_prompts += _practice_prompts(s)

    deck.questions = _questions(deck)
    concepts = deck.agenda or [deck.session_title or "General"]
    for q in deck.questions:
        q.concept = _assign_concept(q, concepts, len(slides))
    return deck


def _parse_title_slide(s: Slide, deck: LectureDeck) -> None:
    lines = [s.title] + s.paragraphs
    for i, line in enumerate(lines):
        if (m := re.search(r"\(?\b([A-Z]{2,5}\s?\d{3,6})\b\)?", line)) and not deck.course_code:
            deck.course_code = m.group(1).replace(" ", "")
            name = line[: m.start()].strip(" -–(")
            deck.course_name = name or (lines[i - 1] if i > 0 else None)
        elif m := re.match(r"Unit\s*(\d+)\s*[-–—:]\s*Session\s*(\d+)\s*[:\-–—]\s*(.+)", line, re.I):
            deck.unit_number, deck.session_number = int(m.group(1)), int(m.group(2))
            deck.session_title = m.group(3).strip()
        elif m := re.search(r"Mapped to\s*(CO\d+)\s*\(Bloom\s*(K\d)\s*[-–—]\s*([A-Za-z]+)\)", line, re.I):
            deck.course_outcome, deck.bloom = m.group(1).upper(), f"{m.group(2).upper()} · {m.group(3).title()}"
        elif "|" in line and re.search(r"semester|batch", line, re.I):
            deck.program_line = line
        elif re.search(r"university|institute|college", line, re.I) and not deck.institution:
            deck.institution = line
    if not deck.course_name:
        deck.course_name = s.title


def _practice_prompts(s: Slide) -> list[tuple[str, str]]:
    out, level = [], None
    for p in s.paragraphs:
        if re.fullmatch(r"K\d", p, re.I):
            level = p.upper()
        elif re.fullmatch(r"\d+\.?", p):
            continue
        elif level and len(p) > 20:
            out.append((level, p))
            level = None
    return out


# --------------------------------------------------------------- tables


def _table_rows(s: Slide) -> list[list[str]]:
    """Recover row-major table cells from text boxes positioned by x-offset."""
    rows: list[list[str]] = []
    prev_x: int | None = None
    for sh in s.shapes:
        if sh.x is None or re.fullmatch(r"S\d+", sh.text):
            continue
        if prev_x is not None and sh.x == prev_x and rows:
            rows[-1][-1] = f"{rows[-1][-1]} {sh.text}"  # one cell split across two boxes
        elif prev_x is None or sh.x < prev_x:
            rows.append([sh.text])
        else:
            rows[-1].append(sh.text)
        prev_x = sh.x
    if not rows:
        return []
    k = Counter(len(r) for r in rows if len(r) >= 2).most_common(1)
    if not k:
        return []
    width = k[0][0]
    table = [r for r in rows if len(r) == width]
    return table if len(table) >= 3 else []  # header + at least two rows


def _questions(deck: LectureDeck) -> list[GeneratedQuestion]:
    out: list[GeneratedQuestion] = []
    for s in deck.slides:
        if "misconception" in s.title.lower():
            pairs = _misconception_pairs(s)
            deck.misconceptions += pairs
            out += _misconception_questions(s, pairs)
            continue
        if NOT_A_TABLE.search(s.title):
            continue
        rows = _table_rows(s)
        if not rows or sum(bool(NUMBERISH.match(h)) for h in rows[0]) * 2 >= len(rows[0]):
            continue
        header, body = rows[0], rows[1:]
        yn_cols = [j for j in range(1, len(header)) if _mostly_yes_no([r[j] for r in body])]
        if len(header) == 3 and yn_cols == [1]:
            out += _true_false(s, body)
        elif yn_cols and len(yn_cols) == len(header) - 1:
            out += _yes_no_matrix(s, header, body)
        else:
            out += _categorical(s, header, body, skip=set(yn_cols))
    return out


def _mostly_yes_no(cells: list[str]) -> bool:
    return sum(bool(YES_NO.match(c)) for c in cells) >= max(2, 0.8 * len(cells))


def _true_false(s: Slide, body: list[list[str]]) -> list[GeneratedQuestion]:
    out = []
    for statement, verdict, why in body:
        if not YES_NO.match(verdict):
            continue
        true = verdict.lower().startswith("yes")
        out.append(
            GeneratedQuestion(
                prompt=f"True or false: {statement}.",
                options=["True", "False"],
                answer_index=0 if true else 1,
                explanation=f"{'True' if true else 'False'}. {why}.",
                slide=s.number,
                slide_title=s.title,
            )
        )
    return out


def _yes_no_matrix(s: Slide, header: list[str], body: list[list[str]]) -> list[GeneratedQuestion]:
    cols = header[1:]
    out = []
    for row in body:
        if not all(YES_NO.match(c) for c in row[1:]):
            continue
        truth = tuple(c.lower().startswith("yes") for c in row[1:])
        label = lambda combo: " · ".join(f"{h}: {'Yes' if v else 'No'}" for h, v in zip(cols, combo))  # noqa: E731
        combos = [tuple(bool(b >> i & 1) for i in reversed(range(len(cols)))) for b in range(2 ** len(cols))]
        rng = random.Random(row[0])
        distractors = rng.sample([c for c in combos if c != truth], k=min(3, len(combos) - 1))
        options = [label(truth)] + [label(c) for c in distractors]
        out.append(
            _shuffled(
                GeneratedQuestion(
                    prompt=f"{s.title}: “{row[0]}”. Which is correct?",
                    options=options,
                    answer_index=0,
                    explanation=" · ".join(f"{h}: {c}" for h, c in zip(cols, row[1:])) + ".",
                    slide=s.number,
                    slide_title=s.title,
                )
            )
        )
    return out


def _categorical(s: Slide, header: list[str], body: list[list[str]], skip: set[int]) -> list[GeneratedQuestion]:
    names = [r[0] for r in body]
    if len(set(names)) < len(names) or len(names) < 2:
        return []
    out = []
    for j in range(1, len(header)):
        cells = [r[j] for r in body]
        if j in skip or len(set(cells)) < len(cells) or any(len(c.split()) > 14 for c in cells):
            continue
        for i, cell in enumerate(cells):
            others = [n for n in names if n != names[i]]
            rng = random.Random(f"{s.number}-{j}-{i}")
            options = [names[i]] + rng.sample(others, k=min(3, len(others)))
            out.append(
                _shuffled(
                    GeneratedQuestion(
                        prompt=f"{header[j]}: “{cell}”. Which {header[0].lower()} is this?",
                        options=options,
                        answer_index=0,
                        explanation=f"{names[i]} — {header[j]}: {cell}.",
                        slide=s.number,
                        slide_title=s.title,
                    )
                )
            )
    return out[:10]


def _misconception_pairs(s: Slide) -> list[tuple[str, str]]:
    """After the two column headers, cells alternate myth, truth, myth, truth..."""
    texts = [sh.text for sh in s.shapes]
    start = next(
        (i + 2 for i in range(len(texts) - 1) if re.search(r"think", texts[i], re.I) and re.search(r"true", texts[i + 1], re.I)),
        None,
    )
    if start is None:
        return []
    cells = texts[start:]
    if len(cells) % 2:
        cells = cells[:-1]  # trailing takeaway sentence
    return [(_strip_quotes(cells[i]), _strip_quotes(cells[i + 1])) for i in range(0, len(cells), 2)]


def _misconception_questions(s: Slide, pairs: list[tuple[str, str]]) -> list[GeneratedQuestion]:
    out = []
    myths = [m for m, _ in pairs]
    for i, (myth, truth) in enumerate(pairs):
        others = [m for m in myths if m != myth]
        rng = random.Random(truth)
        options = [truth, myth] + rng.sample(others, k=min(2, len(others)))
        out.append(
            _shuffled(
                GeneratedQuestion(
                    prompt="Which of these statements is correct?",
                    options=options,
                    answer_index=0,
                    explanation=f"A common misconception is “{myth}”. In fact: {truth}",
                    slide=s.number,
                    slide_title=s.title,
                )
            )
        )
    return out


def _shuffled(q: GeneratedQuestion) -> GeneratedQuestion:
    rng = random.Random(q.prompt + "|".join(q.options))
    order = list(range(len(q.options)))
    rng.shuffle(order)
    q.options = [q.options[i] for i in order]
    q.answer_index = order.index(q.answer_index)
    return q


def _requote(s: str) -> str:
    """"'Define X' — and solve Y" -> "“Define X” — and solve Y" (keeps the quoted ask distinct)."""
    s = s.strip()
    m = re.match(r"^['\"“‘](.+?)['\"”’](\s*[—–-].*)?$", s)
    if m:
        return f"“{m.group(1)}”{m.group(2) or ''}"
    return _strip_quotes(s)


def _strip_quotes(s: str) -> str:
    return s.strip().strip("'\"“”‘’").strip()


# -------------------------------------------------------------- concepts


def _tokens(s: str) -> set[str]:
    words = re.findall(r"[a-z][a-z\-']+", s.lower())
    return {w.rstrip("s") for w in words if len(w) >= 4 and w not in STOP}


def _assign_concept(q: GeneratedQuestion, concepts: list[str], total_slides: int) -> str:
    """Match a question to an agenda item by shared words, else by slide position."""
    text = _tokens(" ".join([q.prompt, q.slide_title, *q.options, q.explanation]))
    scored = [(len(text & _tokens(c)), -i, c) for i, c in enumerate(concepts)]
    best = max(scored)
    if best[0] >= 2:
        return best[2]
    idx = min(len(concepts) - 1, int((q.slide - 1) / max(1, total_slides) * len(concepts)))
    return concepts[idx]


def deck_text(deck: LectureDeck) -> str:
    return "\n\n".join(f"Slide {s.number}: {s.title}\n{s.text}" for s in deck.slides)
