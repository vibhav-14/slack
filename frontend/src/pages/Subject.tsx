import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, ClipboardList, FileStack, ListChecks } from "lucide-react";
import { useCreateQuiz, useSources, useSubject, useSubjects, useUnitsLookup } from "../api/hooks";
import { fmt, relativeDays } from "../lib/dates";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Crumbs, ErrorBlock, Meter, PageSkeleton, SectionHead } from "../components/ui";
import { PriorityTable } from "./Priorities";
import { useToast } from "../components/Toast";

export function SubjectPage() {
  const { id = "" } = useParams();
  const q = useSubject(id);
  const subjects = useSubjects();
  const sources = useSources();
  const unitTitle = useUnitsLookup();
  const createQuiz = useCreateQuiz();
  const navigate = useNavigate();
  const toast = useToast();
  useDocumentTitle(q.data?.subject.name);

  if (q.isLoading) return <PageSkeleton lines={10} />;
  if (q.error || !q.data) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;

  const { subject, units, topics } = q.data;
  const subjectById = new Map(subjects.data?.map((s) => [s.id, s]));
  const done = topics.filter((t) => t.status === "done").length;
  const unitsDone = units.filter((u) => topics.filter((t) => t.unitId === u.id).every((t) => t.status === "done")).length;
  const totalHours = units.reduce((n, u) => n + u.hours, 0);
  const subjectSources = sources.data?.filter((s) => s.subjectId === subject.id && s.status === "ready") ?? [];

  const quiz = () =>
    createQuiz.mutate(
      { mode: "topics", topicIds: topics.map((t) => t.id), count: 10 },
      { onSuccess: (quiz) => navigate(`/practice/${quiz.id}`), onError: (e) => toast(e.message, { error: true }) },
    );

  return (
    <div className="page">
      <Crumbs items={[<Link to="/priorities">Subjects</Link>, <span className="mono">{subject.code}</span>]} />
      <div className="page-head">
        <h1 className="page-title">{subject.name}</h1>
        <div className="page-actions">
          <Button onClick={quiz} busy={createQuiz.isPending}>
            Quiz this subject
          </Button>
        </div>
      </div>

      <dl className="props">
        <dt>
          <CalendarClock size={16} aria-hidden="true" /> End-sem exam
        </dt>
        <dd>
          {fmt.weekday(subject.examDate)} <span className="muted">· {relativeDays(subject.examDate)}</span>
        </dd>
        <dt>
          <ClipboardList size={16} aria-hidden="true" /> Exam pattern
        </dt>
        <dd>
          <span>
            {subject.examPattern.parts
              .map((p) =>
                p.attempt === p.questions
                  ? `${p.name}: ${p.questions} × ${p.marksEach} marks`
                  : `${p.name}: any ${p.attempt} of ${p.questions} × ${p.marksEach} marks`,
              )
              .join(" · ")}
            <span className="muted">
              {" "}
              · {subject.examPattern.totalMarks} marks, {subject.examPattern.durationMins / 60} h
            </span>
          </span>
        </dd>
        <dt>
          <ListChecks size={16} aria-hidden="true" /> Coverage
        </dt>
        <dd>
          <span style={{ width: "8rem" }}>
            <Meter value={done / topics.length} label={`${done} of ${topics.length} topics done`} tone="success" />
          </span>
          <span className="num">
            {done} of {topics.length} topics · {unitsDone} of {units.length} units complete
          </span>
        </dd>
        <dt>
          <FileStack size={16} aria-hidden="true" /> Sources
        </dt>
        <dd>
          <Link to="/sources">
            {subjectSources.length} file{subjectSources.length === 1 ? "" : "s"}
          </Link>
          <span className="muted">· {subjectSources.map((s) => s.filename).slice(0, 2).join(", ")}</span>
        </dd>
      </dl>

      {units.map((u) => {
        const unitTopics = topics.filter((t) => t.unitId === u.id);
        const unitDone = unitTopics.filter((t) => t.status === "done").length;
        return (
          <section key={u.id} className="section" aria-labelledby={`unit-${u.id}`}>
            <SectionHead
              id={`unit-${u.id}`}
              title={`Unit ${u.number} · ${u.title}`}
              note={
                <>
                  {u.hours} of {totalHours} lecture hours · {unitDone} of {unitTopics.length} topics done
                  {unitDone === unitTopics.length && " · Unit complete"}
                </>
              }
            />
            <PriorityTable rows={unitTopics} subjectById={subjectById} unitTitle={unitTitle} showSubject={false} />
          </section>
        );
      })}
    </div>
  );
}
