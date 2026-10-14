# Product

## Register

product

## Users

A single university student (working example: B.Tech CSE, semester 5) managing their own subjects. They open it on a laptop in the evening or between classes, and on their phone the night before an exam. They arrive with a pile of material — the official syllabus PDF, scanned notes, five or six past end-semester papers, the exam pattern from the department notice — and limited time. The job: know what to study next, and prove to themselves they actually know it.

## Product Purpose

Slack turns syllabi, notes and exam patterns into a personal study system. It does not just generate notes. It ranks topics by evidence — how often a topic appears in past papers, how many marks it carries, how much syllabus time it gets, and how the student is actually performing on it — and shows that evidence next to every ranking. From that ranking it builds quizzes and a day-by-day revision plan, tracks weak concepts and completed units, and keeps lab records and practical submissions in order.

Success: the student can open the app, see the three things worth doing today, and understand *why* each one was chosen.

## Brand Personality

Calm, exact, trustworthy. A well-kept notebook rather than a tutor that talks at you. Voice is plain and specific ("Appeared in 4 of 6 papers, avg 9 marks") — never motivational filler, never exclamation marks, never "AI-powered". The interface should feel like Notion: document-first, quiet, generous whitespace, content in the foreground.

## Anti-references

- Anything that looks AI-generated: purple/blue gradients, gradient text, glassy cards, sparkle icons, "✨ Generate with AI" buttons, chatbot bubbles as the main interface.
- SaaS hero-metric dashboards (giant number + tiny label + trend arrow tiles).
- Gamified study apps: streak flames, confetti, mascots, XP bars.
- Cluttered university ERP portals: dense tables with no hierarchy, tiny grey text.

## Design Principles

1. **Show the evidence.** Every priority, weak concept and plan item links back to the source material that produced it. A score without its reasons is not shown.
2. **Today first.** The default view answers "what do I do now?" before anything else.
3. **The document is the interface.** Pages read like well-structured notes: a title, a property row, then content. Tables and lists over cards.
4. **Quiet until it matters.** Colour is reserved for priority, state and the highlighter for evidence; everything else is ink on white.
5. **Readable by everyone.** Legibility is a feature, not a setting buried away.

## Accessibility & Inclusion

- Target WCAG 2.2 AAA for text contrast (7:1 body, 4.5:1 large), AA minimum everywhere else.
- Dyslexia-friendly defaults: Atkinson Hyperlegible typeface, 16px minimum body, 1.6 line height, left-aligned ragged-right text, no long italic passages, no justified text.
- User-adjustable text size and line spacing; light, dark and system themes.
- Priority and status never rely on colour alone (text label + glyph).
- Full keyboard operation with visible focus; `prefers-reduced-motion` respected.
