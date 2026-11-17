import { Link, useNavigate, useParams } from "react-router-dom";
import { useCreateQuiz, useGenerateQuestions, useProfile, useSubjects, useTopic, useUnitsLookup } from "../api/hooks";
import type { Evidence, EvidenceKind } from "../api/types";
import { timeAgo } from "../lib/dates";
import { isWeak } from "../lib/constants";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Crumbs, Dots, ErrorBlock, Highlight, PageSkeleton, PriorityTag, SectionHead, termsFor } from "../components/ui";
import { FactorList } from "../components/FactorList";
import { TopicStatusSelect } from "../components/TopicStatusSelect";
import { useToast } from "../components/Toast";

const GROUPS: { kind: EvidenceKind; title: string }[] = [
  { kind: "assessment", title: "What you'll be assessed on" },
  { kind: "past_paper", title: "Past paper questions" },
  { kind: "syllabus", title: "Syllabus and course outcomes" },
  { kind: "slides", title: "From the lecture slides" },
  { kind: "notes", title: "From your notes" },
];

export function TopicPage() {
  const { id = "" } = useParams();
  const q = useTopic(id);
  const subjects = useSubjects();
  const profile = useProfile();
  const unitTitle = useUnitsLookup();
  const createQuiz = useCreateQuiz();
  const generate = useGenerateQuestions();
  const navigate = useNavigate();
  const toast = useToast();
  useDocumentTitle(q.data?.title);

  if (q.isLoading) return <PageSkeleton lines={10} />;
  if (q.error || !q.data) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;

  const t = q.data;
  const subject = subjects.data?.find((s) => s.id === t.subjectId);
  const terms = termsFor(t.title, t.concepts);
  const papers = t.evidence.filter((e) => e.kind === "past_paper");
  const totalMarks = papers.reduce((n, e) => n + (e.marks ?? 0), 0);
  const statByConcept = new Map(t.conceptStats.map((c) => [c.concept, c]));
  const nQuestions = t.questionCounts.slides + t.questionCounts.claude;

  const practise = () =>
    createQuiz.mutate(
      { mode: "topics", topicIds: [t.id], count: 8 },
      { onSuccess: (quiz) => navigate(`/practice/${quiz.id}`), onError: (e) => toast(e.message, { error: true }) },
    );

  const writeMore = () =>
    generate.mutate(t.id, {
      onSuccess: ({ added }) => toast(added ? `Added ${added} questions written from your slides.` : "No new questions this time."),
      onError: (e) => toast(e.message, { error: true }),
    });

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
        {nQuestions > 0 && (
          <div className="page-actions">
            <Button onClick={practise} busy={createQuiz.isPending}>
              Practise this topic
            </Button>
          </div>
        )}
      </div>

      <dl className="props">
        <dt>
          Priority
        </dt>
        <dd>
          <PriorityTag tier={t.priority.tier} />
          <span className="num">{t.priority.score} / 100</span>
        </dd>
        <dt>
          Status
        </dt>
        <dd>
          <TopicStatusSelect topic={t} size="sm" />
        </dd>
        {(t.courseOutcome || t.bloom) && (
          <>
            <dt>
              Outcome
            </dt>
            <dd>
              {[t.courseOutcome, t.bloom && `Bloom ${t.bloom}`].filter(Boolean).join(" · ")}
              {t.sessionNumber && <span className="muted">· Session {t.sessionNumber}</span>}
            </dd>
          </>
        )}
        <dt>
          Quiz accuracy
        </dt>
        <dd>
          {t.mastery === null ? (
            <span className="muted">Not enough answers yet</span>
          ) : (
            <span className="num">{Math.round(t.mastery * 100)}%</span>
          )}
        </dd>
        <dt>
          Quiz questions
        </dt>
        <dd>
          <span className="num">{nQuestions}</span>
          <span className="muted">
            {t.questionCounts.claude
              ? `· ${t.questionCounts.slides} from slide tables, ${t.questionCounts.claude} written by Claude`
              : "· from the slides' tables and misconceptions"}
          </span>
          {profile.data?.aiAvailable && (
            <Button size="sm" variant="ghost" onClick={writeMore} busy={generate.isPending}>
              Write more with Claude
            </Button>
          )}
        </dd>
        <dt>
          In past papers
        </dt>
        <dd>
          {t.papers.total ? (
            <>
              <span className="num">
                {t.papers.asked} of {t.papers.total} papers
              </span>
              {papers.length > 0 && <span className="muted">· {totalMarks} marks asked in total</span>}
            </>
          ) : (
            <span className="muted">
              No past papers uploaded. <Link to="/sources">Add them</Link> to rank by exam frequency.
            </span>
          )}
        </dd>
      </dl>

      <section className="section" aria-labelledby="why">
        <SectionHead id="why" title="How it was marked" />
        <FactorList priority={t.priority} />
      </section>

      <section className="section" aria-labelledby="evidence">
        <SectionHead id="evidence" title="Evidence" />
        {GROUPS.map(({ kind, title }) => {
          const items = t.evidence.filter((e) => e.kind === kind);
          if (!items.length) return null;
          return (
            <div key={kind} className="evidence-group">
              <h3 className="evidence-group-title">{title}</h3>
              <ul className="evidence">
                {items.map((e) => (
                  <EvidenceRow key={e.id} e={e} terms={terms} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="section" aria-labelledby="concepts">
        <SectionHead id="concepts" title="Concepts" note="Under 60% counts as weak." />
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

function EvidenceRow({ e, terms }: { e: Evidence; terms: string[] }) {
  return (
    <li className="evidence-item">
      <span className="hang margin-mark">
        {e.marks !== null ? `${e.marks} marks` : e.level ? <span title={`Bloom level ${e.level}`}>{e.level}</span> : null}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="evidence-label">{e.label}</div>
        <p className="evidence-quote">{e.kind === "past_paper" ? <Highlight text={e.excerpt} terms={terms} /> : e.excerpt}</p>
      </div>
    </li>
  );
}
