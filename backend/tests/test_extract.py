from fixtures import make_deck, make_timetable

from app.extract.slides import parse_deck
from app.extract.timetable import DAYS, parse_timetable


def test_deck_metadata_and_evidence(tmp_path):
    deck = parse_deck(make_deck(tmp_path / "s.pptx"))
    assert deck.course_name == "Data Structures"
    assert deck.course_code == "CSE20101"
    assert (deck.unit_number, deck.session_number) == (3, 4)
    assert deck.session_title == "Stacks and Queues"
    assert deck.course_outcome == "CO3" and deck.bloom == "K3 · Applying"
    assert deck.agenda == ["Stack operations", "Queue operations"]
    assert deck.assessment_focus == ["“Compare a stack and a queue with an example”"]
    assert deck.practice_prompts == [("K2", "Why does a stack overflow when it is full?")]
    assert deck.misconceptions[0] == ("A stack is a kind of queue", "Stacks and queues differ in removal order")


def test_deck_questions(tmp_path):
    deck = parse_deck(make_deck(tmp_path / "s.pptx"))
    tf = [q for q in deck.questions if q.prompt.startswith("True or false")]
    assert len(tf) == 2
    lifo = next(q for q in tf if "most recently added" in q.prompt and "stack" in q.prompt.lower())
    assert lifo.options[lifo.answer_index] == "True"
    mc = [q for q in deck.questions if "statements is correct" in q.prompt]
    assert len(mc) == 2
    for q in mc:
        assert q.options[q.answer_index] in {"Stacks and queues differ in removal order", "Pop returns the removed item"}
    assert all(q.concept in deck.agenda for q in deck.questions)


def test_timetable_grid(tmp_path):
    (tt,) = parse_timetable(make_timetable(tmp_path / "t.pdf"))
    assert tt.label == "B.TECH SEM 3 Z" and tt.semester == 3 and tt.section == "Z"
    assert tt.effective_from == "2026-09-07"
    assert [(p.number, p.start) for p in tt.periods] == [(1, "8:50"), (2, "10:00"), (3, "11:10")]
    got = {(DAYS[s.day], tuple(s.periods), s.subject, s.group) for s in tt.slots}
    assert got == {
        ("Mo", (1,), "Data Structures", None),
        ("Mo", (2, 3), "Data Structures Lab", 1),
        ("Mo", (2, 3), "Physics Lab", 2),
        ("Tu", (1,), "Discrete Mathematics", None),
    }
    lab = next(s for s in tt.slots if s.group == 1)
    assert lab.room == "Lab 1-A" and lab.faculty == "Dr. Alan Turing" and lab.kind == "lab"
