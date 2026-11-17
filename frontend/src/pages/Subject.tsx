import { Link, useNavigate, useParams } from "react-router-dom";
import { useCreateQuiz, useSources, useSubject, useSubjects, useTimetable, useUnitsLookup } from "../api/hooks";
import { fmt, relativeDays } from "../lib/dates";
import { TT_DAYS } from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Crumbs, Empty, ErrorBlock, Meter, PageSkeleton, SectionHead } from "../components/ui";
import { PriorityTable } from "./Priorities";
import { useToast } from "../components/Toast";

export function SubjectPage() {
  const { id = "" } = useParams();
  const q = useSubject(id);
  const subjects = useSubjects();
  const sources = useSources();
  const timetable = useTimetable();
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
  const unitsWithTopics = units.filter((u) => topics.some((t) => t.unitId === u.id));
  const unitsDone = unitsWithTopics.filter((u) => topics.filter((t) => t.unitId === u.id).every((t) => t.status === "done")).length;
  const knownHours = units.every((u) => u.hours !== null);
  const totalHours = units.reduce((n, u) => n + (u.hours ?? 0), 0);
  const subjectSources = sources.data?.filter((s) => s.subjectId === subject.id && s.status === "ready") ?? [];
  const lectures = (timetable.data?.slots ?? []).filter(
    (s) => s.subjectId === subject.id && s.kind === "lecture",
  );
  const pattern = subject.examPattern;

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
        {topics.length > 0 && (
          <div className="page-actions">
            <Button onClick={quiz} busy={createQuiz.isPending}>
              Quiz this subject
            </Button>
          </div>
        )}
      </div>

      <dl className="props">
        <dt>
          End-sem exam
        </dt>
        <dd>
          {fmt.weekday(subject.examDate)} <span className="muted">· {relativeDays(subject.examDate)}</span>
          {!subject.examDateConfirmed && (
            <span className="muted">
              · estimated, <Link to="/settings#exams">set the real date</Link>
            </span>
          )}
        </dd>
        {subject.faculty && (
          <>
            <dt>
              Faculty
            </dt>
            <dd>{subject.faculty}</dd>
          </>
        )}
        {lectures.length > 0 && (
          <>
            <dt>
              Lectures
            </dt>
            <dd>
              {lectures.map((s) => `${TT_DAYS[s.day].slice(0, 3)} ${s.start}`).join(" · ")}
              {lectures[0].room && <span className="muted">· {lectures[0].room}</span>}
            </dd>
          </>
        )}
        {pattern && (
          <>
            <dt>
              Exam pattern
            </dt>
            <dd>
              <span>
                {pattern.parts
                  .map((p) =>
                    p.attempt === p.questions
                      ? `${p.name}: ${p.questions} × ${p.marksEach} marks`
                      : `${p.name}: any ${p.attempt} of ${p.questions} × ${p.marksEach} marks`,
                  )
                  .join(" · ")}
                <span className="muted">
                  {" "}
                  · {pattern.totalMarks} marks, {pattern.durationMins / 60} h
                </span>
              </span>
            </dd>
          </>
        )}
        {topics.length > 0 && (
          <>
            <dt>
              Coverage
            </dt>
            <dd>
              <span style={{ width: "8rem" }}>
                <Meter value={done / topics.length} label={`${done} of ${topics.length} topics done`} tone="success" />
              </span>
              <span className="num">
                {done} of {topics.length} topics · {unitsDone} of {unitsWithTopics.length} units complete
              </span>
            </dd>
          </>
        )}
        <dt>
          Sources
        </dt>
        <dd>
          <Link to="/sources">
            {subjectSources.length} file{subjectSources.length === 1 ? "" : "s"}
          </Link>
          {subjectSources.length > 0 && (
            <span className="muted">· {subjectSources.map((s) => s.filename).slice(0, 2).join(", ")}</span>
          )}
        </dd>
      </dl>

      {topics.length === 0 && (
        <section className="section">
          <Empty title="No topics yet" action={<Link to="/sources" className="btn btn-primary">Upload material</Link>}>
            Upload this subject's lecture slides or syllabus. Each session's slides become a topic, with its assessment
            cues as evidence and quiz questions drawn from its tables and misconceptions.
          </Empty>
        </section>
      )}

      {unitsWithTopics.map((u) => {
        const unitTopics = topics.filter((t) => t.unitId === u.id);
        const unitDone = unitTopics.filter((t) => t.status === "done").length;
        return (
          <section key={u.id} className="section" aria-labelledby={`unit-${u.id}`}>
            <SectionHead
              id={`unit-${u.id}`}
              title={u.title ? `Unit ${u.number} · ${u.title}` : `Unit ${u.number}`}
              note={
                <>
                  {u.hours !== null && knownHours && `${u.hours} of ${totalHours} lecture hours · `}
                  {unitDone} of {unitTopics.length} topics done
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
