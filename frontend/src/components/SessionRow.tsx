import { Link } from "react-router-dom";
import type { PlanSession, Subject, Topic } from "../api/types";
import { useToggleSession } from "../api/hooks";
import { minutesLabel } from "../lib/dates";
import { sessionKindLabel } from "../lib/labels";
import { shortCode } from "../lib/subjects";
import { PriorityTag } from "./ui";
import { useToast } from "./Toast";

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
  const title = topic?.title ?? "Topic removed";

  return (
    <li className={`session${session.done ? " is-done" : ""}`}>
      <input
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
          <Link to={`/topics/${encodeURIComponent(topic.id)}`} className="session-title">
            {title}
          </Link>
        ) : (
          <span className="session-title">{title}</span>
        )}
        <div className="session-meta">
          <span>{sessionKindLabel[session.kind]}</span>
          <span>{minutesLabel(session.minutes)}</span>
          {subject && <span className="mono">{shortCode(subject)}</span>}
        </div>
        {session.reason && <p className="session-reason">{session.reason}</p>}
      </div>
      {topic && <PriorityTag tier={topic.priority.tier} />}
    </li>
  );
}
