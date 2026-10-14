import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { usePatchProfile, useTimetable } from "../api/hooks";
import type { TimetableSlot } from "../api/types";
import { fmt } from "../lib/dates";
import { TT_DAYS } from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Empty, ErrorBlock, PageSkeleton, Segmented } from "../components/ui";
import { ClassList } from "../components/ClassList";
import { useToast } from "../components/Toast";

type Show = "mine" | "all";

export function TimetablePage() {
  useDocumentTitle("Timetable");
  const tt = useTimetable();
  const patch = usePatchProfile();
  const toast = useToast();
  const [show, setShow] = useState<Show>("mine");

  if (tt.isLoading) return <PageSkeleton lines={8} />;
  if (tt.error || !tt.data) return <ErrorBlock error={tt.error} onRetry={() => tt.refetch()} />;
  const t = tt.data;

  if (!t.slots.length) {
    return (
      <div className="page">
        <h1 className="page-title">Timetable</h1>
        <Empty title="No timetable yet" action={<Link to="/sources" className="btn btn-primary">Upload timetable</Link>}>
          Upload the timetable PDF your department shares (the aSc Timetables export). Slack reads your class's
          lectures and labs, links them to your subjects, and fits revision around them.
        </Empty>
      </div>
    );
  }

  const visible = t.slots.filter((s) => show === "all" || s.group === null || s.group === t.labGroup);
  const days = TT_DAYS.map((_, i) => i).filter((d) => t.slots.some((s) => s.day === d));
  const todayIdx = (new Date().getDay() + 6) % 7;
  const periods = [...t.periods].sort((a, b) => a.number - b.number);
  const breakAfter = periods.findIndex((p, i) => i < periods.length - 1 && gapMinutes(p.end, periods[i + 1].start) >= 30);

  return (
    <div className="page page-wide">
      <h1 className="page-title">Timetable</h1>
      <dl className="props">
        <dt>Class</dt>
        <dd>{t.classLabel ?? "—"}</dd>
        <dt>Lab group</dt>
        <dd>
          <Segmented<string>
            label="Your lab group"
            value={String(t.labGroup)}
            onChange={(v) =>
              patch.mutate(
                { labGroup: Number(v) },
                { onSuccess: () => toast(`Showing Group ${v} labs. Rebuild your plan to use the new lab times.`) },
              )
            }
            options={[
              { value: "1", label: "Group 1" },
              { value: "2", label: "Group 2" },
            ]}
          />
        </dd>
        {t.effectiveFrom && (
          <>
            <dt>In effect from</dt>
            <dd>{fmt.short(t.effectiveFrom)}</dd>
          </>
        )}
      </dl>

      <div className="toolbar" style={{ marginTop: "var(--s-5)" }}>
        <Segmented<Show>
          label="Labs shown"
          value={show}
          onChange={setShow}
          options={[
            { value: "mine", label: "My group" },
            { value: "all", label: "Both groups" },
          ]}
        />
      </div>

      <div className="tt-wrap">
        <table className="tt">
          <caption className="sr-only">Weekly timetable for {t.classLabel}</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Day</span>
              </th>
              {periods.map((p, i) => (
                <Fragment key={p.number}>
                  <th scope="col">
                    <span className="tt-time">
                      {p.start}–{p.end}
                    </span>
                  </th>
                  {i === breakAfter && (
                    <th scope="col" className="tt-break">
                      <span className="sr-only">Break</span>
                    </th>
                  )}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d} className={d === todayIdx ? "is-today" : undefined}>
                <th scope="row">{TT_DAYS[d].slice(0, 3)}</th>
                {renderRow(visible.filter((s) => s.day === d), periods.map((p) => p.number), breakAfter)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tt-list">
        {days.map((d) => (
          <section key={d} className="section" aria-labelledby={`tt-${d}`}>
            <h2 className="section-title" id={`tt-${d}`} style={{ marginBottom: "var(--s-2)" }}>
              {TT_DAYS[d]}
              {d === todayIdx && <span className="tag tag-progress" style={{ marginLeft: "var(--s-2)" }}>Today</span>}
            </h2>
            <ClassList slots={visible.filter((s) => s.day === d)} live={d === todayIdx} />
          </section>
        ))}
      </div>
    </div>
  );
}

function renderRow(slots: TimetableSlot[], periodNumbers: number[], breakAfter: number) {
  const cells: JSX.Element[] = [];
  let i = 0;
  while (i < periodNumbers.length) {
    const p = periodNumbers[i];
    const starting = slots.filter((s) => s.periods[0] === p);
    const span = Math.max(1, ...starting.map((s) => s.periods.length));
    const crossesBreak = breakAfter >= i && breakAfter < i + span - 1;
    cells.push(
      <td key={p} colSpan={span + (crossesBreak ? 1 : 0)} className={starting.length ? `tt-cell is-${starting[0].kind}` : "tt-cell is-empty"}>
        {starting.map((s) => (
          <div key={s.id} className="tt-slot">
            <span className="tt-title">
              {s.subjectId ? <Link to={`/subjects/${s.subjectId}`}>{s.title}</Link> : s.title}
            </span>
            <span className="tt-meta">
              {[s.group ? `G${s.group}` : null, s.room, s.faculty].filter(Boolean).join(" · ")}
            </span>
          </div>
        ))}
      </td>,
    );
    if (i + span - 1 >= breakAfter && i <= breakAfter && !crossesBreak) {
      cells.push(<td key={`break-${p}`} className="tt-break" aria-hidden="true" />);
    }
    i += span;
  }
  return cells;
}

function gapMinutes(end: string, start: string) {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return toMin(start) - toMin(end);
}
