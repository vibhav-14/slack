// Shapes returned by the API. Field names are camelCase here; the FastAPI
// backend should serialise Pydantic models with `alias_generator=to_camel`.

export type ID = string;
export type ISODate = string; // "2026-11-24"
export type ISODateTime = string;

export type TopicStatus = "not_started" | "in_progress" | "done";
export type PriorityTier = "high" | "medium" | "low";

export interface ExamPart {
  name: string;
  questions: number;
  attempt: number;
  marksEach: number;
}

export interface Subject {
  id: ID;
  code: string;
  name: string;
  examDate: ISODate;
  examPattern: { totalMarks: number; durationMins: number; parts: ExamPart[] };
}

export interface Unit {
  id: ID;
  subjectId: ID;
  number: number;
  title: string;
  hours: number; // lecture hours from the syllabus
}

export type EvidenceKind = "past_paper" | "syllabus" | "notes" | "quiz";

export interface Evidence {
  id: ID;
  topicId: ID;
  kind: EvidenceKind;
  sourceId: ID | null;
  label: string; // "End-Sem May 2024 · Q3(b)"
  marks?: number;
  excerpt: string;
}

export type FactorKey = "frequency" | "marks" | "syllabus" | "weakness" | "coverage";

export interface PriorityFactor {
  key: FactorKey;
  label: string;
  value: number; // 0..1, normalised
  weight: number; // 0..1, sums to 1 across factors
  detail: string; // human-readable reason
}

export interface Priority {
  score: number; // 0..100
  tier: PriorityTier;
  factors: PriorityFactor[];
}

export interface Topic {
  id: ID;
  subjectId: ID;
  unitId: ID;
  title: string;
  status: TopicStatus;
  concepts: string[];
  priority: Priority;
  mastery: number | null; // 0..1 from quiz history; null = fewer than 3 answers
  evidenceCount: number;
  papers: { asked: number; total: number }; // past papers that asked this topic
}

export interface TopicDetail extends Topic {
  evidence: Evidence[];
  conceptStats: ConceptStat[];
}

export type SourceKind = "syllabus" | "notes" | "past_paper" | "exam_pattern";
export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export interface Source {
  id: ID;
  subjectId: ID | null;
  kind: SourceKind;
  filename: string;
  pages: number;
  sizeKb: number;
  uploadedAt: ISODateTime;
  status: SourceStatus;
  extracted: { units: number; topics: number; questions: number } | null;
  error?: string;
  retryable?: boolean; // false when re-uploading in another format is the only fix
}

export interface QuizQuestion {
  id: ID;
  topicId: ID;
  concept: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface Quiz {
  id: ID;
  title: string;
  createdAt: ISODateTime;
  topicIds: ID[];
  questions: QuizQuestion[];
  answers: (number | null)[] | null;
  submittedAt: ISODateTime | null;
  score: number | null; // correct count
}

export interface ConceptStat {
  concept: string;
  topicId: ID;
  subjectId: ID;
  attempts: number;
  correct: number;
  recent: boolean[]; // oldest → newest, last 8 attempts
  lastSeen: ISODateTime | null;
}

export type SessionKind = "learn" | "revise" | "practice";

export interface PlanSession {
  id: ID;
  date: ISODate;
  topicId: ID;
  kind: SessionKind;
  minutes: number;
  done: boolean;
}

export interface Plan {
  generatedAt: ISODateTime;
  hoursPerDay: number;
  restDays: number[]; // 0 = Sunday
  sessions: PlanSession[];
}

export type RecordStatus = "not_started" | "draft" | "written" | "checked";

export interface LabCourse {
  id: ID;
  code: string;
  name: string;
  subjectId: ID | null;
  practicalExamDate: ISODate;
}

export interface RecordChecklist {
  aim: boolean;
  procedure: boolean;
  code: boolean;
  output: boolean;
  conclusion: boolean;
}

export interface Experiment {
  id: ID;
  labId: ID;
  number: number;
  title: string;
  aim: string;
  performedOn: ISODate | null;
  due: ISODate;
  status: RecordStatus;
  checklist: RecordChecklist;
  attachments: { name: string; sizeKb: number }[];
  vivaQuestions: string[];
}

export interface Overview {
  subjects: (Subject & { topicsDone: number; topicsTotal: number; unitsDone: number; unitsTotal: number })[];
  todaySessions: PlanSession[];
  dueExperiments: Experiment[];
  weakest: ConceptStat[];
  recentSources: Source[];
}
