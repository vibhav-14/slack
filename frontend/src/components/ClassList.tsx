import { Link } from "react-router-dom";
import type { TimetableSlot } from "../api/types";

/** A day's classes, with the one in progress marked. */
export function ClassList({ slots, live = true }: { slots: TimetableSlot[]; live?: boolean }) {
  const now = new Date();
  const mins = live ? now.getHours() * 60 + now.getMinutes() : -1;
  const toMin = (t: string | null) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return (
    <ul className="classes">
      {slots.map((s) => {
        const state = toMin(s.end) <= mins ? "past" : toMin(s.start) <= mins ? "now" : "next";
        return (
          <li key={s.id} className={`class-row is-${state}`}>
            <span className="class-time num">
              {s.start}–{s.end}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="class-title">
                {s.subjectId ? <Link to={`/subjects/${s.subjectId}`}>{s.title}</Link> : s.title}
                {state === "now" && <span className="tag tag-progress">Now</span>}
              </div>
              <span className="row-sub">
                {[s.room, s.faculty, s.group ? `Group ${s.group}` : null].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="small muted">{s.kind === "lab" ? "Lab" : s.kind === "other" ? "Session" : "Lecture"}</span>
          </li>
        );
      })}
    </ul>
  );
}
