import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { PriorityTier, RecordStatus, SourceStatus, TopicStatus } from "../api/types";

// ---------------------------------------------------------------- button

type BtnVariant = "default" | "primary" | "ghost" | "danger";

export function Button({
  variant = "default",
  size,
  icon,
  busy,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm"; icon?: boolean; busy?: boolean }) {
  const cls = [
    "btn",
    variant !== "default" && `btn-${variant}`,
    size && `btn-${size}`,
    icon && "btn-icon",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} aria-busy={busy || undefined} disabled={rest.disabled || busy} {...rest}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ tags

const tierLabel: Record<PriorityTier, string> = { high: "High", medium: "Medium", low: "Low" };
const tierBars: Record<PriorityTier, number> = { high: 3, medium: 2, low: 1 };

export function PriorityTag({ tier }: { tier: PriorityTier }) {
  return (
    <span className={`tag tag-${tier}`}>
      <Signal level={tierBars[tier]} />
      {tierLabel[tier]}
    </span>
  );
}

function Signal({ level }: { level: number }) {
  return (
    <span className="signal" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= level ? "on" : undefined} />
      ))}
    </span>
  );
}

export const topicStatusLabel: Record<TopicStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export function TopicStatusTag({ status }: { status: TopicStatus }) {
  const cls = status === "done" ? "tag-done" : status === "in_progress" ? "tag-progress" : "tag-low";
  return <span className={`tag ${cls}`}>{topicStatusLabel[status]}</span>;
}

export const recordStatusLabel: Record<RecordStatus, string> = {
  not_started: "Not started",
  draft: "Draft",
  written: "Written",
  checked: "Checked",
};

export function SourceStatusTag({ status }: { status: SourceStatus }) {
  switch (status) {
    case "ready":
      return <span className="tag tag-done">Ready</span>;
    case "failed":
      return <span className="tag tag-failed">Failed</span>;
    case "processing":
      return (
        <span className="tag tag-progress">
          <span className="pulse" aria-hidden="true" />
          Reading
        </span>
      );
    default:
      return <span className="tag tag-low">Queued</span>;
  }
}

// ---------------------------------------------------------------- meters

export function Meter({ value, label, tone }: { value: number; label: string; tone?: "success" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`meter${tone ? ` meter-${tone}` : ""}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Score({ score }: { score: number }) {
  return (
    <span className="score">
      <Meter value={score / 100} label={`Priority score ${score} of 100`} />
      <span aria-hidden="true">{score}</span>
    </span>
  );
}

/** Recent quiz answers: filled square = correct, hollow red = wrong. */
export function Dots({ results }: { results: boolean[] }) {
  const right = results.filter(Boolean).length;
  return (
    <span className="dots" role="img" aria-label={`${right} of ${results.length} recent answers correct`}>
      {results.map((ok, i) => (
        <i key={i} className={ok ? "ok" : "miss"} />
      ))}
    </span>
  );
}

// ------------------------------------------------------------ segmented

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------- page chrome

export function Crumbs({ items }: { items: ReactNode[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="row" style={{ gap: "var(--s-1)" }}>
          {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
          {item}
        </span>
      ))}
    </nav>
  );
}

export function SectionHead({ title, note, children, id }: { title: string; note?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title" id={id}>
          {title}
        </h2>
        {note && <p className="section-note">{note}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

// ------------------------------------------------------- states / empty

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageSkeleton({ lines = 6 }: { lines?: number }) {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <span className="skel skel-title" />
      <span className="skel skel-line" style={{ width: "60%", marginTop: "var(--s-4)" }} />
      <div style={{ marginTop: "var(--s-6)" }}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="skel skel-line" style={{ width: `${92 - ((i * 13) % 30)}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="page">
      <div className="error-block" role="alert">
        <p className="empty-title">Couldn't load this page</p>
        <p className="muted">{message}</p>
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ highlight

const STOP = new Set(["and", "the", "with", "from", "into", "their", "vs", "basics", "problem", "problems", "methods"]);

/** Terms that tie a past-paper question to its topic. */
export function termsFor(title: string, concepts: string[]): string[] {
  const phrases = [title, ...concepts]
    .flatMap((s) => s.split(/[:,]| and | vs | to (?=[A-Z0-9])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && !STOP.has(s.toLowerCase()));
  const words = phrases.flatMap((p) => p.split(/\s+/)).filter((w) => w.length >= 7 && !STOP.has(w.toLowerCase()));
  return [...new Set([...phrases, ...words])].sort((a, b) => b.length - a.length);
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}
    </>
  );
}
