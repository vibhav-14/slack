# Who did what

Slack is a study workspace that turns a student's timetable, lecture slides, syllabus and past papers into ranked topics, quizzes and a revision plan. The three of us split the work as follows.

| | Vibhav Bhardwaj | Lakshay Kumar | Suyash Rawat |
|---|---|---|---|
| **Area** | Architecture, scoring and backend core | Document processing, data and tests | Frontend and interface design |
| **Commits** | 5 | 6 | 5 |
| **Lines added** (excluding lockfile) | ~5,100 | ~4,500 | ~3,600 |
| **GitHub** | @vibhav-14 | @lakshay-kumar27 | @SuyashRawat2 |

## Vibhav Bhardwaj: project lead, architecture and backend core

- Set up the React + Vite + TypeScript workspace, the design tokens and the product brief (`PRODUCT.md`).
- Designed the **evidence-based priority model**: six factors (exam frequency, marks, syllabus weight, assessment signals, weakness, coverage). Factors with no data are left out and the rest rescaled, never scored as zero.
- Built the **FastAPI backend**: SQLite data model, the REST API (`backend/app/api.py`), scoring and the read layer.
- Wrote the **timetable-aware revision planner**, which moves a subject up on days it has a class.
- Wrote the API types and client, the routes, the README and `docs/api.md`. Led the rename to Slack.

## Lakshay Kumar: document processing, data and testing

- Built the **document pipeline** (`backend/app/extract/`, `services/ingest.py`):
  - **Timetable parser**: maps each class card of an aSc Timetables PDF onto the day/period grid using its ruled lines, including Group 1/2 lab splits.
  - **Slide extractor**: pulls topics, "What the assessment will ask", "Check your understanding" questions with Bloom levels, and misconceptions from `.pptx` decks. It generates quiz questions from the slides' rule tables, comparison tables and misconceptions without AI.
  - **PDF parsers**: syllabus units and hours, past-paper questions and marks, notes.
  - Optional Claude-written questions, and the `bootstrap` loader.
- Wrote the **backend test suite** with synthetic slide and timetable fixtures (10 tests).
- Built the demo semester data, and the evidence-heavy pages: Priorities, Subject, Topic, Lab records, Sources and Settings.
- Fixed uploads breaking when the project folder moves.

## Suyash Rawat: frontend and interface design

- Built the **app shell and shared components**, and the Today, Revision plan, Practice, Quiz and Weak spots pages.
- **Connected the frontend to the API** and removed the mock backend.
- Built the **Timetable page** (weekly grid on desktop, day lists on phones) and today's classes on the Today page.
- Designed and built the **"marked answer sheet" redesign**:
  - a red margin line, with scores, times and Bloom levels written in the margin
  - a mark sheet for every score
  - pen ticks and crosses on quiz results
  - a textbook slab-serif heading font
  - a masthead in place of the icon sidebar
  - AAA text contrast in light and dark themes

## Timeline

| Date | Milestone |
|---|---|
| 13 Oct | Frontend with a mock backend: scoring model, all pages, demo data |
| 14 Oct | FastAPI backend, document pipeline, tests, Timetable page, rename to Slack |
| 17 Nov | Upload-path fix and the answer-sheet redesign |

To check against the history: `git shortlog -sne` and `git log --author="<name>"`.
