import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Clock, Info, RefreshCw } from "lucide-react";
import { usePlan, useRegeneratePlan, useSubjects, useTopics } from "../api/hooks";
import type { PlanSession } from "../api/types";
import { fmt, minutesLabel, relativeDays, timeAgo, todayISO } from "../lib/dates";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Empty, ErrorBlock, Meter, PageSkeleton, SectionHead, Segmented } from "../components/ui";
import { SessionRow } from "../components/SessionRow";
import { useToast } from "../components/Toast";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Range = "upcoming" | "past";

export function PlanPage() {
  useDocumentTitle("Revision plan");
  const plan = usePlan();
  const topics = useTopics();
  const subjects = useSubjects();
  const [range, setRange] = useState<Range>("upcoming");

  if (plan.isLoading || topics.isLoading) return <PageSkeleton lines={12} />;
  if (plan.error || !plan.data) return <ErrorBlock error={plan.error} onRetry={() => plan.refetch()} />;

  const p = plan.data;
  const now = todayISO();
  const topicById = new Map(topics.data?.map((t) => [t.id, t]));
  const subjectById = new Map(subjects.data?.map((s) => [s.id, s]));
  const examsByDate = new Map<string, string[]>();
  const plannedSubjects = (subjects.data ?? []).filter((s) => topics.data?.some((t) => t.subjectId === s.id));
  plannedSubjects.forEach((s) => examsByDate.set(s.examDate, [...(examsByDate.get(s.examDate) ?? []), s.name]));
  const estimated = plannedSubjects.filter((s) => !s.examDateConfirmed);

  const total = p.sessions.length;
  const done = p.sessions.filter((s) => s.done).length;
  const remainingMins = p.sessions.filter((s) => !s.done && s.date >= now).reduce((n, s) => n + s.minutes, 0);
  const missed = p.sessions.filter((s) => !s.done && s.date < now).length;
  const lastDate = p.sessions.reduce((m, s) => (s.date > m ? s.date : m), now);

  const visible = p.sessions.filter((s) => (range === "upcoming" ? s.date >= now : s.date < now));
  const byDay = groupByDay(visible);
  const days = [...byDay.keys()].sort((a, b) => (range === "upcoming" ? a.localeCompare(b) : b.localeCompare(a)));
  const examDates = [...examsByDate.keys()].filter((d) => (range === "upcoming" ? d >= now : d < now));

  return (
    <div className="page">
      <h1 className="page-title">Revision plan</h1>
      <p className="page-lede">
        Built from your priorities and timetable: high-priority topics come first, a subject moves up on days you have
        its lecture, each topic gets a practice quiz two days after you study it, and the week before each exam is kept
        for revision.
      </p>

      {estimated.length > 0 && (
        <div className="callout" style={{ marginTop: "var(--s-5)" }}>
          <Info size={18} aria-hidden="true" />
          <p>
            Exam dates for {estimated.map((s) => s.name).join(", ")} are estimates.{" "}
            <Link to="/settings#exams">Set the real dates</Link> and rebuild the plan so nothing lands after an exam.
          </p>
        </div>
      )}

      <dl className="props">
        <dt>
          <CalendarRange size={16} aria-hidden="true" /> Runs until
        </dt>
        <dd>
          {fmt.weekday(lastDate)} <span className="muted">· {relativeDays(lastDate)}</span>
        </dd>
        <dt>
          <Clock size={16} aria-hidden="true" /> Study time left
        </dt>
        <dd>
          {minutesLabel(remainingMins)}
          <span className="muted">
            · {p.hoursPerDay} h a day, rest on {p.restDays.length ? p.restDays.map((d) => WEEKDAYS[d]).join(", ") : "no days"}
          </span>
        </dd>
        <dt>Progress</dt>
        <dd>
          <span style={{ width: "8rem" }}>
            <Meter value={total ? done / total : 0} label={`${done} of ${total} sessions done`} tone="success" />
          </span>
          <span className="num">
            {done} of {total} sessions
          </span>
          {missed > 0 && <span className="muted">· {missed} missed</span>}
        </dd>
      </dl>

      <PlanSettings hoursPerDay={p.hoursPerDay} restDays={p.restDays} generatedAt={p.generatedAt} />

      <section className="section" aria-label="Sessions">
        <div className="toolbar">
          <Segmented<Range>
            label="Show"
            value={range}
            onChange={setRange}
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ]}
          />
        </div>

        {days.length === 0 && (
          <Empty title={range === "upcoming" ? "No sessions left" : "No past sessions yet"}>
            {range === "upcoming"
              ? "Everything up to your last exam is done. Regenerate the plan if your exam dates changed."
              : "Sessions from earlier days will show here so you can catch up on anything you missed."}
          </Empty>
        )}

        {mergeExamDays(days, examDates, range).map((date) => {
          const sessions = byDay.get(date) ?? [];
          const exams = examsByDate.get(date);
          const mins = sessions.reduce((n, s) => n + s.minutes, 0);
          return (
            <div key={date}>
              {sessions.length > 0 && (
                <>
                  <div className={`day-head${date === now ? " is-today" : ""}`}>
                    <h3>{fmt.weekday(date)}</h3>
                    <span className="small muted">{minutesLabel(mins)}</span>
                  </div>
                  <ul className="sessions">
                    {sessions.map((s) => {
                      const t = topicById.get(s.topicId);
                      return <SessionRow key={s.id} session={s} topic={t} subject={t && subjectById.get(t.subjectId)} />;
                    })}
                  </ul>
                </>
              )}
              {exams && (
                <p className="exam-marker">
                  {fmt.weekday(date)} · Exam: {exams.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function PlanSettings({ hoursPerDay, restDays, generatedAt }: { hoursPerDay: number; restDays: number[]; generatedAt: string | null }) {
  const regenerate = useRegeneratePlan();
  const toast = useToast();
  const [hours, setHours] = useState(hoursPerDay);
  const [rest, setRest] = useState<number[]>(restDays);

  const restKey = restDays.join();
  useEffect(() => {
    setHours(hoursPerDay);
    setRest(restKey ? restKey.split(",").map(Number) : []);
  }, [hoursPerDay, restKey]);

  const dirty = hours !== hoursPerDay || rest.join() !== restDays.join();

  return (
    <section className="section" aria-labelledby="plan-settings">
      <SectionHead id="plan-settings" title="Plan settings" note={generatedAt ? `Last generated ${timeAgo(generatedAt)}.` : "Not generated yet."} />
      <form
        className="stack"
        style={{ gap: "var(--s-4)" }}
        onSubmit={(e) => {
          e.preventDefault();
          regenerate.mutate(
            { hoursPerDay: hours, restDays: rest },
            {
              onSuccess: () => toast("Plan rebuilt from your current priorities."),
              onError: (err) => toast(err.message, { error: true }),
            },
          );
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Study hours per day</span>
            <select className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {[1, 1.5, 2, 2.5, 3, 4, 5, 6].map((h) => (
                <option key={h} value={h}>
                  {h} {h === 1 ? "hour" : "hours"}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ padding: 0, marginBottom: "var(--s-1)" }}>
              Rest days
            </legend>
            <div className="weekday-picker">
              {WEEKDAYS.map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={rest.includes(i)}
                    onChange={(e) => setRest((r) => (e.target.checked ? [...r, i].sort() : r.filter((x) => x !== i)))}
                  />
                  <span>{d}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="row">
          <Button type="submit" variant={dirty ? "primary" : "default"} busy={regenerate.isPending}>
            <RefreshCw size={16} aria-hidden="true" />
            Rebuild plan
          </Button>
          <span className="small muted">Completed sessions are kept. Everything from today on is rescheduled.</span>
        </div>
      </form>
    </section>
  );
}

function groupByDay(sessions: PlanSession[]) {
  const map = new Map<string, PlanSession[]>();
  for (const s of sessions) map.set(s.date, [...(map.get(s.date) ?? []), s]);
  return map;
}

function mergeExamDays(days: string[], examDates: string[], range: Range) {
  const all = [...new Set([...days, ...examDates])];
  return all.sort((a, b) => (range === "upcoming" ? a.localeCompare(b) : b.localeCompare(a)));
}
