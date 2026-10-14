"""Build small synthetic .pptx and timetable .pdf files that mimic the real
formats, so tests don't depend on (or redistribute) course material."""

from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

import pymupdf

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"


def _sp(paragraphs: list[str], x: int = 0, title: bool = False) -> str:
    ph = '<p:nvPr><p:ph type="title"/></p:nvPr>' if title else "<p:nvPr/>"
    paras = "".join(f"<a:p><a:r><a:t>{escape(t)}</a:t></a:r></a:p>" for t in paragraphs)
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="1" name="s"/><p:cNvSpPr/>{ph}</p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>'
        f"<p:txBody>{paras}</p:txBody></p:sp>"
    )


def _slide(shapes: list[str]) -> str:
    return f'<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>{"".join(shapes)}</p:spTree></p:cSld></p:sld>'


def make_deck(path: Path) -> Path:
    footer = _sp(["Data Structures (CSE20101) | Unit 3 | Session 4"], 400)
    slides = [
        _slide(
            [
                _sp(["Data Structures", "(CSE20101)"], title=True),
                _sp(["Unit 3 - Session 4: Stacks and Queues", "Mapped to CO3 (Bloom K3 - Applying)"]),
                _sp(["Example University", "B.Tech CSE | Semester III | Batch 2025-29"]),
            ]
        ),
        _slide(
            [
                _sp(["Session Learning Outcomes"], title=True),
                _sp(["Implement a stack using an array and explain its LIFO behaviour."]),
                _sp(["What the assessment will ask: 'Compare a stack and a queue with an example'"]),
                footer,
            ]
        ),
        _slide([_sp(["Agenda"], title=True), _sp(["01"]), _sp(["Stack operations"]), _sp(["02"]), _sp(["Queue operations"]), footer]),
        _slide(
            [
                _sp(["The Rules of stacks"], title=True),
                _sp(["Rule"], 0), _sp(["True?"], 100), _sp(["Why"], 200),
                _sp(["A stack removes the most recently added item"], 0), _sp(["Yes"], 100), _sp(["That is LIFO"], 200),
                _sp(["A queue removes the most recently added item"], 0), _sp(["No"], 100), _sp(["Queues are FIFO"], 200),
                footer,
            ]
        ),
        _slide(
            [
                _sp(["Misconceptions, Cleared"], title=True),
                _sp(["Students often think"], 10), _sp(["What is actually true"], 300),
                _sp(["A stack is a kind of queue"], 10), _sp(["Stacks and queues differ in removal order"], 10),
                _sp(["Pop returns nothing"], 10), _sp(["Pop returns the removed item"], 10),
                footer,
            ]
        ),
        _slide([_sp(["Check Your Understanding"], title=True), _sp(["K2"]), _sp(["1."]), _sp(["Why does a stack overflow when it is full?"]), footer]),
    ]
    with zipfile.ZipFile(path, "w") as z:
        for i, s in enumerate(slides, 1):
            z.writestr(f"ppt/slides/slide{i}.xml", s)
    return path


def make_timetable(path: Path, label: str = "B.TECH SEM 3 Z") -> Path:
    """Two days x three periods; Monday has a two-period lab split into groups."""
    doc = pymupdf.open()
    page = doc.new_page(width=792, height=612)
    xs = [20, 120, 260, 400, 540]  # day column, then periods 1..3
    ys = [80, 140, 260, 380]  # header, Mo, Tu
    for x in xs:
        page.draw_line((x, ys[0]), (x, ys[1]))  # header row
        page.draw_line((x, ys[2]), (x, ys[3]))  # Tuesday row
    for x in (xs[0], xs[1]):
        page.draw_line((x, ys[1]), (x, ys[2]))  # Monday: only the day column is ruled; cards supply the rest
    for y in ys:
        page.draw_line((xs[0], y), (xs[-1], y))
    page.insert_text((300, 40), label, fontsize=14)
    for i, (start, end) in enumerate([("8:50", "9:50"), ("10:00", "11:00"), ("11:10", "12:10")]):
        x0 = xs[i + 1] + 50
        page.insert_text((x0, ys[0] + 25), str(i + 1), fontsize=20)
        page.insert_text((x0 - 20, ys[0] + 50), f"{start} - {end}", fontsize=8)
    page.insert_text((40, ys[1] + 60), "Mo", fontsize=24)
    page.insert_text((40, ys[2] + 60), "Tu", fontsize=24)

    def card(x0, y0, x1, y1, lines):
        page.draw_rect((x0, y0, x1, y1))
        for j, t in enumerate(lines):
            page.insert_text((x0 + 4, y0 + 14 + j * 14), t, fontsize=8)

    # Erase the period-2/3 divider inside Monday's lab card by drawing the card over both columns.
    card(xs[1], ys[1], xs[2], ys[2], ["Data Structures", "CR2", "Dr. Ada Lovelace"])
    card(xs[2], ys[1], xs[4], ys[1] + 60, ["Data Structures Lab", "Group 1", "Lab 1-A", "Dr. Alan Turing"])
    card(xs[2], ys[1] + 60, xs[4], ys[2], ["Physics Lab", "Group 2", "Lab 2-B", "Dr. Marie Curie"])
    card(xs[1], ys[2], xs[2], ys[3], ["Discrete Mathematics", "CR5", "Dr. Emmy Noether"])
    page.insert_text((20, 600), "w.e.f  07-09-2026", fontsize=8)
    doc.save(path)
    return path
