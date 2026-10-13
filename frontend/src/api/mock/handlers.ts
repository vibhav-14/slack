// Route table for the mock API. Paths and payloads match docs/api.md so the
// real FastAPI service can be dropped in by setting VITE_API_URL.

import type {
  Experiment,
  Overview,
  Plan,
  Quiz,
  Source,
  SourceKind,
  TopicDetail,
  TopicStatus,
} from "../types";
import { today, todayISO } from "../../lib/dates";
import { allTopics, conceptStats, getDB, NotFound, resetDB, save, topicView } from "./db";
import { buildPlan } from "./planner";
import { isWeak } from "../../lib/constants";

type Params = Record<string, string>;
type Handler = (params: Params, query: URLSearchParams, body: unknown) => unknown;

const routes: [method: string, pattern: string, handler: Handler][] = [];
const route = (method: string, pattern: string, handler: Handler) => routes.push([method, pattern, handler]);

const QUEUE_MS = 1500;
const PROCESS_MS = 5000;

// --------------------------------------------------------------- overview

route("GET", "/overview", () => {
  const d = getDB();
  const topics = allTopics(d);
  const now = todayISO();
  const result: Overview = {
    subjects: d.subjects.map((s) => {
      const ts = topics.filter((t) => t.subjectId === s.id);
      const units = d.units.filter((u) => u.subjectId === s.id);
      return {
        ...s,
        topicsTotal: ts.length,
        topicsDone: ts.filter((t) => t.status === "done").length,
        unitsTotal: units.length,
        unitsDone: units.filter((u) => ts.filter((t) => t.unitId === u.id).every((t) => t.status === "done")).length,
      };
    }),
    todaySessions: d.plan.sessions.filter((s) => s.date === now),
    dueExperiments: d.experiments
      .filter((e) => e.status !== "checked" && e.status !== "written")
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 5),
    weakest: weakConcepts().slice(0, 4),
    recentSources: [...sources()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 3),
  };
  return result;
});

// --------------------------------------------------------------- subjects

route("GET", "/subjects", () => getDB().subjects);

route("GET", "/units", () => getDB().units);

route("GET", "/subjects/:id", ({ id }) => {
  const d = getDB();
  const subject = d.subjects.find((s) => s.id === id);
  if (!subject) throw new NotFound(`Subject ${id} not found`);
  return {
    subject,
    units: d.units.filter((u) => u.subjectId === id),
    topics: allTopics(d).filter((t) => t.subjectId === id),
  };
});

// ----------------------------------------------------------------- topics

route("GET", "/topics", (_p, q) => {
  let topics = allTopics(getDB());
  const subjectId = q.get("subjectId");
  const tier = q.get("tier");
  if (subjectId) topics = topics.filter((t) => t.subjectId === subjectId);
  if (tier) topics = topics.filter((t) => t.priority.tier === tier);
  return topics.sort((a, b) => b.priority.score - a.priority.score);
});

route("GET", "/topics/:id", ({ id }) => {
  const d = getDB();
  const detail: TopicDetail = {
    ...topicView(d, id),
    evidence: d.evidence.filter((e) => e.topicId === id),
    conceptStats: conceptStats(d, id),
  };
  return detail;
});

route("PATCH", "/topics/:id", ({ id }, _q, body) => {
  const d = getDB();
  const t = d.topics.find((x) => x.id === id);
  if (!t) throw new NotFound(`Topic ${id} not found`);
  const { status } = body as { status: TopicStatus };
  t.status = status;
  save();
  return topicView(d, id);
});

// ---------------------------------------------------------------- sources

function sources(): Source[] {
  const d = getDB();
  const now = Date.now();
  let changed = false;
  for (const s of d.sources) {
    if (s.status !== "queued" && s.status !== "processing") continue;
    const age = now - new Date(s.uploadedAt).getTime();
    const next = age < QUEUE_MS ? "queued" : age < PROCESS_MS ? "processing" : "ready";
    if (next !== s.status) {
      s.status = next;
      changed = true;
      if (next === "ready") s.extracted = extractionFor(s.kind, s.pages);
    }
  }
  if (changed) save();
  return d.sources;
}

function extractionFor(kind: SourceKind, pages: number) {
  switch (kind) {
    case "syllabus":
      return { units: 5, topics: 14, questions: 0 };
    case "past_paper":
      return { units: 0, topics: 0, questions: Math.max(4, pages * 3) };
    case "notes":
      return { units: 0, topics: Math.max(1, Math.round(pages / 4)), questions: 0 };
    default:
      return { units: 0, topics: 0, questions: 0 };
  }
}

route("GET", "/sources", () => [...sources()].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));

route("POST", "/sources", (_p, _q, body) => {
  const { filename, sizeKb, kind, subjectId } = body as { filename: string; sizeKb: number; kind: SourceKind; subjectId: string | null };
  const supported = /\.(pdf|png|jpe?g|docx|txt)$/i.test(filename);
  const src: Source = {
    id: `src-${Date.now().toString(36)}`,
    subjectId,
    kind,
    filename,
    pages: Math.max(1, Math.round(sizeKb / 350)),
    sizeKb,
    uploadedAt: new Date().toISOString(),
    status: supported ? "queued" : "failed",
    extracted: null,
    error: supported ? undefined : "This file type isn't supported. Upload a PDF, image (JPG/PNG), DOCX or TXT.",
    retryable: supported ? undefined : false,
  };
  getDB().sources.push(src);
  save();
  return src;
});

route("POST", "/sources/:id/retry", ({ id }) => {
  const s = getDB().sources.find((x) => x.id === id);
  if (!s) throw new NotFound(`Source ${id} not found`);
  if (s.retryable === false) throw new BadRequest(s.error ?? "This file can't be retried. Upload it in a supported format.");
  s.status = "queued";
  s.error = undefined;
  s.uploadedAt = new Date().toISOString();
  save();
  return s;
});

route("DELETE", "/sources/:id", ({ id }) => {
  const d = getDB();
  d.sources = d.sources.filter((s) => s.id !== id);
  save();
  return { ok: true };
});

// -------------------------------------------------------------- concepts

function weakConcepts() {
  return conceptStats(getDB())
    .filter(isWeak)
    .sort((a, b) => a.correct / a.attempts - b.correct / b.attempts);
}

route("GET", "/concepts", () =>
  conceptStats(getDB()).sort((a, b) => a.correct / a.attempts - b.correct / b.attempts),
);

// ---------------------------------------------------------------- quizzes

route("GET", "/quizzes", () => [...getDB().quizzes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

route("GET", "/quizzes/:id", ({ id }) => {
  const q = getDB().quizzes.find((x) => x.id === id);
  if (!q) throw new NotFound(`Quiz ${id} not found`);
  return q;
});

route("POST", "/quizzes", (_p, _q, body) => {
  const d = getDB();
  const { mode, topicIds = [], count = 10 } = body as { mode: "weak" | "priority" | "topics"; topicIds?: string[]; count?: number };
  let pool = d.questions;
  let title: string;

  if (mode === "weak") {
    const weak = weakConcepts();
    const keys = new Set(weak.map((c) => `${c.topicId}|${c.concept}`));
    const topicSet = new Set(weak.map((c) => c.topicId));
    pool = [
      ...pool.filter((q) => keys.has(`${q.topicId}|${q.concept}`)),
      ...shuffle(pool.filter((q) => topicSet.has(q.topicId) && !keys.has(`${q.topicId}|${q.concept}`))),
    ];
    title = "Weak concepts";
  } else if (mode === "priority") {
    const top = allTopics(d)
      .filter((t) => t.priority.tier === "high")
      .sort((a, b) => b.priority.score - a.priority.score)
      .map((t) => t.id);
    pool = top.flatMap((id) => pool.filter((q) => q.topicId === id));
    title = "High-priority topics";
  } else {
    pool = pool.filter((q) => topicIds.includes(q.topicId));
    const names = d.topics.filter((t) => topicIds.includes(t.id)).map((t) => t.title);
    title = names.length === 1 ? names[0] : `${names.length} topics`;
  }

  if (!pool.length) throw new BadRequest("No questions are available for that selection yet.");
  // Weak/priority pools are already ordered by importance: keep the top `count`,
  // then shuffle so the quiz order does not give the answer away.
  const questions = mode === "topics" ? shuffle(pool).slice(0, count) : shuffle(pool.slice(0, count));
  const quiz: Quiz = {
    id: `quiz-${Date.now().toString(36)}`,
    title,
    createdAt: new Date().toISOString(),
    topicIds: [...new Set(questions.map((q) => q.topicId))],
    questions,
    answers: null,
    submittedAt: null,
    score: null,
  };
  d.quizzes.push(quiz);
  save();
  return quiz;
});

route("POST", "/quizzes/:id/submit", ({ id }, _q, body) => {
  const d = getDB();
  const quiz = d.quizzes.find((x) => x.id === id);
  if (!quiz) throw new NotFound(`Quiz ${id} not found`);
  if (quiz.submittedAt) return quiz;
  const { answers } = body as { answers: (number | null)[] };
  const now = new Date().toISOString();
  quiz.answers = answers;
  quiz.submittedAt = now;
  quiz.score = answers.filter((a, i) => a === quiz.questions[i].answerIndex).length;

  quiz.questions.forEach((q, i) => {
    let h = d.history.find((x) => x.topicId === q.topicId && x.concept === q.concept);
    if (!h) {
      h = { topicId: q.topicId, concept: q.concept, results: [], lastSeen: now };
      d.history.push(h);
    }
    h.results.push(answers[i] === q.answerIndex);
    h.lastSeen = now;
  });
  save();
  return quiz;
});

// ------------------------------------------------------------------- plan

route("GET", "/plan", () => getDB().plan);

route("POST", "/plan", (_p, _q, body) => {
  const d = getDB();
  const { hoursPerDay, restDays } = body as { hoursPerDay: number; restDays: number[] };
  const now = todayISO();
  const kept = d.plan.sessions.filter((s) => s.date < now || s.done);
  const fresh = buildPlan(allTopics(d), d.subjects, { start: today(), hoursPerDay, restDays }).filter(
    (s) => !kept.some((k) => k.id === s.id),
  );
  const plan: Plan = { generatedAt: new Date().toISOString(), hoursPerDay, restDays, sessions: [...kept, ...fresh] };
  d.plan = plan;
  save();
  return plan;
});

route("PATCH", "/plan/sessions/:id", ({ id }, _q, body) => {
  const d = getDB();
  const s = d.plan.sessions.find((x) => x.id === id);
  if (!s) throw new NotFound(`Session ${id} not found`);
  s.done = (body as { done: boolean }).done;
  save();
  return s;
});

// ------------------------------------------------------------------- labs

route("GET", "/labs", () => {
  const d = getDB();
  return { labs: d.labs, experiments: d.experiments };
});

route("PATCH", "/experiments/:id", ({ id }, _q, body) => {
  const d = getDB();
  const e = d.experiments.find((x) => x.id === id);
  if (!e) throw new NotFound(`Experiment ${id} not found`);
  const patch = body as Partial<Experiment>;
  Object.assign(e, patch, patch.checklist ? { checklist: { ...e.checklist, ...patch.checklist } } : {});
  save();
  return e;
});

// ------------------------------------------------------------------- demo

route("POST", "/demo/reset", () => {
  resetDB();
  return { ok: true };
});

// ---------------------------------------------------------------- dispatch

export class BadRequest extends Error {}

export function dispatch(method: string, url: string, body: unknown): { status: number; data: unknown } {
  const [path, qs = ""] = url.split("?");
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const params = match(pattern, path);
    if (!params) continue;
    try {
      return { status: 200, data: handler(params, new URLSearchParams(qs), body) };
    } catch (err) {
      if (err instanceof NotFound) return { status: 404, data: { detail: err.message } };
      if (err instanceof BadRequest) return { status: 400, data: { detail: err.message } };
      throw err;
    }
  }
  return { status: 404, data: { detail: `No route for ${method} ${path}` } };
}

function match(pattern: string, path: string): Params | null {
  const a = pattern.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

