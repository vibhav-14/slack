// Evidence-based priority model. The FastAPI backend implements the same
// formula (see docs/api.md); this copy lets the frontend run without it.

import type { Evidence, FactorKey, Priority, PriorityFactor, PriorityTier, TopicStatus, Unit } from "../types";

export const WEIGHTS: Record<FactorKey, number> = {
  frequency: 0.3,
  marks: 0.15,
  syllabus: 0.1,
  weakness: 0.25,
  coverage: 0.2,
};

export const TIER_THRESHOLDS = { high: 72, medium: 58 } as const;

const MAX_QUESTION_MARKS = 10;
const MIN_ATTEMPTS_FOR_MASTERY = 3;

export interface ScoringInput {
  status: TopicStatus;
  evidence: Evidence[];
  unit: Unit;
  topicsInUnit: number;
  maxTopicHours: number; // largest hours-per-topic share within the subject
  papersAnalysed: number;
  attempts: number;
  correct: number;
}

export function mastery(attempts: number, correct: number): number | null {
  return attempts >= MIN_ATTEMPTS_FOR_MASTERY ? correct / attempts : null;
}

export function tierFor(score: number): PriorityTier {
  if (score >= TIER_THRESHOLDS.high) return "high";
  if (score >= TIER_THRESHOLDS.medium) return "medium";
  return "low";
}

export function scoreTopic(input: ScoringInput): Priority {
  const papers = input.evidence.filter((e) => e.kind === "past_paper");
  const sessions = new Set(papers.map((e) => e.label.split(" · ")[0]));
  const freq = input.papersAnalysed ? sessions.size / input.papersAnalysed : 0;

  const avgMarks = papers.length ? papers.reduce((n, e) => n + (e.marks ?? 0), 0) / papers.length : 0;
  const marks = Math.min(1, avgMarks / MAX_QUESTION_MARKS);

  const topicHours = input.unit.hours / input.topicsInUnit;
  const syllabus = input.maxTopicHours ? topicHours / input.maxTopicHours : 0;

  const m = mastery(input.attempts, input.correct);
  const weakness = m === null ? 0.5 : 1 - m;

  const coverage = input.status === "not_started" ? 1 : input.status === "in_progress" ? 0.5 : 0.15;

  const factors: PriorityFactor[] = [
    {
      key: "frequency",
      label: "Exam frequency",
      value: freq,
      weight: WEIGHTS.frequency,
      detail: papers.length
        ? `Asked in ${sessions.size} of ${input.papersAnalysed} past papers`
        : `Not asked in the last ${input.papersAnalysed} papers`,
    },
    {
      key: "marks",
      label: "Marks when asked",
      value: marks,
      weight: WEIGHTS.marks,
      detail: papers.length ? `Averages ${round1(avgMarks)} marks per question` : "No past questions to measure",
    },
    {
      key: "syllabus",
      label: "Syllabus weight",
      value: syllabus,
      weight: WEIGHTS.syllabus,
      detail: `Unit ${input.unit.number} has ${input.unit.hours} lecture hours across ${input.topicsInUnit} topic${input.topicsInUnit === 1 ? "" : "s"}`,
    },
    {
      key: "weakness",
      label: "Your weakness",
      value: weakness,
      weight: WEIGHTS.weakness,
      detail:
        m === null
          ? input.attempts
            ? `Only ${input.attempts} quiz answer${input.attempts === 1 ? "" : "s"} so far — treated as average`
            : "No quiz attempts yet — treated as average"
          : `${Math.round(m * 100)}% correct over ${input.attempts} quiz answers`,
    },
    {
      key: "coverage",
      label: "Not yet covered",
      value: coverage,
      weight: WEIGHTS.coverage,
      detail:
        input.status === "not_started"
          ? "You haven't started this topic"
          : input.status === "in_progress"
            ? "In progress"
            : "Marked done — kept for revision",
    },
  ];

  const score = Math.round(100 * factors.reduce((n, f) => n + f.value * f.weight, 0));
  return { score, tier: tierFor(score), factors };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
