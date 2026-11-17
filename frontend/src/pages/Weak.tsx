import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConcepts, useCreateQuiz, useSubjects, useTopics } from "../api/hooks";
import { isWeak, WEAK_THRESHOLD } from "../lib/constants";
import { timeAgo } from "../lib/dates";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Dots, Empty, ErrorBlock, PageSkeleton, Segmented } from "../components/ui";
import { useToast } from "../components/Toast";

type Show = "weak" | "all";

export function WeakPage() {
  useDocumentTitle("Weak concepts");
  const concepts = useConcepts();
  const topics = useTopics();
  const subjects = useSubjects();
  const createQuiz = useCreateQuiz();
  const navigate = useNavigate();
  const toast = useToast();
  const [show, setShow] = useState<Show>("weak");

  if (concepts.isLoading) return <PageSkeleton lines={10} />;
  if (concepts.error || !concepts.data) return <ErrorBlock error={concepts.error} onRetry={() => concepts.refetch()} />;

  const topicById = new Map(topics.data?.map((t) => [t.id, t]));
  const subjectById = new Map(subjects.data?.map((s) => [s.id, s]));
  const weak = concepts.data.filter(isWeak);
  const rows = show === "weak" ? weak : concepts.data;

  const practise = () =>
    createQuiz.mutate(
      { mode: "weak", count: 8 },
      { onSuccess: (q) => navigate(`/practice/${q.id}`), onError: (e) => toast(e.message, { error: true }) },
    );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Weak spots</h1>
          <p className="page-lede">
            Anything under {WEAK_THRESHOLD * 100}% after at least three answers.
          </p>
        </div>
        {weak.length > 0 && (
          <div className="page-actions">
            <Button variant="primary" onClick={practise} busy={createQuiz.isPending}>
              Practise weak concepts
            </Button>
          </div>
        )}
      </div>

      <section className="section">
        <div className="toolbar">
          <Segmented<Show>
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: "weak", label: `Weak (${weak.length})` },
              { value: "all", label: `All tracked (${concepts.data.length})` },
            ]}
          />
        </div>

        {rows.length ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Concept</th>
                  <th>Subject</th>
                  <th>Last answers</th>
                  <th className="col-num">Accuracy</th>
                  <th>Last practised</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const t = topicById.get(c.topicId);
                  const s = subjectById.get(c.subjectId);
                  const pct = Math.round((c.correct / c.attempts) * 100);
                  return (
                    <tr key={`${c.topicId}-${c.concept}`}>
                      <td>
                        <span style={{ fontWeight: 500 }}>{c.concept}</span>
                        {t && (
                          <Link to={`/topics/${t.id}`} className="row-sub">
                            {t.title}
                          </Link>
                        )}
                      </td>
                      <td data-label="Subject">
                        <span className="mono">{s?.code}</span>
                      </td>
                      <td data-label="Last answers">
                        <Dots results={c.recent} />
                      </td>
                      <td className="col-num" data-label="Accuracy">
                        <span style={{ color: isWeak(c) ? "var(--danger)" : undefined, fontWeight: 500 }}>{pct}%</span>{" "}
                        <span className="muted small">of {c.attempts}</span>
                      </td>
                      <td data-label="Last practised">{c.lastSeen ? timeAgo(c.lastSeen) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={show === "weak" ? "No weak concepts" : "No concepts tracked yet"}
            action={
              <Link to="/practice" className="btn btn-sm">
                Take a quiz
              </Link>
            }
          >
            {show === "weak"
              ? "You're above 60% on everything you've practised. Keep taking topic quizzes to stay on top of it."
              : "Concepts appear here after you answer quiz questions on them."}
          </Empty>
        )}
      </section>
    </div>
  );
}
