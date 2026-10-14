# Slack

An academic workspace that turns your timetable, lecture slides, syllabi and past papers into a personal study system.

Slack ranks topics by **evidence**, not guesswork. The evidence is what your slides say the assessment will ask, Bloom levels, how often a topic appears in past papers and the marks it carries, and how well you actually answer quiz questions on it. Every score shows its reasons. From that ranking Slack builds quizzes and a revision plan that fits around your class timetable, tracks weak concepts and completed units, and keeps your lab records in order.

## What's here

| Path | What |
|---|---|
| `backend/` | FastAPI + SQLite: document processing, scoring, planner, quiz engine |
| `backend/app/extract/` | Timetable PDF parser, `.pptx` slide extractor, syllabus and past-paper PDF parsers |
| `backend/tests/` | Pytest suite with synthetic slide and timetable fixtures |
| `frontend/` | React + TypeScript + Vite app |
| `docs/api.md` | Endpoints, document processing, priority model, planner |
| `PRODUCT.md` | Who it's for, design principles, accessibility targets |

## Run it

Requires Python 3.11+ and Node 18+.

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (in another terminal)

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints. It proxies `/api` to the backend.

**Load your material.** Upload it on the Sources page, or bootstrap from files on disk:

```bash
cd backend
python -m app.bootstrap --reset --class "B.TECH SEM 3 A" --group 1 "path/to/timetable.pdf" "path/to/U2S08.pptx" "path/to/U2S09.pptx"
```

`--class` must match the label printed on your class's timetable page. The timetable is processed first so subjects and labs exist before the slides arrive.

**Optional: Claude-written questions.** Set `ANTHROPIC_API_KEY` before starting the backend. Claude then writes extra quiz questions grounded only in each deck's text, and topic pages get a "Write more with Claude" button. Without a key, quiz questions still come from the slides' own tables and misconceptions.

## Tests

```bash
cd backend
pytest
```

```bash
cd frontend
npm run build
```

## Configuration

| Variable | Default | |
|---|---|---|
| `SLACK_DATA_DIR` | `backend/data` | Database and uploads |
| `SLACK_DEFAULT_EXAM_DATE` | `2026-11-30` | Used for planning until real exam dates are set in Settings |
| `ANTHROPIC_API_KEY` | — | Enables Claude-written questions |
| `SLACK_CLAUDE_MODEL` | `claude-opus-5-5` | Model for question writing |
| `VITE_API_URL` | `/api` (proxied) | Frontend: call the API at a different address |

Your uploaded files and database live in `backend/data/`, which git ignores. Course material never goes into the repo.
