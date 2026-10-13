// In-browser stand-in for the backend database. Persisted to localStorage so
// progress survives reloads while the FastAPI service is being built.

import type { ConceptStat, Plan, Quiz, Topic } from "../types";
import { addDays, today } from "../../lib/dates";
import { buildSeed, PAPERS_PER_SUBJECT, type ConceptHistory, type SeedData } from "./seed";
import { mastery, scoreTopic } from "./scoring";
import { buildPlan } from "./planner";

const STORAGE_KEY = "margin.demo-db.v1";

export interface DB extends SeedData {
  quizzes: Quiz[];
  plan: Plan;
}

let db: DB | null = null;

export function getDB(): DB {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) db = JSON.parse(raw) as DB;
  } catch {
    db = null;
  }
  if (!db) db = createDB();
  return db;
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
}

export function resetDB() {
  db = createDB();
  save();
}

function createDB(): DB {
  const seed = buildSeed(today());
  const fresh: DB = {
    ...seed,
    quizzes: [],
    plan: { generatedAt: new Date().toISOString(), hoursPerDay: 2.5, restDays: [0], sessions: [] },
  };
  fresh.quizzes = seedQuizzes(fresh);
  fresh.plan.sessions = buildPlan(allTopics(fresh), fresh.subjects, {
    start: today(),
    hoursPerDay: fresh.plan.hoursPerDay,
    restDays: fresh.plan.restDays,
  });
  db = fresh;
  save();
  return fresh;
}

function seedQuizzes(d: DB): Quiz[] {
  const make = (id: string, title: string, topicTitles: string[], answersCorrect: boolean[], daysAgo: number): Quiz => {
    const topicIds = d.topics.filter((t) => topicTitles.includes(t.title)).map((t) => t.id);
    const questions = d.questions.filter((q) => topicIds.includes(q.topicId));
    const answers = questions.map((q, i) =>
      answersCorrect[i % answersCorrect.length] ? q.answerIndex : (q.answerIndex + 1) % q.options.length,
    );
    const when = addDays(today(), -daysAgo);
    when.setHours(21, 40);
    return {
      id,
      title,
      createdAt: when.toISOString(),
      topicIds,
      questions,
      answers,
      submittedAt: when.toISOString(),
      score: answers.filter((a, i) => a === questions[i].answerIndex).length,
    };
  };
  return [
    make("quiz-seed-2", "Deadlocks and paging", ["Deadlock avoidance: Banker's algorithm", "Paging and segmentation"], [false, true, false, true, false], 2),
    make("quiz-seed-1", "Normalization", ["Functional dependencies and closure", "Normal forms: 1NF to BCNF"], [true, false, false, true, true], 1),
  ];
}

// ------------------------------------------------------------- derivations

function historyFor(d: DB, topicId: string): ConceptHistory[] {
  return d.history.filter((h) => h.topicId === topicId);
}

export function conceptStats(d: DB, topicId?: string): ConceptStat[] {
  return d.history
    .filter((h) => !topicId || h.topicId === topicId)
    .map((h) => ({
      concept: h.concept,
      topicId: h.topicId,
      subjectId: d.topics.find((t) => t.id === h.topicId)!.subjectId,
      attempts: h.results.length,
      correct: h.results.filter(Boolean).length,
      recent: h.results.slice(-8),
      lastSeen: h.lastSeen,
    }));
}

export function topicView(d: DB, topicId: string): Topic {
  const t = d.topics.find((x) => x.id === topicId);
  if (!t) throw new NotFound(`Topic ${topicId} not found`);
  const unit = d.units.find((u) => u.id === t.unitId)!;
  const subjectUnits = d.units.filter((u) => u.subjectId === t.subjectId);
  const topicsPerUnit = (unitId: string) => d.topics.filter((x) => x.unitId === unitId).length;
  const maxTopicHours = Math.max(...subjectUnits.map((u) => u.hours / topicsPerUnit(u.id)));
  const evidence = d.evidence.filter((e) => e.topicId === t.id);
  const hist = historyFor(d, t.id);
  const attempts = hist.reduce((n, h) => n + h.results.length, 0);
  const correct = hist.reduce((n, h) => n + h.results.filter(Boolean).length, 0);

  return {
    ...t,
    mastery: mastery(attempts, correct),
    evidenceCount: evidence.length,
    papers: {
      asked: new Set(evidence.filter((e) => e.kind === "past_paper").map((e) => e.label.split(" · ")[0])).size,
      total: PAPERS_PER_SUBJECT,
    },
    priority: scoreTopic({
      status: t.status,
      evidence,
      unit,
      topicsInUnit: topicsPerUnit(unit.id),
      maxTopicHours,
      papersAnalysed: PAPERS_PER_SUBJECT,
      attempts,
      correct,
    }),
  };
}

export function allTopics(d: DB): Topic[] {
  return d.topics.map((t) => topicView(d, t.id));
}

export class NotFound extends Error {}
