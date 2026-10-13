import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  ConceptStat,
  Experiment,
  LabCourse,
  Overview,
  Plan,
  PlanSession,
  Quiz,
  Source,
  SourceKind,
  Subject,
  Topic,
  TopicDetail,
  TopicStatus,
  Unit,
} from "./types";

export const keys = {
  overview: ["overview"] as const,
  subjects: ["subjects"] as const,
  units: ["units"] as const,
  subject: (id: string) => ["subjects", id] as const,
  topics: (filter: Record<string, string> = {}) => ["topics", filter] as const,
  topic: (id: string) => ["topic", id] as const,
  sources: ["sources"] as const,
  concepts: ["concepts"] as const,
  quizzes: ["quizzes"] as const,
  quiz: (id: string) => ["quizzes", id] as const,
  plan: ["plan"] as const,
  labs: ["labs"] as const,
};

// ------------------------------------------------------------------ reads

export const useOverview = () => useQuery({ queryKey: keys.overview, queryFn: () => api.get<Overview>("/overview") });

export const useSubjects = () => useQuery({ queryKey: keys.subjects, queryFn: () => api.get<Subject[]>("/subjects") });

export const useUnits = () => useQuery({ queryKey: keys.units, queryFn: () => api.get<Unit[]>("/units"), staleTime: Infinity });

/** unitId → "Unit 3 · Normalization" */
export function useUnitsLookup() {
  const units = useUnits();
  const byId = new Map(units.data?.map((u) => [u.id, u]));
  return (unitId: string) => {
    const u = byId.get(unitId);
    return u ? `Unit ${u.number} · ${u.title}` : "";
  };
}

export const useSubject = (id: string) =>
  useQuery({
    queryKey: keys.subject(id),
    queryFn: () => api.get<{ subject: Subject; units: Unit[]; topics: Topic[] }>(`/subjects/${id}`),
  });

export const useTopics = (filter: Record<string, string> = {}) =>
  useQuery({
    queryKey: keys.topics(filter),
    queryFn: () => api.get<Topic[]>(`/topics?${new URLSearchParams(filter)}`),
  });

export const useTopic = (id: string) =>
  useQuery({ queryKey: keys.topic(id), queryFn: () => api.get<TopicDetail>(`/topics/${id}`) });

export const useSources = () =>
  useQuery({
    queryKey: keys.sources,
    queryFn: () => api.get<Source[]>("/sources"),
    // Poll while anything is still being processed.
    refetchInterval: (q) => (q.state.data?.some((s) => s.status === "queued" || s.status === "processing") ? 1200 : false),
  });

export const useConcepts = () => useQuery({ queryKey: keys.concepts, queryFn: () => api.get<ConceptStat[]>("/concepts") });

export const useQuizzes = () => useQuery({ queryKey: keys.quizzes, queryFn: () => api.get<Quiz[]>("/quizzes") });

export const useQuiz = (id: string) => useQuery({ queryKey: keys.quiz(id), queryFn: () => api.get<Quiz>(`/quizzes/${id}`) });

export const usePlan = () => useQuery({ queryKey: keys.plan, queryFn: () => api.get<Plan>("/plan") });

export const useLabs = () =>
  useQuery({ queryKey: keys.labs, queryFn: () => api.get<{ labs: LabCourse[]; experiments: Experiment[] }>("/labs") });

// --------------------------------------------------------------- mutations

export function useSetTopicStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TopicStatus }) => api.patch<Topic>(`/topics/${id}`, { status }),
    onSuccess: () => {
      // Status feeds the coverage factor, so every ranking may shift.
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["topic"] });
      qc.invalidateQueries({ queryKey: keys.subjects });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useToggleSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.patch<PlanSession>(`/plan/sessions/${id}`, { done }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: keys.plan });
      const prevPlan = qc.getQueryData<Plan>(keys.plan);
      const prevOverview = qc.getQueryData<Overview>(keys.overview);
      const flip = (s: PlanSession) => (s.id === id ? { ...s, done } : s);
      if (prevPlan) qc.setQueryData<Plan>(keys.plan, { ...prevPlan, sessions: prevPlan.sessions.map(flip) });
      if (prevOverview) qc.setQueryData<Overview>(keys.overview, { ...prevOverview, todaySessions: prevOverview.todaySessions.map(flip) });
      return { prevPlan, prevOverview };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevPlan) qc.setQueryData(keys.plan, ctx.prevPlan);
      if (ctx?.prevOverview) qc.setQueryData(keys.overview, ctx.prevOverview);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.plan });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useRegeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { hoursPerDay: number; restDays: number[] }) => api.post<Plan>("/plan", opts),
    onSuccess: (plan) => {
      qc.setQueryData(keys.plan, plan);
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useUploadSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { filename: string; sizeKb: number; kind: SourceKind; subjectId: string | null }) =>
      api.post<Source>("/sources", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sources }),
  });
}

export function useRetrySource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Source>(`/sources/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sources }),
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.sources });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { mode: "weak" | "priority" | "topics"; topicIds?: string[]; count?: number }) =>
      api.post<Quiz>("/quizzes", input),
    onSuccess: (quiz) => {
      qc.setQueryData(keys.quiz(quiz.id), quiz);
      qc.invalidateQueries({ queryKey: keys.quizzes });
    },
  });
}

export function useSubmitQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: (number | null)[] }) =>
      api.post<Quiz>(`/quizzes/${id}/submit`, { answers }),
    onSuccess: (quiz) => {
      qc.setQueryData(keys.quiz(quiz.id), quiz);
      // New answers change mastery → weakness factor → priorities.
      qc.invalidateQueries({ queryKey: keys.quizzes });
      qc.invalidateQueries({ queryKey: keys.concepts });
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["topic"] });
      qc.invalidateQueries({ queryKey: keys.subjects });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useUpdateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Experiment> }) => api.patch<Experiment>(`/experiments/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.labs });
      const prev = qc.getQueryData<{ labs: LabCourse[]; experiments: Experiment[] }>(keys.labs);
      if (prev) {
        qc.setQueryData(keys.labs, {
          ...prev,
          experiments: prev.experiments.map((e) =>
            e.id === id ? { ...e, ...patch, checklist: { ...e.checklist, ...(patch.checklist ?? {}) } } : e,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.labs, ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.labs });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/demo/reset"),
    onSuccess: () => qc.invalidateQueries(),
  });
}
