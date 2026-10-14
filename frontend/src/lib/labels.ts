import type { SessionKind, SourceKind } from "../api/types";

export const sessionKindLabel: Record<SessionKind, string> = {
  learn: "Study",
  revise: "Revise",
  practice: "Practice quiz",
};

export const sourceKindLabel: Record<SourceKind, string> = {
  slides: "Lecture slides",
  syllabus: "Syllabus",
  past_paper: "Past papers",
  notes: "Notes",
  exam_pattern: "Exam pattern",
  timetable: "Timetable",
};

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Timetable days are Monday-first (0 = Monday). */
export const TT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
