# Margin API contract

The React frontend talks to the backend only through `frontend/src/api/client.ts`. With no `VITE_API_URL` set, every request is answered by the in-browser mock in `frontend/src/api/mock/`. That mock follows this document, so the FastAPI service can replace it endpoint by endpoint.

- JSON in and out. Field names are **camelCase**. In Pydantic, use `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)` and return with `by_alias=True`.
- Dates are `YYYY-MM-DD`. Timestamps are ISO 8601 with a timezone.
- Errors return a non-2xx status with `{"detail": "Human-readable message"}`, which is FastAPI's default. The UI shows `detail` to the user as-is, so write it for a student to read.
- Response shapes are defined in [`frontend/src/api/types.ts`](../frontend/src/api/types.ts). Treat that file as the schema.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/overview` | — | `Overview` (data for the Today page) |
| GET | `/subjects` | — | `Subject[]` |
| GET | `/subjects/{id}` | — | `{ subject, units: Unit[], topics: Topic[] }` |
| GET | `/units` | — | `Unit[]` |
| GET | `/topics?subjectId=&tier=` | — | `Topic[]`, sorted by `priority.score` descending |
| GET | `/topics/{id}` | — | `TopicDetail` (topic + evidence + concept stats) |
| PATCH | `/topics/{id}` | `{ status }` | `Topic` with its score recomputed |
| GET | `/sources` | — | `Source[]`, newest first |
| POST | `/sources` | multipart file + `kind`, `subjectId` | `Source` with `status: "queued"` |
| POST | `/sources/{id}/retry` | — | `Source`. Returns 400 when `retryable` is `false` |
| DELETE | `/sources/{id}` | — | `{ ok: true }`. Evidence from this file stops counting |
| GET | `/concepts` | — | `ConceptStat[]`, weakest first |
| GET | `/quizzes` | — | `Quiz[]`, newest first |
| POST | `/quizzes` | `{ mode: "weak" \| "priority" \| "topics", topicIds?, count? }` | `Quiz` |
| GET | `/quizzes/{id}` | — | `Quiz` |
| POST | `/quizzes/{id}/submit` | `{ answers: (number \| null)[] }` | `Quiz` with `score`; updates concept history |
| GET | `/plan` | — | `Plan` |
| POST | `/plan` | `{ hoursPerDay, restDays }` | `Plan`. Keeps past and completed sessions, reschedules the rest |
| PATCH | `/plan/sessions/{id}` | `{ done }` | `PlanSession` |
| GET | `/labs` | — | `{ labs: LabCourse[], experiments: Experiment[] }` |
| PATCH | `/experiments/{id}` | `Partial<Experiment>` | `Experiment` (`checklist` is merged, not replaced) |

The mock's `POST /sources` takes JSON metadata (`filename`, `sizeKb`, `kind`, `subjectId`) because it has nowhere to store the file. The real endpoint should accept `multipart/form-data`. When you switch, change only `useUploadSource` in `hooks.ts`.

The UI polls `GET /sources` every 1.2 s while any source is `queued` or `processing`. Document processing should run as a background task that updates `status` and fills in `extracted` when it finishes.

## Priority model

This is the core of the product. Every score has to be explainable, so the API returns the factors behind it, not just the number. Reference implementation: [`frontend/src/api/mock/scoring.ts`](../frontend/src/api/mock/scoring.ts).

Each factor is a value from 0 to 1, multiplied by its weight. The score is the weighted sum × 100.

| Factor | Weight | Value |
|---|---|---|
| Exam frequency | 0.30 | Past papers that asked the topic ÷ papers analysed for the subject |
| Marks when asked | 0.15 | Average marks per question about the topic ÷ 10, capped at 1 |
| Syllabus weight | 0.10 | The topic's share of its unit's lecture hours ÷ the largest such share in the subject |
| Your weakness | 0.25 | 1 − quiz accuracy. Counts as 0.5 until the topic has 3 answers |
| Not yet covered | 0.20 | Not started = 1, in progress = 0.5, done = 0.15 |

Tiers: **high** at 72 or above, **medium** at 58–71, **low** below 58.

Each `PriorityFactor.detail` is a plain sentence the UI shows as-is, for example "Asked in 5 of 6 past papers" or "38% correct over 8 quiz answers". Keep these specific. They are the evidence.

A concept counts as **weak** when it has at least 3 answers and accuracy below 60% (`frontend/src/lib/constants.ts`).

## Document processing (backend to-do)

The UI needs these from extraction:

1. **Syllabus**: units with lecture hours, and the topics in each unit.
2. **Past papers**: each question's paper session (e.g. "End-Sem May 2024"), question number, marks and text, matched to one or more topics. Store the matched terms; the UI highlights them in `Evidence.excerpt`.
3. **Notes**: short excerpts linked to topics, shown as supporting evidence.
4. **Exam pattern**: parts, number of questions, how many to attempt, and marks each (`Subject.examPattern`).

Every `Evidence` row keeps the `sourceId` it came from, so deleting a source removes its evidence and the priorities change to match.
