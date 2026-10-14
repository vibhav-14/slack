# Slack API

FastAPI service in `backend/`. The React app reaches it only through `frontend/src/api/client.ts`. In development, Vite proxies `/api/*` to `http://127.0.0.1:8000`; you can also set `VITE_API_URL` to call it directly.

- JSON in and out, camelCase field names. Response shapes are built in `backend/app/services/views.py` and typed in `frontend/src/api/types.ts`. Keep the two in step.
- Errors are a non-2xx status with `{"detail": "..."}`. The UI shows `detail` to the student as-is, so write it in plain language.
- Storage is SQLite at `backend/data/slack.db`, with uploads in `backend/data/uploads/`. Both are git-ignored.
- Interactive docs are at `http://127.0.0.1:8000/docs` while the server runs.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/overview` | — | Today page: subjects with coverage, `todayClasses`, `todaySessions`, due records, weakest concepts |
| GET / PATCH | `/profile` | `{ classLabel?, labGroup?, hoursPerDay?, restDays? }` | Profile, plus `aiAvailable` |
| GET | `/timetable` | — | `{ classLabel, labGroup, periods, slots, availableClasses }` (slots for both lab groups) |
| GET | `/subjects` | — | `Subject[]` |
| GET | `/subjects/{id}` | — | `{ subject, units, topics }` |
| PATCH | `/subjects/{id}` | `{ examDate?, name?, code? }` | `Subject`. Setting `examDate` marks it confirmed |
| GET | `/units` | — | `Unit[]` |
| GET | `/topics?subjectId=&tier=` | — | `Topic[]`, highest score first |
| GET | `/topics/{id}` | — | `TopicDetail` (evidence, concept stats, question counts) |
| PATCH | `/topics/{id}` | `{ status }` | `Topic`, re-scored |
| POST | `/topics/{id}/questions` | — | `{ added }`. Claude writes more questions from the topic's slides (needs `ANTHROPIC_API_KEY`) |
| GET | `/sources` | — | `Source[]`, newest first |
| POST | `/sources` | multipart: `file`, `kind`, `subjectId?` | `Source` (`queued`). Processed in a background task |
| POST | `/sources/{id}/retry` | — | Re-processes the file. 400 if `retryable` is false |
| DELETE | `/sources/{id}` | — | Removes the file and its evidence and questions, plus any topics left with nothing |
| GET | `/concepts` | — | `ConceptStat[]`, weakest first |
| GET / POST | `/quizzes` | `{ mode: "weak" \| "priority" \| "topics", topicIds?, count? }` | `Quiz`. Questions are snapshotted into the quiz |
| GET | `/quizzes/{id}` | — | `Quiz` |
| POST | `/quizzes/{id}/submit` | `{ answers: (number \| null)[] }` | `Quiz` with `score`. Records one `Answer` per question |
| GET | `/plan` | — | `Plan`. Built on first request if none exists |
| POST | `/plan` | `{ hoursPerDay, restDays }` | `Plan`. Keeps past and completed sessions, reschedules the rest |
| PATCH | `/plan/sessions/{id}` | `{ done }` | `PlanSession` |
| GET | `/labs` | — | `{ labs, experiments }` |
| PATCH | `/labs/{id}` | `{ practicalExamDate }` | `LabCourse` |
| POST | `/labs/{id}/experiments` | `{ title, aim?, due? }` | `Experiment` |
| PATCH / DELETE | `/experiments/{id}` | `Partial<Experiment>` | `checklist` is merged, not replaced |
| POST | `/experiments/{id}/attachments` | multipart `file` | `Experiment` |

Source kinds: `timetable`, `slides`, `syllabus`, `past_paper`, `notes`, `exam_pattern`.

## Document processing

`backend/app/services/ingest.py` sends each file to an extractor. Re-processing a file first deletes everything it produced, so a retry never creates duplicates and never loses quiz progress.

| Input | Extractor | Produces |
|---|---|---|
| Timetable PDF (aSc Timetables export) | `extract/timetable.py` | Periods, and slots for the student's class (lab groups included); creates subjects (with faculty) and lab courses |
| Lecture slides (`.pptx`) | `extract/slides.py` | One topic per session; agenda items become concepts; evidence from "What the assessment will ask", "Check your understanding" (with Bloom level), course outcome and misconceptions; rule-based quiz questions |
| Syllabus PDF | `extract/pdf.py` | Units, lecture hours, topics |
| Past paper PDF | `extract/pdf.py` | Questions with marks and session, matched to topics by shared words |
| Notes (PDF/TXT) | `extract/pdf.py` | Paragraphs matched to topics |

Images and scanned PDFs fail with `retryable: false` and a message, because OCR isn't set up.

**Timetable parsing.** Every class is a box bounded by ruled lines. The parser finds the box around each text span, groups spans by box, and maps each box onto day rows and period columns. A two-period lab split into Group 1 and Group 2 becomes two slots.

**Quiz questions from slides, without AI.** Tables in these decks are grouped text boxes rather than PowerPoint tables, so rows are recovered from the boxes' x-offsets. Each table shape becomes a question type:

- Statement, Yes/No, reason (e.g. "The Rules of abstract") → true or false, with the reason as the explanation.
- Feature × Yes/No columns (e.g. abstract class vs ordinary class) → multiple choice over the Yes/No combinations.
- Categorical tables (e.g. relationship × UML symbol × example) → "UML Symbol: “Hollow diamond”. Which relationship is this?"
- "Misconceptions, Cleared" → the true statement against the myths.

Slides titled Agenda, Summary, Activity and similar are skipped.

**Optional Claude questions.** When `ANTHROPIC_API_KEY` is set, `services/claude_gen.py` asks `claude-opus-5-5` for four-option questions grounded only in the deck's text, using structured JSON output, each tagged with a concept from the agenda and the slide it came from. Refusals and API errors are recorded on the source (`extracted.aiError`); the rule-based questions are always kept.

## Priority model

`backend/app/services/scoring.py`. Each factor is a value from 0 to 1 multiplied by a weight. **A factor with no evidence behind it is `available: false` and left out**, and the remaining weights are scaled up to sum to 1 (`effectiveWeight`). Missing past papers therefore never count as "never examined".

| Factor | Weight | Value | Unavailable when |
|---|---|---|---|
| Exam frequency | 0.25 | Papers that asked the topic ÷ papers uploaded for the subject | No past papers uploaded |
| Marks when asked | 0.10 | Average marks per question ÷ 10 | No past papers uploaded |
| Syllabus weight | 0.10 | The topic's share of its unit's hours ÷ the largest share in the subject | Lecture hours unknown |
| Assessment signals | 0.15 | (assessment cues × 1 + practice questions weighted by Bloom level) ÷ 1.5, capped at 1 | No slides for the topic |
| Your weakness | 0.25 | 1 − quiz accuracy (0.5 until 3 answers) | — |
| Not yet covered | 0.15 | Not started 1, in progress 0.5, done 0.15 | — |

Tiers: **high** at 65 or above, **medium** at 45–64, **low** below 45. A concept is **weak** with at least 3 answers and under 60% correct.

## Planner

`backend/app/services/planner.py`. Works day by day from today up to each subject's exam, highest priority first, within `hoursPerDay`, skipping rest days. Not-started topics get a 60-minute study session, others a revise session; a practice quiz follows two days later, and high-priority topics get a final revision in the week before the exam.

It reads the timetable in two ways:

- A topic whose subject has a lecture or lab that day moves to the front of the queue, with the reason "OOP lab today at 8:50 — revise while it's fresh".
- Days with 6 or more class periods get 30 minutes less study time.

Every session stores a one-line `reason`.
