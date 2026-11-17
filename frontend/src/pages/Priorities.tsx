import { Fragment, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useSubjects, useTopics, useUnitsLookup } from "../api/hooks";
import type { PriorityTier, Subject, Topic } from "../api/types";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Empty, ErrorBlock, PageSkeleton, PriorityTag, Score, Segmented } from "../components/ui";
import { FactorList } from "../components/FactorList";
import { TopicStatusSelect } from "../components/TopicStatusSelect";
import { ScoringNote } from "../components/ScoringNote";
import { shortCode } from "../lib/subjects";

type TierFilter = "all" | PriorityTier;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function PrioritiesPage() {
  useDocumentTitle("Priorities");
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject") ?? "all";
  const tier = (params.get("tier") ?? "all") as TierFilter;
  const [hideDone, setHideDone] = useState(false);

  const topics = useTopics();
  const subjects = useSubjects();
  const unitTitle = useUnitsLookup();

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  if (topics.isLoading || subjects.isLoading) return <PageSkeleton lines={10} />;
  if (topics.error || !topics.data) return <ErrorBlock error={topics.error} onRetry={() => topics.refetch()} />;
  if (!topics.data.length) {
    return (
      <div className="page">
        <h1 className="page-title">Priorities</h1>
        <Empty title="Nothing to rank yet" action={<Link to="/sources" className="btn btn-primary">Upload material</Link>}>
          Topics come from your lecture slides and syllabus. Upload them and every topic gets a score with the evidence
          behind it.
        </Empty>
      </div>
    );
  }

  const subjectById = new Map(subjects.data?.map((s) => [s.id, s]));
  const rows = topics.data.filter(
    (t) =>
      (subject === "all" || t.subjectId === subject) &&
      (tier === "all" || t.priority.tier === tier) &&
      (!hideDone || t.status !== "done"),
  );
  const missing = [
    ...new Set(
      topics.data.flatMap((t) => t.priority.factors.filter((f) => !f.available).map((f) => f.label)),
    ),
  ].filter((label) => topics.data.every((t) => t.priority.factors.some((f) => f.label === label && !f.available)));
  const counts = {
    high: topics.data.filter((t) => t.priority.tier === "high").length,
    medium: topics.data.filter((t) => t.priority.tier === "medium").length,
    low: topics.data.filter((t) => t.priority.tier === "low").length,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Priorities</h1>
          <p className="page-lede">What to study first, and the evidence for it. Open a row to see the marking.</p>
        </div>
      </div>

      <p className="tally">
        {plural(counts.high, "topic")} high, {counts.medium} medium, {counts.low} low.
      </p>

      {missing.length > 0 && (
        <p className="callout">
          Not marked yet: {missing.join(", ").toLowerCase()}. <Link to="/sources">Add past papers or the syllabus</Link> and
          these get counted.
        </p>
      )}

      <section className="section">
        <div className="toolbar">
          <Segmented
            label="Filter by subject"
            value={subject}
            onChange={(v) => setParam("subject", v)}
            options={[
              { value: "all", label: "All subjects" },
              ...(subjects.data ?? []).filter((s) => topics.data.some((t) => t.subjectId === s.id)).map((s) => ({ value: s.id, label: shortCode(s) })),
            ]}
          />
          <Segmented<TierFilter>
            label="Filter by priority"
            value={tier}
            onChange={(v) => setParam("tier", v)}
            options={[
              { value: "all", label: "Any priority" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <label className="row small" style={{ cursor: "pointer" }}>
            <input type="checkbox" className="check" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Hide done
          </label>
        </div>

        {rows.length ? (
          <PriorityTable rows={rows} subjectById={subjectById} unitTitle={unitTitle} />
        ) : (
          <Empty title="No topics match these filters">Try another subject or priority level.</Empty>
        )}
        <ScoringNote factors={topics.data[0]?.priority.factors} />
      </section>
    </div>
  );
}

export function PriorityTable({
  rows,
  subjectById,
  unitTitle,
  showSubject = true,
}: {
  rows: Topic[];
  subjectById: Map<string, Subject>;
  unitTitle: (unitId: string) => string;
  showSubject?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="table-wrap hanging">
      <table className="table table-stack table-priorities">
        <thead>
          <tr>
            <th className="col-score">Score</th>
            <th className="col-fit hide-sm">
              <span className="sr-only">Details</span>
            </th>
            <th>Topic</th>
            <th className="col-num">Past papers</th>
            <th className="col-num">Quiz accuracy</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const isOpen = open.has(t.id);
            const subject = subjectById.get(t.subjectId);
            return (
              <Fragment key={t.id}>
                <tr className={isOpen ? "expanded" : undefined}>
                  <td className="col-score">
                    <Score score={t.priority.score} tier={t.priority.tier} />
                    <PriorityTag tier={t.priority.tier} />
                  </td>
                  <td className="col-fit hide-sm">
                    <button
                      type="button"
                      className="disclose"
                      aria-expanded={isOpen}
                      aria-controls={`why-${t.id}`}
                      aria-label={`Why ${t.title} has this score`}
                      onClick={() => toggle(t.id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                  <td>
                    <Link to={`/topics/${t.id}`} className="row-title">
                      {t.title}
                    </Link>
                    <span className="row-sub">
                      {showSubject && subject ? `${subject.code} · ` : ""}
                      {unitTitle(t.unitId)}
                    </span>
                  </td>
                  <td className="col-num" data-label="Past papers">
                    {t.papers.total ? `${t.papers.asked} of ${t.papers.total}` : <span className="muted">—</span>}
                  </td>
                  <td className="col-num" data-label="Quiz accuracy">
                    {t.mastery === null ? <span className="muted">No data</span> : `${Math.round(t.mastery * 100)}%`}
                  </td>
                  <td data-label="Status">
                    <TopicStatusSelect topic={t} size="sm" />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="detail-row" id={`why-${t.id}`}>
                    <td />
                    <td colSpan={5}>
                      <FactorList priority={t.priority} />
                      <p className="small" style={{ marginTop: "var(--s-4)" }}>
                        <Link to={`/topics/${t.id}`}>All {t.evidenceCount} pieces of evidence</Link>
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
