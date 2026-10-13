import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, FileText, Gauge, ListChecks, NotebookPen, Signal, Target } from "lucide-react";
import { useCreateQuiz, useSubjects, useTopic, useUnitsLookup } from "../api/hooks";
import type { EvidenceKind } from "../api/types";
import { timeAgo } from "../lib/dates";
import { isWeak } from "../lib/constants";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Crumbs, Dots, ErrorBlock, Highlight, PageSkeleton, PriorityTag, SectionHead, termsFor } from "../components/ui";
import { FactorList } from "../components/FactorList";
import { TopicStatusSelect } from "../components/TopicStatusSelect";
import { useToast } from "../components/Toast";

const kindIcon: Record<EvidenceKind, typeof FileText> = {
  past_paper: FileText,
  syllabus: BookOpen,
  notes: NotebookPen,
  quiz: Target,
};

const kindOrder: EvidenceKind[] = ["past_paper", "syllabus", "notes", "quiz"];

export function TopicPage() {
  const { id = "" } = useParams();
  const q = useTopic(id);
  const subjects = useSubjects();
  const unitTitle = useUnitsLookup();
  const createQuiz = useCreateQuiz();
  const navigate = useNavigate();
  const toast = useToast();
  useDocumentTitle(q.data?.title);

  if (q.isLoading) return <PageSkeleton lines={10} />;
  if (q.error || !q.data) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;

  const t = q.data;
  const subject = subjects.data?.find((s) => s.id === t.subjectId);
  const terms = termsFor(t.title, t.concepts);
  const evidence = [...t.evidence].sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));
  const papers = t.evidence.filter((e) => e.kind === "past_paper");
  const totalMarks = papers.reduce((n, e) => n + (e.marks ?? 0), 0);
  const statByConcept = new Map(t.conceptStats.map((c) => [c.concept, c]));

  const practise = () =>
    createQuiz.mutate(
      { mode: "topics", topicIds: [t.id], count: 6 },
      { onSuccess: (quiz) => navigate(`/practice/${quiz.id}`), onError: (e) => toast(e.message, { error: true }) },
    );

  return (
    <div className="page">
      <Crumbs
        items={[
          subject ? <Link to={`/subjects/${subject.id}`}>{subject.name}</Link> : "Subject",
          <span>{unitTitle(t.unitId)}</span>,
        ]}
      />
      <div className="page-head">
        <h1 className="page-title">{t.title}</h1>
        <div className="page-actions">
          <Button onClick={practise} busy={createQuiz.isPending}>
            Practise this topic
          </Button>
        </div>
      </div>

      <dl className="props">
        <dt>
          <Signal size={16} aria-hidden="true" /> Priority
        </dt>
        <dd>
          <PriorityTag tier={t.priority.tier} />
          <span className="num">{t.priority.score} / 100</span>
        </dd>
        <dt>
          <ListChecks size={16} aria-hidden="true" /> Status
        </dt>
        <dd>
          <TopicStatusSelect topic={t} size="sm" />
        </dd>
        <dt>
          <Gauge size={16} aria-hidden="true" /> Quiz accuracy
        </dt>
        <dd>
          {t.mastery === null ? (
            <span className="muted">Not enough answers yet</span>
          ) : (
            <span className="num">{Math.round(t.mastery * 100)}%</span>
          )}
        </dd>
        <dt>
          <FileText size={16} aria-hidden="true" /> In past papers
        </dt>
        <dd>
          <span className="num">
            {t.papers.asked} of {t.papers.total} papers
          </span>
          {papers.length > 0 && <span className="muted">· {totalMarks} marks asked in total</span>}
        </dd>
      </dl>

      <section className="section" aria-labelledby="why">
        <SectionHead id="why" title="Why it's ranked here" note="Points each factor contributes to the score." />
        <FactorList priority={t.priority} />
      </section>

      <section className="section" aria-labelledby="evidence">
        <SectionHead
          id="evidence"
          title="Evidence"
          note={
            <>
              {evidence.length} item{evidence.length === 1 ? "" : "s"} from your sources. Highlighted words are what linked
              each question to this topic.
            </>
          }
        />
        <ul className="evidence">
          {evidence.map((e) => {
            const Icon = kindIcon[e.kind];
            return (
              <li key={e.id} className="evidence-item">
                <span className="evidence-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="evidence-label">{e.label}</div>
                  <p className="evidence-quote">
                    {e.kind === "past_paper" ? <Highlight text={e.excerpt} terms={terms} /> : e.excerpt}
                  </p>
                </div>
                {e.marks !== undefined && (
                  <span className="marks">
                    {e.marks} <span className="muted small">marks</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="section" aria-labelledby="concepts">
        <SectionHead id="concepts" title="Concepts" note="Tracked from your quiz answers. Under 60% counts as weak." />
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th>Concept</th>
                <th>Last answers</th>
                <th className="col-num">Accuracy</th>
                <th>Last practised</th>
              </tr>
            </thead>
            <tbody>
              {t.concepts.map((name) => {
                const c = statByConcept.get(name);
                return (
                  <tr key={name}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{name}</span>
                      {c && isWeak(c) && (
                        <span className="tag tag-high" style={{ marginLeft: "var(--s-2)" }}>
                          Weak
                        </span>
                      )}
                    </td>
                    <td data-label="Last answers">{c ? <Dots results={c.recent} /> : <span className="muted">—</span>}</td>
                    <td className="col-num" data-label="Accuracy">
                      {c ? `${Math.round((c.correct / c.attempts) * 100)}% of ${c.attempts}` : <span className="muted">—</span>}
                    </td>
                    <td data-label="Last practised">
                      {c?.lastSeen ? timeAgo(c.lastSeen) : <span className="muted">Not practised yet</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
