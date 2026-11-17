import { Link, useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";
import { useCreateQuiz, useLabs, useOverview, useSources, useTopics } from "../api/hooks";
import { daysUntil, fmt, minutesLabel, relativeDays, today } from "../lib/dates";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Dots, Empty, ErrorBlock, Meter, PageSkeleton, SectionHead, recordStatusLabel } from "../components/ui";
import { SessionRow } from "../components/SessionRow";
import { ClassList } from "../components/ClassList";
import { useToast } from "../components/Toast";

export function TodayPage() {
  useDocumentTitle("Today");
  const overview = useOverview();
  const topics = useTopics();
  const labs = useLabs();
  const sources = useSources();
  const createQuiz = useCreateQuiz();
  const navigate = useNavigate();
  const toast = useToast();

  if (overview.isLoading || topics.isLoading) return <PageSkeleton />;
  if (overview.error || !overview.data) return <ErrorBlock error={overview.error} onRetry={() => overview.refetch()} />;

  const o = overview.data;
  const topicById = new Map(topics.data?.map((t) => [t.id, t]));
  const subjectById = new Map(o.subjects.map((s) => [s.id, s]));
  const labById = new Map(labs.data?.labs.map((l) => [l.id, l]));
  const withTopics = o.subjects.filter((s) => s.topicsTotal > 0);
  const nextExam = [...withTopics].sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
  const minutesLeft = o.todaySessions.filter((s) => !s.done).reduce((n, s) => n + s.minutes, 0);
  const doneCount = o.todaySessions.filter((s) => s.done).length;
  const dueThisWeek = o.dueExperiments.filter((e) => e.due && daysUntil(e.due) <= 7);
  const failed = sources.data?.filter((s) => s.status === "failed") ?? [];
  const isEmpty = o.subjects.length === 0;

  const practiseWeak = () =>
    createQuiz.mutate(
      { mode: "weak", count: 8 },
      { onSuccess: (q) => navigate(`/practice/${q.id}`), onError: (e) => toast(e.message, { error: true }) },
    );

  if (isEmpty) {
    return (
      <div className="page">
        <h1 className="page-title">{fmt.long(today())}</h1>
        <Empty
          title="Start with your timetable and lecture slides"
          action={
            <Link to="/sources" className="btn btn-primary">
              <Upload size={16} aria-hidden="true" /> Add material
            </Link>
          }
        >
          The timetable gives Slack your subjects, labs and class times. Lecture slides give it topics, what the
          assessment will ask, and quiz questions. Priorities and a revision plan follow from those.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">{fmt.long(today())}</h1>

      <dl className="props">
        {nextExam && (
          <>
            <dt>
              Next exam
            </dt>
            <dd>
              <Link to={`/subjects/${nextExam.id}`}>{nextExam.name}</Link>
              <span className="muted">
                {fmt.weekday(nextExam.examDate)} · {relativeDays(nextExam.examDate)}
                {!nextExam.examDateConfirmed && " · estimated"}
              </span>
            </dd>
          </>
        )}
        <dt>
          Study left today
        </dt>
        <dd>
          {o.todaySessions.length ? (
            <>
              {minutesLeft ? minutesLabel(minutesLeft) : "All done"}
              <span className="muted">
                · {doneCount} of {o.todaySessions.length} sessions done
              </span>
            </>
          ) : (
            <span className="muted">Nothing planned</span>
          )}
        </dd>
        <dt>
          Records due
        </dt>
        <dd>
          {dueThisWeek.length ? (
            <Link to="/labs">
              {dueThisWeek.length} record{dueThisWeek.length === 1 ? "" : "s"}
            </Link>
          ) : (
            <span className="muted">None</span>
          )}
        </dd>
      </dl>

      {failed.length > 0 && (
        <p className="callout callout-danger" role="status">
          {failed.length === 1 ? (
            <>
              <strong>{failed[0].filename}</strong> couldn't be read, so it isn't counted.{" "}
            </>
          ) : (
            <>{failed.length} files couldn't be read, so they aren't counted. </>
          )}
          <Link to="/sources">See why</Link>
        </p>
      )}

      {o.todayClasses.length > 0 && (
        <section className="section" aria-labelledby="today-classes">
          <SectionHead id="today-classes" title="Classes">
            <Link to="/timetable" className="btn btn-sm">
              Timetable
            </Link>
          </SectionHead>
          <ClassList slots={o.todayClasses} />
        </section>
      )}

      <section className="section" aria-labelledby="today-sessions">
        <SectionHead id="today-sessions" title="Study">
          <Link to="/plan" className="btn btn-sm">
            Full plan
          </Link>
        </SectionHead>
        {o.todaySessions.length ? (
          <ul className="sessions">
            {o.todaySessions.map((s) => {
              const t = topicById.get(s.topicId);
              return <SessionRow key={s.id} session={s} topic={t} subject={t && subjectById.get(t.subjectId)} />;
            })}
          </ul>
        ) : (
          <Empty title="Nothing planned for today" action={<Link to="/plan" className="btn btn-sm">Open revision plan</Link>}>
            Today is a rest day in your plan, or everything is already scheduled for later.
          </Empty>
        )}
      </section>

      <div className="two-col">
        <section className="section" aria-labelledby="today-weak">
          <SectionHead id="today-weak" title="Weak spots">
            {o.weakest.length > 0 && (
              <Button size="sm" onClick={practiseWeak} busy={createQuiz.isPending}>
                Practise these
              </Button>
            )}
          </SectionHead>
          {o.weakest.length ? (
            <>
              <ul className="list-plain">
                {o.weakest.map((c) => {
                  const t = topicById.get(c.topicId);
                  return (
                    <li key={`${c.topicId}-${c.concept}`}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>{c.concept}</div>
                        {t && (
                          <Link to={`/topics/${encodeURIComponent(t.id)}`} className="row-sub">
                            {t.title}
                          </Link>
                        )}
                      </div>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <Dots results={c.recent} />
                        <span className="num small" style={{ minWidth: "3ch", textAlign: "right" }}>
                          {Math.round((c.correct / c.attempts) * 100)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="small" style={{ marginTop: "var(--s-3)" }}>
                <Link to="/weak">All weak concepts</Link>
              </p>
            </>
          ) : (
            <Empty title="No weak concepts yet" action={<Link to="/practice" className="btn btn-sm">Take a quiz</Link>}>
              Anything you answer correctly less than 60% of the time shows up here.
            </Empty>
          )}
        </section>

        <section className="section" aria-labelledby="today-labs">
          <SectionHead id="today-labs" title="Records due" />
          {o.dueExperiments.length ? (
            <ul className="list-plain">
              {o.dueExperiments.map((e) => {
                const days = e.due ? daysUntil(e.due) : null;
                return (
                  <li key={e.id}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>
                        Exp {e.number}. {e.title}
                      </div>
                      <span className="row-sub">
                        {labById.get(e.labId)?.name} · {recordStatusLabel[e.status]}
                      </span>
                    </div>
                    {e.due && days !== null && (
                      <span className={`small${days <= 2 ? " due-soon" : " muted"}`} style={{ whiteSpace: "nowrap" }}>
                        {days < 0 ? `Overdue ${-days}d` : `Due ${relativeDays(e.due)}`}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No records due" action={<Link to="/labs" className="btn btn-sm">Lab records</Link>}>
              Add experiments to your labs as they're assigned and Slack will track their due dates.
            </Empty>
          )}
        </section>
      </div>

      {withTopics.length > 0 && (
        <section className="section" aria-labelledby="today-coverage">
          <SectionHead id="today-coverage" title="Syllabus covered" />
          <ul className="coverage">
            {withTopics.map((s) => (
              <li key={s.id}>
                <Link to={`/subjects/${s.id}`}>{s.name}</Link>
                <Meter value={s.topicsDone / s.topicsTotal} label={`${s.name}: ${s.topicsDone} of ${s.topicsTotal} topics done`} tone="success" />
                <span className="small muted num" style={{ textAlign: "right" }}>
                  {s.topicsDone}/{s.topicsTotal} topics
                </span>
              </li>
            ))}
          </ul>
          {withTopics.length < o.subjects.length && (
            <p className="small muted" style={{ marginTop: "var(--s-3)" }}>
              {o.subjects.length - withTopics.length} subjects have no topics yet.{" "}
              <Link to="/sources">Upload their slides or syllabus</Link>.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
