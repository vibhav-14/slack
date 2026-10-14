from fastapi.testclient import TestClient
from fixtures import make_deck, make_timetable

from app.main import app


def test_full_flow(tmp_path):
    with TestClient(app) as c:
        assert c.patch("/profile", json={"classLabel": "B.TECH SEM 3 Z", "labGroup": 1}).status_code == 200

        tt = make_timetable(tmp_path / "timetable.pdf")
        r = c.post("/sources", data={"kind": "timetable"}, files={"file": ("timetable.pdf", tt.read_bytes(), "application/pdf")})
        assert r.status_code == 200
        src = next(s for s in c.get("/sources").json() if s["id"] == r.json()["id"])
        assert src["status"] == "ready", src

        deck = make_deck(tmp_path / "ds.pptx")
        r = c.post("/sources", data={"kind": "slides"}, files={"file": ("ds.pptx", deck.read_bytes(), "application/octet-stream")})
        src = next(s for s in c.get("/sources").json() if s["id"] == r.json()["id"])
        assert src["status"] == "ready", src
        assert src["extracted"]["questions"] == 4

        subjects = {s["name"]: s for s in c.get("/subjects").json()}
        assert subjects["Data Structures"]["code"] == "CSE20101"  # slides upgraded the timetable's abbreviation
        assert "Discrete Mathematics" in subjects

        labs = c.get("/labs").json()["labs"]
        assert {lab["name"] for lab in labs} == {"Data Structures Lab", "Physics Lab"}

        (topic,) = c.get("/topics").json()
        assert topic["title"] == "Stacks and Queues"
        assert topic["priority"]["tier"] in {"high", "medium", "low"}
        detail = c.get(f"/topics/{topic['id']}").json()
        assert {e["kind"] for e in detail["evidence"]} >= {"assessment", "syllabus", "slides"}

        quiz = c.post("/quizzes", json={"mode": "topics", "topicIds": [topic["id"]], "count": 4}).json()
        wrong = [(q["answerIndex"] + 1) % len(q["options"]) for q in quiz["questions"]]
        done = c.post(f"/quizzes/{quiz['id']}/submit", json={"answers": wrong}).json()
        assert done["score"] == 0
        after = c.get(f"/topics/{topic['id']}").json()
        assert after["mastery"] == 0
        assert after["priority"]["score"] > topic["priority"]["score"]

        plan = c.get("/plan").json()
        assert plan["sessions"] and all(s["reason"] for s in plan["sessions"])

        lab_id = labs[0]["id"]
        exp = c.post(f"/labs/{lab_id}/experiments", json={"title": "Stack using arrays"}).json()
        exp = c.patch(f"/experiments/{exp['id']}", json={"status": "draft", "checklist": {"aim": True}}).json()
        assert exp["status"] == "draft" and exp["checklist"]["aim"] and not exp["checklist"]["code"]

        overview = c.get("/overview").json()
        assert {"todayClasses", "todaySessions", "subjects"} <= overview.keys()

        bad = c.post("/sources", data={"kind": "notes"}, files={"file": ("photo.heic", b"x", "image/heic")}).json()
        bad = next(s for s in c.get("/sources").json() if s["id"] == bad["id"])
        assert bad["status"] == "failed" and bad["retryable"] is False
        assert c.post(f"/sources/{bad['id']}/retry").status_code == 400
