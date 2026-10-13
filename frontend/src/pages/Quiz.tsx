import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useQuiz, useSubmitQuiz, useTopics } from "../api/hooks";
import type { Quiz } from "../api/types";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Crumbs, ErrorBlock, Meter, PageSkeleton, SectionHead } from "../components/ui";
import { useToast } from "../components/Toast";

const KEYS = ["A", "B", "C", "D", "E"];

export function QuizPage() {
  const { id = "" } = useParams();
  const q = useQuiz(id);
  useDocumentTitle(q.data ? `Quiz: ${q.data.title}` : "Quiz");

  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;

  return q.data.submittedAt ? <Results quiz={q.data} /> : <TakeQuiz quiz={q.data} />;
}

function draftKey(id: string) {
  return `margin.quiz-draft.${id}`;
}

function TakeQuiz({ quiz }: { quiz: Quiz }) {
  const submit = useSubmitQuiz();
  const toast = useToast();
  const total = quiz.questions.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => {
    try {
      const saved = sessionStorage.getItem(draftKey(quiz.id));
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return Array(total).fill(null);
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(quiz.id), JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers, quiz.id]);

  const question = quiz.questions[index];
  const answered = answers.filter((a) => a !== null).length;
  const isLast = index === total - 1;

  const choose = (opt: number) => setAnswers((a) => a.map((v, i) => (i === index ? opt : v)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== "radio") return;
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      const letter = KEYS.indexOf(e.key.toUpperCase());
      const opt = n >= 1 && n <= question.options.length ? n - 1 : letter >= 0 && letter < question.options.length ? letter : -1;
      if (opt >= 0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setAnswers((a) => a.map((v, i) => (i === index ? opt : v)));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, question.options.length]);

  const finish = () =>
    submit.mutate(
      { id: quiz.id, answers },
      {
        onSuccess: () => {
          try {
            sessionStorage.removeItem(draftKey(quiz.id));
          } catch {
            // ignore
          }
          window.scrollTo(0, 0);
        },
        onError: (e) => toast(e.message, { error: true }),
      },
    );

  return (
    <div className="page">
      <div className="quiz">
        <Crumbs items={[<Link to="/practice">Practice</Link>, <span>{quiz.title}</span>]} />
        <h1 className="page-title">{quiz.title}</h1>

        <div className="quiz-progress">
          <span className="num">
            Question {index + 1} of {total}
          </span>
          <Meter value={answered / total} label={`${answered} of ${total} answered`} />
          <span className="num">{answered} answered</span>
        </div>

        <div key={question.id}>
          <p className="q-concept">{question.concept}</p>
          <p className="q-prompt" id={`prompt-${question.id}`}>
            {question.prompt}
          </p>
          <div className="q-options" role="radiogroup" aria-labelledby={`prompt-${question.id}`}>
            {question.options.map((opt, i) => (
              <label key={i} className="q-option">
                <input type="radio" name={`q-${question.id}`} checked={answers[index] === i} onChange={() => choose(i)} />
                <span className="q-key" aria-hidden="true">
                  {KEYS[i]}
                </span>
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
        <p className="small muted" style={{ marginTop: "var(--s-3)" }}>
          Tip: press A–D or 1–4 to choose.
        </p>

        <div className="quiz-nav">
          <Button onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
            <ArrowLeft size={16} aria-hidden="true" /> Previous
          </Button>
          {isLast ? (
            <Button variant="primary" onClick={finish} busy={submit.isPending}>
              {answered < total ? `Submit with ${total - answered} unanswered` : "Submit answers"}
            </Button>
          ) : (
            <Button variant={answers[index] !== null ? "primary" : "default"} onClick={() => setIndex((i) => i + 1)}>
              Next <ArrowRight size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Results({ quiz }: { quiz: Quiz }) {
  const topics = useTopics();
  const topicById = new Map(topics.data?.map((t) => [t.id, t]));
  const total = quiz.questions.length;
  const score = quiz.score ?? 0;
  const answers = quiz.answers ?? [];

  const byConcept = new Map<string, { right: number; total: number; topicId: string }>();
  quiz.questions.forEach((q, i) => {
    const entry = byConcept.get(q.concept) ?? { right: 0, total: 0, topicId: q.topicId };
    entry.total++;
    if (answers[i] === q.answerIndex) entry.right++;
    byConcept.set(q.concept, entry);
  });
  const missed = [...byConcept.entries()].filter(([, v]) => v.right < v.total);

  return (
    <div className="page">
      <div className="quiz">
        <Crumbs items={[<Link to="/practice">Practice</Link>, <span>{quiz.title}</span>]} />
        <h1 className="page-title">{quiz.title}</h1>
        <div className="result-summary">
          <span className="result-score">
            {score} of {total}
          </span>
          <span className="muted">{Math.round((score / total) * 100)}% correct</span>
        </div>
        <p className="page-lede">
          {missed.length
            ? "Your concept accuracy and topic priorities have been updated. Topics you got wrong will move up the list."
            : "Every answer was right. These concepts will drop down your priority list."}
        </p>

        {missed.length > 0 && (
          <section className="section" aria-labelledby="missed">
            <SectionHead id="missed" title="Concepts to go over" />
            <ul className="list-plain">
              {missed.map(([concept, v]) => {
                const t = topicById.get(v.topicId);
                return (
                  <li key={concept}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{concept}</div>
                      {t && (
                        <Link to={`/topics/${t.id}`} className="row-sub">
                          {t.title}
                        </Link>
                      )}
                    </div>
                    <span className="small num muted">
                      {v.right} of {v.total} right
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="section" aria-labelledby="review">
          <SectionHead id="review" title="Review answers" />
          <ol className="review-list">
            {quiz.questions.map((q, i) => {
              const chosen = answers[i];
              const right = chosen === q.answerIndex;
              return (
                <li key={q.id} className="review-item">
                  <p className="q-concept">
                    {i + 1}. {q.concept} · <strong style={{ color: right ? "var(--success)" : "var(--danger)" }}>{right ? "Correct" : chosen === null ? "Not answered" : "Incorrect"}</strong>
                  </p>
                  <p className="q-prompt">{q.prompt}</p>
                  <div className="q-options">
                    {q.options.map((opt, oi) => {
                      const isAnswer = oi === q.answerIndex;
                      const isChosen = oi === chosen;
                      const cls = isAnswer ? " is-correct" : isChosen ? " is-wrong" : "";
                      return (
                        <div key={oi} className={`q-option is-locked${cls}`}>
                          <span className="q-key" aria-hidden="true">
                            {KEYS[oi]}
                          </span>
                          <span>{opt}</span>
                          <span className="q-verdict">
                            {isAnswer ? "Correct answer" : isChosen ? "Your answer" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="q-explain">{q.explanation}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="quiz-nav">
          <Link to="/practice" className="btn">
            <ArrowLeft size={16} aria-hidden="true" /> Back to practice
          </Link>
          <Link to="/priorities" className="btn btn-primary">
            See updated priorities
          </Link>
        </div>
      </div>
    </div>
  );
}
