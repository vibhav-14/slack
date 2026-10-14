import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  ConceptStat,
  Experiment,
  LabCourse,
  Overview,
  Plan,
  PlanSession,
  Profile,
  Quiz,
  Source,
  SourceKind,
  Subject,
  Timetable,
  Topic,
  TopicDetail,
  TopicStatus,
  Unit,
} from "./types";

type Labs = { labs: LabCourse[]; experiments: Experiment[] };

export const keys = {
  overview: ["overview"] as const,
  profile: ["profile"] as const,
  timetable: ["timetable"] as const,
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

/** Anything derived from topics: rankings, plan, overview. */
function invalidateStudyData(qc: QueryClient) {
  for (const key of [["topics"], ["topic"], keys.subjects, keys.units, keys.overview, keys.plan, keys.concepts]) {
    qc.invalidateQueries({ queryKey: key });
  }
}

// ------------------------------------------------------------------ reads

export const useOverview = () => useQuery({ queryKey: keys.overview, queryFn: () => api.get<Overview>("/overview") });

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api.get<Profile>("/profile") });

export const useTimetable = () => useQuery({ queryKey: keys.timetable, queryFn: () => api.get<Timetable>("/timetable") });

export const useSubjects = () => useQuery({ queryKey: keys.subjects, queryFn: () => api.get<Subject[]>("/subjects") });

export const useUnits = () => useQuery({ queryKey: keys.units, queryFn: () => api.get<Unit[]>("/units") });

/** unitId → "Unit 3 · Normalization" (or just "Unit 2" when the syllabus hasn't named it). */
export function useUnitsLookup() {
  const units = useUnits();
  const byId = new Map(units.data?.map((u) => [u.id, u]));
  return (unitId: string) => {
    const u = byId.get(unitId);
    return u ? (u.title ? `Unit ${u.number} · ${u.title}` : `Unit ${u.number}`) : "";
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
  useQuery({ queryKey: keys.topic(id), queryFn: () => api.get<TopicDetail>(`/topics/${encodeURIComponent(id)}`) });

export const useSources = () => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.sources,
    queryFn: async () => {
      const prev = qc.getQueryData<Source[]>(keys.sources);
      const next = await api.get<Source[]>("/sources");
      // A file just finished processing: its topics, subjects and labs are new.
      const finished = next.some((s) => s.status === "ready" && prev?.find((p) => p.id === s.id)?.status !== "ready" && prev);
      if (finished) {
        invalidateStudyData(qc);
        qc.invalidateQueries({ queryKey: keys.labs });
        qc.invalidateQueries({ queryKey: keys.timetable });
        qc.invalidateQueries({ queryKey: keys.profile });
      }
      return next;
    },
    // Poll while anything is still being processed.
    refetchInterval: (q) => (q.state.data?.some((s) => s.status === "queued" || s.status === "processing") ? 1200 : false),
  });
};

export const useConcepts = () => useQuery({ queryKey: keys.concepts, queryFn: () => api.get<ConceptStat[]>("/concepts") });

export const useQuizzes = () => useQuery({ queryKey: keys.quizzes, queryFn: () => api.get<Quiz[]>("/quizzes") });

export const useQuiz = (id: string) => useQuery({ queryKey: keys.quiz(id), queryFn: () => api.get<Quiz>(`/quizzes/${id}`) });

export const usePlan = () => useQuery({ queryKey: keys.plan, queryFn: () => api.get<Plan>("/plan") });

export const useLabs = () => useQuery({ queryKey: keys.labs, queryFn: () => api.get<Labs>("/labs") });

// --------------------------------------------------------------- mutations

export function usePatchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Profile, "classLabel" | "labGroup" | "hoursPerDay" | "restDays">>) =>
      api.patch<Profile>("/profile", patch),
    onSuccess: (p) => {
      qc.setQueryData(keys.profile, p);
      qc.invalidateQueries({ queryKey: keys.timetable });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export function usePatchSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; examDate?: string; name?: string; code?: string }) =>
      api.patch<Subject>(`/subjects/${id}`, patch),
    onSuccess: () => invalidateStudyData(qc),
  });
}

export function useSetTopicStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TopicStatus }) =>
      api.patch<Topic>(`/topics/${encodeURIComponent(id)}`, { status }),
    // Status feeds the coverage factor, so every ranking may shift.
    onSuccess: () => invalidateStudyData(qc),
  });
}

export function useGenerateQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topicId: string) => api.post<{ added: number }>(`/topics/${encodeURIComponent(topicId)}/questions`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["topic"] }),
  });
}

export function useToggleSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api.patch<PlanSession>(`/plan/sessions/${encodeURIComponent(id)}`, { done }),
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
      qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

export function useUploadSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, kind, subjectId }: { file: File; kind: SourceKind; subjectId: string | null }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      if (subjectId) form.append("subjectId", subjectId);
      return api.upload<Source>("/sources", form);
    },
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
      invalidateStudyData(qc);
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
      invalidateStudyData(qc);
    },
  });
}

type ExperimentPatch = Partial<Omit<Experiment, "checklist">> & { checklist?: Partial<Experiment["checklist"]> };

export function useUpdateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ExperimentPatch }) => api.patch<Experiment>(`/experiments/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.labs });
      const prev = qc.getQueryData<Labs>(keys.labs);
      if (prev) {
        qc.setQueryData<Labs>(keys.labs, {
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

function useLabsMutation<TVars, TData>(fn: (v: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.labs });
      qc.invalidateQueries({ queryKey: keys.overview });
    },
  });
}

export const useAddExperiment = () =>
  useLabsMutation(({ labId, ...body }: { labId: string; title: string; aim?: string; due?: string | null }) =>
    api.post<Experiment>(`/labs/${labId}/experiments`, body),
  );

export const useDeleteExperiment = () => useLabsMutation((id: string) => api.del(`/experiments/${id}`));

export const usePatchLab = () =>
  useLabsMutation(({ id, practicalExamDate }: { id: string; practicalExamDate: string | null }) =>
    api.patch<LabCourse>(`/labs/${id}`, { practicalExamDate }),
  );

export const useAttachFile = () =>
  useLabsMutation(({ id, file }: { id: string; file: File }) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<Experiment>(`/experiments/${id}/attachments`, form);
  });
