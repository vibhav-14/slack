import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConcepts, useCreateQuiz, useQuizzes, useSubjects, useTopics } from "../api/hooks";
import { isWeak } from "../lib/constants";
import { timeAgo } from "../lib/dates";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Empty, ErrorBlock, PageSkeleton, SectionHead } from "../components/ui";
import { useToast } from "../components/Toast";

type Mode = "weak" | "priority" | "topics";

export function PracticePage() {
  useDocumentTitle("Practice");
  const quizzes = useQuizzes();
  const concepts = useConcepts();
  const topics = useTopics();
  const subjects = useSubjects();
  const createQuiz = useCreateQuiz();
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>("weak");
  const [count, setCount] = useState(8);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  if (quizzes.isLoading || topics.isLoading) return <PageSkeleton lines={10} />;
  if (quizzes.error) return <ErrorBlock error={quizzes.error} onRetry={() => quizzes.refetch()} />;

  const weakCount = concepts.data?.filter(isWeak).length ?? 0;
  const highCount = topics.data?.filter((t) => t.priority.tier === "high").length ?? 0;
  const canStart = mode !== "topics" ? (mode === "weak" ? weakCount > 0 : highCount > 0) : picked.size > 0;

  const start = () =>
    createQuiz.mutate(
      { mode, count, topicIds: mode === "topics" ? [...picked] : undefined },
      { onSuccess: (q) => navigate(`/practice/${q.id}`), onError: (e) => toast(e.message, { error: true }) },
    );

  const modes: { value: Mode; title: string; desc: string }[] = [
    {
      value: "weak",
      title: "Weak concepts",
      desc: weakCount
        ? `${weakCount} concept${weakCount === 1 ? "" : "s"} you're answering correctly less than 60% of the time.`
        : "Nothing is weak right now. Take a topic quiz to find out.",
    },
    {
      value: "priority",
      title: "High-priority topics",
      desc: `The ${highCount} topics most likely to carry marks in your exams.`,
    },
    { value: "topics", title: "Choose topics", desc: "Pick exactly what to be tested on." },
  ];

  return (
    <div className="page">
      <h1 className="page-title">Practice</h1>
      <p className="page-lede">
        Short multiple-choice quizzes. Every answer updates your concept accuracy, which feeds back into topic priorities.
      </p>

      <section className="section" aria-labelledby="new-quiz">
        <SectionHead id="new-quiz" title="Start a quiz" />
        <form
          className="stack"
          style={{ gap: "var(--s-5)" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (canStart) start();
          }}
        >
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="sr-only">What to practise</legend>
            <div className="q-options" style={{ marginTop: 0 }}>
              {modes.map((m) => (
                <label key={m.value} className="q-option" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
                  <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} />
                  <span className="q-key" aria-hidden="true">
                    {mode === m.value ? "●" : ""}
                  </span>
                  <span>
                    <span style={{ fontWeight: 500, display: "block" }}>{m.title}</span>
                    <span className="small muted">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === "topics" && (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label" style={{ padding: 0 }}>
                Topics <span className="muted small">· {picked.size} selected</span>
              </legend>
              <div className="two-col" style={{ gap: "0 var(--s-6)" }}>
                {subjects.data?.map((s) => (
                  <div key={s.id} style={{ marginTop: "var(--s-3)" }}>
                    <p className="small muted" style={{ margin: "var(--s-2) 0" }}>
                      {s.name}
                    </p>
                    <ul className="list-plain">
                      {topics.data
                        ?.filter((t) => t.subjectId === s.id)
                        .map((t) => (
                          <li key={t.id} style={{ padding: "var(--s-2) 0" }}>
                            <label className="row" style={{ flexWrap: "nowrap", cursor: "pointer", alignItems: "flex-start" }}>
                              <input
                                type="checkbox"
                                className="check"
                                style={{ marginTop: "0.15em" }}
                                checked={picked.has(t.id)}
                                onChange={(e) =>
                                  setPicked((p) => {
                                    const next = new Set(p);
                                    if (e.target.checked) next.add(t.id);
                                    else next.delete(t.id);
                                    return next;
                                  })
                                }
                              />
                              <span>{t.title}</span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="row" style={{ gap: "var(--s-4)" }}>
            <label className="row">
              <span className="field-label">Questions</span>
              <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 8, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary" disabled={!canStart} busy={createQuiz.isPending}>
              Start quiz
            </Button>
            {mode === "topics" && !picked.size && <span className="small muted">Select at least one topic.</span>}
          </div>
        </form>
      </section>

      <section className="section" aria-labelledby="history">
        <SectionHead id="history" title="Past quizzes" />
        {quizzes.data?.length ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Taken</th>
                  <th className="col-num">Score</th>
                  <th className="col-fit">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quizzes.data.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link to={`/practice/${q.id}`} className="row-title">
                        {q.title}
                      </Link>
                      <span className="row-sub">{q.questions.length} questions</span>
                    </td>
                    <td data-label="Taken">{timeAgo(q.submittedAt ?? q.createdAt)}</td>
                    <td className="col-num" data-label="Score">
                      {q.score === null ? (
                        <span className="muted">Not finished</span>
                      ) : (
                        <>
                          {q.score}/{q.questions.length}{" "}
                          <span className="muted">({Math.round((q.score / q.questions.length) * 100)}%)</span>
                        </>
                      )}
                    </td>
                    <td className="col-fit">
                      <Link to={`/practice/${q.id}`} className="btn btn-sm">
                        {q.submittedAt ? "Review" : "Resume"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No quizzes yet">Your first quiz sets the baseline for which concepts need work.</Empty>
        )}
      </section>
    </div>
  );
}
