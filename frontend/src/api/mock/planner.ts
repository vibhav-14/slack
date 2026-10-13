// Greedy revision planner: highest-priority topics first, each topic gets a
// learn/revise session and a spaced practice session, all scheduled before
// that subject's exam, within the daily study budget.

import type { ISODate, PlanSession, SessionKind, Subject, Topic } from "../types";
import { addDays, parseISODate, toISODate } from "../../lib/dates";

interface Item {
  topicId: ID;
  kind: SessionKind;
  minutes: number;
  notBefore: ISODate;
  deadline: ISODate; // exclusive: the exam day
  rank: number;
}
type ID = string;

export interface PlanOptions {
  start: Date;
  hoursPerDay: number;
  restDays: number[];
}

const SPACING_DAYS = 2;

export function buildPlan(topics: Topic[], subjects: Subject[], opts: PlanOptions): PlanSession[] {
  const examBySubject = new Map(subjects.map((s) => [s.id, s.examDate]));
  const startISO = toISODate(opts.start);
  const ranked = [...topics].sort((a, b) => b.priority.score - a.priority.score);

  const queue: Item[] = [];
  ranked.forEach((t, rank) => {
    const deadline = examBySubject.get(t.subjectId);
    if (!deadline) return;
    const first: SessionKind = t.status === "not_started" ? "learn" : "revise";
    const firstMins = t.status === "not_started" ? 60 : t.status === "in_progress" ? 45 : 30;
    queue.push({ topicId: t.id, kind: first, minutes: firstMins, notBefore: startISO, deadline, rank });
    if (t.priority.tier !== "low" || t.status !== "done") {
      queue.push({ topicId: t.id, kind: "practice", minutes: 30, notBefore: "", deadline, rank: rank + 0.5 });
    }
  });

  // Final pass: a short revise slot for every high-priority topic in the
  // week before its exam.
  for (const t of ranked.filter((t) => t.priority.tier === "high")) {
    const deadline = examBySubject.get(t.subjectId)!;
    const weekBefore = toISODate(addDays(parseISODate(deadline), -7));
    queue.push({ topicId: t.id, kind: "revise", minutes: 30, notBefore: weekBefore, deadline, rank: 1000 + t.priority.score * -1 });
  }

  const budget = Math.max(30, Math.round(opts.hoursPerDay * 60));
  const lastExam = subjects.reduce((max, s) => (s.examDate > max ? s.examDate : max), startISO);
  const sessions: PlanSession[] = [];
  const scheduledFirst = new Map<ID, ISODate>();

  for (let d = new Date(opts.start); toISODate(d) < lastExam; d = addDays(d, 1)) {
    if (opts.restDays.includes(d.getDay())) continue;
    const date = toISODate(d);
    let remaining = budget;

    const available = queue
      .filter((item) => {
        if (item.kind === "practice" && !item.notBefore) {
          const first = scheduledFirst.get(item.topicId);
          if (!first) return false;
          item.notBefore = toISODate(addDays(parseISODate(first), SPACING_DAYS));
        }
        return item.notBefore <= date && date < item.deadline;
      })
      .sort((a, b) => a.rank - b.rank);

    for (const item of available) {
      if (item.minutes > remaining) continue;
      if (sessions.some((s) => s.date === date && s.topicId === item.topicId)) continue;
      remaining -= item.minutes;
      sessions.push({
        id: `s-${date}-${item.topicId}-${item.kind}`,
        date,
        topicId: item.topicId,
        kind: item.kind,
        minutes: item.minutes,
        done: false,
      });
      if (item.kind !== "practice" && !scheduledFirst.has(item.topicId)) scheduledFirst.set(item.topicId, date);
      queue.splice(queue.indexOf(item), 1);
      if (remaining < 30) break;
    }
  }

  return sessions;
}
