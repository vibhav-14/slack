import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Paperclip, Plus, Trash2 } from "lucide-react";
import { useAddExperiment, useAttachFile, useDeleteExperiment, useLabs, usePatchLab, useTimetable, useUpdateExperiment } from "../api/hooks";
import type { Experiment, LabCourse, RecordChecklist, RecordStatus } from "../api/types";
import { daysUntil, fmt, relativeDays, todayISO } from "../lib/dates";
import { TT_DAYS } from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, Empty, ErrorBlock, Meter, PageSkeleton, SectionHead, Segmented, recordStatusLabel } from "../components/ui";
import { useToast } from "../components/Toast";

type Show = "pending" | "all";

const CHECKLIST: { key: keyof RecordChecklist; label: string }[] = [
  { key: "aim", label: "Aim" },
  { key: "procedure", label: "Procedure" },
  { key: "code", label: "Code" },
  { key: "output", label: "Output" },
  { key: "conclusion", label: "Conclusion" },
];

export function LabsPage() {
  useDocumentTitle("Lab records");
  const labs = useLabs();
  const [show, setShow] = useState<Show>("pending");

  if (labs.isLoading) return <PageSkeleton lines={12} />;
  if (labs.error || !labs.data) return <ErrorBlock error={labs.error} onRetry={() => labs.refetch()} />;

  const { experiments } = labs.data;
  const pending = experiments.filter((e) => e.status !== "checked");
  const overdue = experiments.filter((e) => e.due && daysUntil(e.due) < 0 && (e.status === "not_started" || e.status === "draft"));

  if (!labs.data.labs.length) {
    return (
      <div className="page">
        <h1 className="page-title">Lab records</h1>
        <Empty title="No labs yet" action={<Link to="/sources" className="btn btn-primary">Upload timetable</Link>}>
          Your labs come from your timetable. Upload it and each lab course appears here, ready for experiments.
        </Empty>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Lab records</h1>

      <dl className="props">
        <dt>Not yet checked</dt>
        <dd>
          {experiments.length ? (
            `${pending.length} of ${experiments.length} experiment${experiments.length === 1 ? "" : "s"}`
          ) : (
            <span className="muted">No experiments added yet</span>
          )}
        </dd>
        <dt>Overdue</dt>
        <dd>{overdue.length || <span className="muted">None</span>}</dd>
      </dl>

      {experiments.length > 0 && (
        <div className="toolbar" style={{ marginTop: "var(--s-5)" }}>
          <Segmented<Show>
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: "pending", label: "Not checked yet" },
              { value: "all", label: "All experiments" },
            ]}
          />
        </div>
      )}

      {labs.data.labs.map((lab) => (
        <LabSection
          key={lab.id}
          lab={lab}
          all={experiments.filter((e) => e.labId === lab.id)}
          rows={experiments.filter((e) => e.labId === lab.id && (show === "all" || e.status !== "checked"))}
        />
      ))}
    </div>
  );
}

function LabSection({ lab, all, rows }: { lab: LabCourse; all: Experiment[]; rows: Experiment[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const timetable = useTimetable();
  const patchLab = usePatchLab();
  const toast = useToast();
  const ready = all.filter((e) => e.status === "written" || e.status === "checked").length;
  const sessions = (timetable.data?.slots ?? []).filter(
    (s) => s.labId === lab.id && (s.group === null || s.group === timetable.data?.labGroup),
  );

  return (
    <section className="section" aria-labelledby={`lab-${lab.id}`}>
      <SectionHead
        id={`lab-${lab.id}`}
        title={lab.name}
        note={
          <>
            {[lab.faculty, sessions.map((s) => `${TT_DAYS[s.day].slice(0, 3)} ${s.start}${s.room ? `, ${s.room}` : ""}`).join(" · ")]
              .filter(Boolean)
              .join(" · ")}
          </>
        }
      >
        {all.length > 0 && (
          <>
            <span style={{ width: "6rem" }}>
              <Meter value={ready / all.length} label={`${ready} of ${all.length} records written`} tone="success" />
            </span>
            <span className="small muted num">
              {ready}/{all.length} written
            </span>
          </>
        )}
      </SectionHead>

      <div className="row small" style={{ marginBottom: "var(--s-3)" }}>
        <label className="row" htmlFor={`practical-${lab.id}`}>
          <span className="muted">Practical exam</span>
        </label>
        <input
          id={`practical-${lab.id}`}
          type="date"
          className="input select-sm"
          value={lab.practicalExamDate ?? ""}
          onChange={(e) =>
            patchLab.mutate(
              { id: lab.id, practicalExamDate: e.target.value || null },
              { onError: () => toast("Couldn't save the date.", { error: true }) },
            )
          }
        />
        {lab.practicalExamDate && <span className="muted">{relativeDays(lab.practicalExamDate)}</span>}
      </div>

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table table-stack">
            <thead>
              <tr>
                <th className="col-fit hide-sm">
                  <span className="sr-only">Details</span>
                </th>
                <th>Experiment</th>
                <th>Due</th>
                <th className="col-num">Sections</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <ExperimentRow key={e.id} exp={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {all.length > 0 && rows.length === 0 && <p className="muted">Every record here is checked.</p>}
      {all.length === 0 && !adding && (
        <p className="muted" style={{ marginBottom: "var(--s-3)" }}>
          No experiments yet. Add them as your instructor assigns them.
        </p>
      )}

      {adding ? (
        <AddExperimentForm labId={lab.id} onDone={() => setAdding(false)} />
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)} style={{ marginTop: "var(--s-2)" }}>
          <Plus size={16} aria-hidden="true" /> Add experiment
        </Button>
      )}
    </section>
  );
}

function AddExperimentForm({ labId, onDone }: { labId: string; onDone: () => void }) {
  const add = useAddExperiment();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [aim, setAim] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <form
      className="panel stack"
      style={{ gap: "var(--s-3)", marginTop: "var(--s-3)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim().length < 2) return;
        add.mutate(
          { labId, title, aim, due: due || null },
          {
            onSuccess: () => {
              toast(`Added “${title.trim()}”.`);
              onDone();
            },
            onError: (err) => toast(err.message, { error: true }),
          },
        );
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Title</span>
          <input ref={titleRef} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Implement a stack using arrays" required minLength={2} />
        </label>
        <label className="field">
          <span className="field-label">Due date</span>
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">
          Aim <span className="muted small">optional</span>
        </span>
        <input className="input" value={aim} onChange={(e) => setAim(e.target.value)} />
      </label>
      <div className="row">
        <Button type="submit" variant="primary" busy={add.isPending} disabled={title.trim().length < 2}>
          Add experiment
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ExperimentRow({ exp, open, onToggle }: { exp: Experiment; open: boolean; onToggle: () => void }) {
  const update = useUpdateExperiment();
  const attach = useAttachFile();
  const remove = useDeleteExperiment();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const days = exp.due ? daysUntil(exp.due) : null;
  const pendingWork = exp.status === "not_started" || exp.status === "draft";
  const sectionsDone = Object.values(exp.checklist).filter(Boolean).length;

  const patch = (p: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id: exp.id, patch: p }, { onError: () => toast("Couldn't save. Try again.", { error: true }) });

  return (
    <Fragment>
      <tr className={open ? "expanded" : undefined}>
        <td className="col-fit hide-sm">
          <button
            type="button"
            className="disclose"
            aria-expanded={open}
            aria-controls={`exp-${exp.id}`}
            aria-label={`Details for experiment ${exp.number}`}
            onClick={onToggle}
          >
            <ChevronRight size={16} />
          </button>
        </td>
        <td>
          <button type="button" className="row-title" onClick={onToggle} style={{ background: "none", border: 0, padding: 0, textAlign: "left" }}>
            {exp.number}. {exp.title}
          </button>
          <span className="row-sub">{exp.performedOn ? `Performed ${fmt.short(exp.performedOn)}` : "Not performed yet"}</span>
        </td>
        <td data-label="Due">
          {!exp.due ? (
            <span className="muted">No date</span>
          ) : pendingWork && days !== null ? (
            <span className={days <= 2 ? "due-soon" : undefined}>
              {days < 0 ? `Overdue · ${fmt.short(exp.due)}` : `${fmt.short(exp.due)} · ${relativeDays(exp.due)}`}
            </span>
          ) : (
            <span className="muted">{fmt.short(exp.due)}</span>
          )}
        </td>
        <td className="col-num" data-label="Sections">
          {sectionsDone}/5
        </td>
        <td data-label="Record">
          <select
            className="select select-sm"
            value={exp.status}
            aria-label={`Record status for experiment ${exp.number}`}
            onChange={(e) => patch({ status: e.target.value as RecordStatus })}
          >
            {(Object.keys(recordStatusLabel) as RecordStatus[]).map((s) => (
              <option key={s} value={s}>
                {recordStatusLabel[s]}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {open && (
        <tr className="detail-row" id={`exp-${exp.id}`}>
          <td colSpan={5} style={{ padding: 0 }}>
            <div className="exp-detail">
              <div className="stack" style={{ gap: "var(--s-5)" }}>
                <div>
                  <h4>Aim</h4>
                  <p className="prose">{exp.aim || <span className="muted">Not written yet.</span>}</p>
                </div>
                <div>
                  <h4>Record sections written</h4>
                  <ul className="checklist">
                    {CHECKLIST.map((c) => (
                      <li key={c.key}>
                        <label>
                          <input
                            type="checkbox"
                            className="check"
                            checked={exp.checklist[c.key]}
                            onChange={(e) => patch({ checklist: { [c.key]: e.target.checked } })}
                          />
                          {c.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Output and attachments</h4>
                  {exp.attachments.length ? (
                    <ul className="plain">
                      {exp.attachments.map((a, i) => (
                        <li key={`${a.name}-${i}`}>
                          <span className="mono">{a.name}</span> <span className="muted small">· {a.sizeKb} KB</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No output attached yet.</p>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) attach.mutate({ id: exp.id, file: f }, { onError: (err) => toast(err.message, { error: true }) });
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" style={{ marginTop: "var(--s-2)" }} onClick={() => fileInput.current?.click()} busy={attach.isPending}>
                    <Paperclip size={14} aria-hidden="true" /> Attach file
                  </Button>
                </div>
              </div>
              <div className="stack" style={{ gap: "var(--s-4)" }}>
                {exp.vivaQuestions.length > 0 && (
                  <div>
                    <h4>Likely viva questions</h4>
                    <ul className="plain">
                      {exp.vivaQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <label className="field">
                  <span className="field-label small">Due date</span>
                  <input type="date" className="input select-sm" value={exp.due ?? ""} onChange={(e) => patch({ due: e.target.value || null })} />
                </label>
                <div className="row">
                  {!exp.performedOn && (
                    <Button
                      size="sm"
                      onClick={() => patch({ performedOn: todayISO(), status: exp.status === "not_started" ? "draft" : exp.status })}
                    >
                      Mark performed today
                    </Button>
                  )}
                  {confirming ? (
                    <>
                      <Button size="sm" variant="danger" busy={remove.isPending} onClick={() => remove.mutate(exp.id)}>
                        Delete experiment
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" icon aria-label={`Delete experiment ${exp.number}`} onClick={() => setConfirming(true)}>
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
