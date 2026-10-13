# Margin

An academic workspace that turns syllabi, notes and exam patterns into a personal study system.

Margin ranks topics by **evidence**, not by guessing. The evidence is how often each topic appears in past papers, how many marks it carries, how much syllabus time it gets, and how well you actually answer quiz questions on it. From that ranking it builds quizzes and a day-by-day revision plan. It tracks weak concepts and completed units, and keeps lab records and practical submissions in order.

## What's here

| Path | What |
|---|---|
| `frontend/` | React + TypeScript + Vite app |
| `frontend/src/api/` | API client, React Query hooks, types (the schema), and an in-browser mock backend |
| `frontend/src/pages/` | Today, Priorities, Subject, Topic, Revision plan, Practice and quiz, Weak concepts, Lab records, Sources, Settings |
| `docs/api.md` | Endpoint contract and priority model for the FastAPI backend |
| `PRODUCT.md` | Who it's for, design principles, accessibility targets |

## Run it

Requires Node 18 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. With no backend configured, the app loads a demo semester (DBMS, OS and Computer Networks, with six past papers each) and saves your progress in the browser. **Settings → Reset demo data** starts over.

To use a real backend:

```bash
VITE_API_URL=http://localhost:8000 npm run dev
```

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build to `frontend/dist` |
| `npm run typecheck` | Type-check only |

## Design

- Notion-like and document-first: a page title, a row of properties, then content. Tables and lists rather than cards.
- One cobalt accent for actions and selection. A highlighter yellow is used only on evidence. Red, amber and grey mark priority tiers, and each tier also has a text label and a bar glyph, so colour is never the only signal.
- Atkinson Hyperlegible typeface, AAA text contrast, and adjustable text size and spacing. Light, dark and system themes.
- Design tokens live in `frontend/src/styles/tokens.css` (OKLCH).

## Next steps

- FastAPI backend implementing `docs/api.md`
- Document processing pipeline: PDF and scan text extraction, then question-to-topic matching
- Question generation for topics that don't have quiz questions yet
