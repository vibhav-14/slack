import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { useDeleteSource, useRetrySource, useSources, useSubjects, useUploadSource } from "../api/hooks";
import type { Source, SourceKind, Subject } from "../api/types";
import { timeAgo } from "../lib/dates";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Empty, ErrorBlock, PageSkeleton, SectionHead, SourceStatusTag } from "../components/ui";
import { useToast } from "../components/Toast";

const KIND_LABEL: Record<SourceKind, string> = {
  syllabus: "Syllabus",
  past_paper: "Past papers",
  notes: "Notes",
  exam_pattern: "Exam pattern",
};

interface Staged {
  key: string;
  filename: string;
  sizeKb: number;
  kind: SourceKind;
  subjectId: string | null;
}

function guessKind(name: string): SourceKind {
  const n = name.toLowerCase();
  if (/syllab/.test(n)) return "syllabus";
  if (/paper|pyq|question|end.?sem|mid.?sem/.test(n)) return "past_paper";
  if (/scheme|pattern|notice/.test(n)) return "exam_pattern";
  return "notes";
}

function guessSubject(name: string, subjects: Subject[]): string | null {
  const n = name.toLowerCase();
  const hit = subjects.find((s) => n.includes(s.code.toLowerCase()) || n.includes(s.id) || n.includes(s.name.toLowerCase()));
  return hit?.id ?? null;
}

export function SourcesPage() {
  useDocumentTitle("Sources");
  const sources = useSources();
  const subjects = useSubjects();

  if (sources.isLoading) return <PageSkeleton lines={8} />;
  if (sources.error || !sources.data) return <ErrorBlock error={sources.error} onRetry={() => sources.refetch()} />;

  const subjectById = new Map(subjects.data?.map((s) => [s.id, s]));

  return (
    <div className="page">
      <h1 className="page-title">Sources</h1>
      <p className="page-lede">
        The material your priorities are built from. Syllabi give units and lecture hours, past papers give exam
        frequency and marks, notes add context. Scanned PDFs and photos are fine.
      </p>

      <UploadArea subjects={subjects.data ?? []} />

      <section className="section" aria-labelledby="files">
        <SectionHead id="files" title="Files" note={`${sources.data.length} uploaded`} />
        {sources.data.length ? (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Found</th>
                  <th className="col-fit">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.data.map((s) => (
                  <SourceRow key={s.id} source={s} subject={s.subjectId ? subjectById.get(s.subjectId) : undefined} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No sources yet">
            Start with the syllabus for each subject, then add past papers. Priorities appear once both are read.
          </Empty>
        )}
      </section>
    </div>
  );
}

function SourceRow({ source: s, subject }: { source: Source; subject: Subject | undefined }) {
  const retry = useRetrySource();
  const remove = useDeleteSource();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <tr>
      <td>
        <span className="file-name">
          <FileText size={16} aria-hidden="true" />
          <span title={s.filename}>{s.filename}</span>
        </span>
        <span className="row-sub">
          {s.sizeKb >= 1024 ? `${(s.sizeKb / 1024).toFixed(1)} MB` : `${s.sizeKb} KB`} · {s.pages} page{s.pages === 1 ? "" : "s"} ·
          added {timeAgo(s.uploadedAt)}
        </span>
        {s.status === "failed" && s.error && (
          <span className="row-sub" style={{ color: "var(--danger)" }}>
            {s.error}
          </span>
        )}
      </td>
      <td data-label="Type">{KIND_LABEL[s.kind]}</td>
      <td data-label="Subject">{subject ? <span className="mono">{subject.code}</span> : <span className="muted">All</span>}</td>
      <td data-label="Status">
        <SourceStatusTag status={s.status} />
      </td>
      <td data-label="Found" className="small">
        {s.extracted ? describeExtraction(s) : <span className="muted">—</span>}
      </td>
      <td className="col-fit">
        <div className="row" style={{ flexWrap: "nowrap", gap: "var(--s-1)" }}>
          {s.status === "failed" && s.retryable !== false && (
            <Button size="sm" onClick={() => retry.mutate(s.id)} busy={retry.isPending}>
              Retry
            </Button>
          )}
          {confirming ? (
            <Button
              size="sm"
              variant="danger"
              busy={remove.isPending}
              onClick={() =>
                remove.mutate(s.id, {
                  onSuccess: () => toast(`Removed ${s.filename}. Its evidence no longer counts.`),
                  onError: () => toast("Couldn't remove the file.", { error: true }),
                })
              }
            >
              Confirm remove
            </Button>
          ) : (
            <Button size="sm" variant="ghost" icon aria-label={`Remove ${s.filename}`} onClick={() => setConfirming(true)}>
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function describeExtraction(s: Source): string {
  const e = s.extracted!;
  const parts: string[] = [];
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  if (e.units) parts.push(n(e.units, "unit"));
  if (e.topics) parts.push(n(e.topics, "topic"));
  if (e.questions) parts.push(n(e.questions, "question"));
  if (!parts.length) return s.kind === "exam_pattern" ? "Marking scheme" : "Nothing new";
  return parts.join(", ");
}

function UploadArea({ subjects }: { subjects: Subject[] }) {
  const upload = useUploadSource();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [staged, setStaged] = useState<Staged[]>([]);

  const stage = (files: FileList | null) => {
    if (!files?.length) return;
    setStaged((prev) => [
      ...prev,
      ...Array.from(files).map((f, i) => ({
        key: `${Date.now()}-${i}-${f.name}`,
        filename: f.name,
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        kind: guessKind(f.name),
        subjectId: guessSubject(f.name, subjects),
      })),
    ]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    stage(e.dataTransfer.files);
  };

  const submit = async () => {
    try {
      for (const s of staged) await upload.mutateAsync({ filename: s.filename, sizeKb: s.sizeKb, kind: s.kind, subjectId: s.subjectId });
      toast(`${staged.length} file${staged.length === 1 ? "" : "s"} added. Reading usually takes under a minute.`);
      setStaged([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed.", { error: true });
    }
  };

  const edit = (key: string, patch: Partial<Staged>) => setStaged((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <section className="section" aria-labelledby="add">
      <SectionHead id="add" title="Add material" />
      <div
        className={`drop${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Upload size={22} aria-hidden="true" />
        <p>
          Drop files here, or{" "}
          <button
            type="button"
            onClick={() => input.current?.click()}
            style={{ background: "none", border: 0, padding: 0, color: "var(--primary)", textDecoration: "underline", textUnderlineOffset: "0.2em" }}
          >
            browse
          </button>
        </p>
        <p className="small muted">PDF, JPG, PNG, DOCX or TXT · up to 50 MB each</p>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.docx,.txt,.heic"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            stage(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {staged.length > 0 && (
        <div style={{ marginTop: "var(--s-4)" }}>
          <p className="small muted" style={{ marginBottom: "var(--s-2)" }}>
            Check the type and subject before adding. We guessed from the file names.
          </p>
          <ul className="list-plain">
            {staged.map((s) => (
              <li key={s.key} style={{ flexWrap: "wrap" }}>
                <span className="file-name" style={{ flex: "1 1 14rem" }}>
                  <FileText size={16} aria-hidden="true" />
                  <span title={s.filename}>{s.filename}</span>
                </span>
                <div className="row">
                  <select
                    className="select select-sm"
                    aria-label={`Type of ${s.filename}`}
                    value={s.kind}
                    onChange={(e) => edit(s.key, { kind: e.target.value as SourceKind })}
                  >
                    {(Object.keys(KIND_LABEL) as SourceKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select select-sm"
                    aria-label={`Subject of ${s.filename}`}
                    value={s.subjectId ?? ""}
                    onChange={(e) => edit(s.key, { subjectId: e.target.value || null })}
                  >
                    <option value="">All subjects</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} · {sub.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon
                    aria-label={`Don't add ${s.filename}`}
                    onClick={() => setStaged((all) => all.filter((x) => x.key !== s.key))}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: "var(--s-3)" }}>
            <Button variant="primary" onClick={submit} busy={upload.isPending}>
              Add {staged.length} file{staged.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" onClick={() => setStaged([])}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
