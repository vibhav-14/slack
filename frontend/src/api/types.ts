// Shapes returned by the FastAPI backend (backend/app/services/views.py).

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
  code: string; // official course code, or an abbreviation until one is known
  officialCode: boolean;
  name: string;
  faculty: string | null;
  examDate: ISODate;
  examDateConfirmed: boolean;
  examPattern: { totalMarks: number; durationMins: number; parts: ExamPart[] } | null;
}

export interface Unit {
  id: ID;
  subjectId: ID;
  number: number;
  title: string | null;
  hours: number | null;
}

export type EvidenceKind = "past_paper" | "syllabus" | "notes" | "slides" | "assessment" | "quiz";

export interface Evidence {
  id: ID;
  topicId: ID;
  kind: EvidenceKind;
  sourceId: ID | null;
  label: string;
  marks: number | null;
  level: string | null; // Bloom level, e.g. "K3"
  excerpt: string;
}

export type FactorKey = "frequency" | "marks" | "syllabus" | "assessment" | "weakness" | "coverage";

export interface PriorityFactor {
  key: FactorKey;
  label: string;
  value: number | null; // 0..1; null when there is no evidence for this factor yet
  weight: number; // nominal weight
  effectiveWeight: number; // weight after sharing out unavailable factors
  available: boolean;
  detail: string;
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
  sessionNumber: number | null;
  courseOutcome: string | null;
  bloom: string | null; // "K3 · Applying"
  priority: Priority;
  mastery: number | null; // null until 3 quiz answers
  evidenceCount: number;
  papers: { asked: number; total: number };
}

export interface TopicDetail extends Topic {
  evidence: Evidence[];
  conceptStats: ConceptStat[];
  questionCounts: { slides: number; claude: number };
}

export type SourceKind = "syllabus" | "notes" | "past_paper" | "exam_pattern" | "slides" | "timetable";
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
  extracted: {
    units?: number;
    topics?: number;
    questions?: number;
    evidence?: number;
    slots?: number;
    subjects?: number;
    summary?: string;
    classes?: string[];
    aiQuestions?: number;
    aiError?: string;
  } | null;
  error: string | null;
  retryable: boolean;
}

export interface QuizQuestion {
  id: ID;
  topicId: ID;
  concept: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  origin: "slides" | "claude";
  slideRef: string | null;
}

export interface Quiz {
  id: ID;
  title: string;
  createdAt: ISODateTime;
  topicIds: ID[];
  questions: QuizQuestion[];
  answers: (number | null)[] | null;
  submittedAt: ISODateTime | null;
  score: number | null;
}

export interface ConceptStat {
  concept: string;
  topicId: ID;
  subjectId: ID;
  attempts: number;
  correct: number;
  recent: boolean[];
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
  reason: string | null;
}

export interface Plan {
  generatedAt: ISODateTime | null;
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
  faculty: string | null;
  practicalExamDate: ISODate | null;
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
  due: ISODate | null;
  status: RecordStatus;
  checklist: RecordChecklist;
  attachments: { name: string; sizeKb: number }[];
  vivaQuestions: string[];
}

export interface Period {
  number: number;
  start: string; // "8:50"
  end: string;
}

export interface TimetableSlot {
  id: number;
  day: number; // 0 = Monday
  periods: number[];
  start: string | null;
  end: string | null;
  title: string;
  kind: "lecture" | "lab" | "other";
  subjectId: ID | null;
  labId: ID | null;
  room: string | null;
  faculty: string | null;
  group: number | null;
}

export interface Timetable {
  classLabel: string | null;
  labGroup: number;
  effectiveFrom: ISODate | null;
  periods: Period[];
  slots: TimetableSlot[];
  availableClasses: string[];
}

export interface Profile {
  program: string | null;
  institution: string | null;
  classLabel: string | null;
  semester: number | null;
  labGroup: number;
  hoursPerDay: number;
  restDays: number[];
  timetableEffectiveFrom: ISODate | null;
  aiAvailable: boolean;
}

export interface Overview {
  subjects: (Subject & { topicsDone: number; topicsTotal: number; unitsDone: number; unitsTotal: number })[];
  todayClasses: TimetableSlot[];
  todaySessions: PlanSession[];
  dueExperiments: Experiment[];
  weakest: ConceptStat[];
  recentSources: Source[];
}
