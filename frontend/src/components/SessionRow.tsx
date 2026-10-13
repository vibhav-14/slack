import { Link } from "react-router-dom";
import type { PlanSession, SessionKind, Subject, Topic } from "../api/types";
import { useToggleSession } from "../api/hooks";
import { minutesLabel } from "../lib/dates";
import { PriorityTag } from "./ui";
import { useToast } from "./Toast";

export const sessionKindLabel: Record<SessionKind, string> = {
  learn: "Learn",
  revise: "Revise",
  practice: "Practice quiz",
};

export function SessionRow({
  session,
  topic,
  subject,
}: {
  session: PlanSession;
  topic: Topic | undefined;
  subject: Subject | undefined;
}) {
  const toggle = useToggleSession();
  const toast = useToast();
  const id = `session-${session.id}`;
  const title = topic?.title ?? "Topic removed";

  return (
    <li className={`session${session.done ? " is-done" : ""}`}>
      <input
        id={id}
        type="checkbox"
        className="check"
        checked={session.done}
        aria-label={`${sessionKindLabel[session.kind]}: ${title}`}
        onChange={(e) =>
          toggle.mutate(
            { id: session.id, done: e.target.checked },
            { onError: () => toast("Couldn't update the session. Try again.", { error: true }) },
          )
        }
      />
      <div style={{ minWidth: 0 }}>
        {topic ? (
          <Link to={`/topics/${topic.id}`} className="session-title">
            {title}
          </Link>
        ) : (
          <span className="session-title">{title}</span>
        )}
        <div className="session-meta">
          <span>{sessionKindLabel[session.kind]}</span>
          <span>{minutesLabel(session.minutes)}</span>
          {subject && <span className="mono">{subject.code}</span>}
        </div>
      </div>
      {topic && <PriorityTag tier={topic.priority.tier} />}
    </li>
  );
}
