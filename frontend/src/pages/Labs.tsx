import { Fragment, useRef, useState } from "react";
import { ChevronRight, Paperclip } from "lucide-react";
import { useLabs, useUpdateExperiment } from "../api/hooks";
import type { Experiment, LabCourse, RecordChecklist, RecordStatus } from "../api/types";
import { daysUntil, fmt, relativeDays, todayISO } from "../lib/dates";
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

  return (
    <div className="page">
      <h1 className="page-title">Lab records</h1>
      <p className="page-lede">
        Every experiment, its record status and what's left to write. Records go from draft to written, then checked by
        your lab instructor.
      </p>

      <dl className="props">
        <dt>Not yet checked</dt>
        <dd>
          {pending.length} of {experiments.length} experiments
        </dd>
        <dt>Overdue</dt>
        <dd>
          {experiments.filter((e) => daysUntil(e.due) < 0 && (e.status === "not_started" || e.status === "draft")).length || (
            <span className="muted">None</span>
          )}
        </dd>
      </dl>

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
  const ready = all.filter((e) => e.status === "written" || e.status === "checked").length;

  return (
    <section className="section" aria-labelledby={`lab-${lab.id}`}>
      <SectionHead
        id={`lab-${lab.id}`}
        title={lab.name}
        note={
          <>
            <span className="mono">{lab.code}</span> · Practical exam {fmt.weekday(lab.practicalExamDate)} (
            {relativeDays(lab.practicalExamDate)})
          </>
        }
      >
        <span style={{ width: "6rem" }}>
          <Meter value={ready / all.length} label={`${ready} of ${all.length} records written`} tone="success" />
        </span>
        <span className="small muted num">
          {ready}/{all.length} written
        </span>
      </SectionHead>

      {rows.length ? (
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
      ) : (
        <Empty title="Every record here is checked">Nothing pending for this lab.</Empty>
      )}
    </section>
  );
}

function ExperimentRow({ exp, open, onToggle }: { exp: Experiment; open: boolean; onToggle: () => void }) {
  const update = useUpdateExperiment();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const days = daysUntil(exp.due);
  const pendingWork = exp.status === "not_started" || exp.status === "draft";
  const sectionsDone = Object.values(exp.checklist).filter(Boolean).length;

  const patch = (p: Partial<Experiment>) =>
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
          {pendingWork ? (
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
                  <p className="prose">{exp.aim}</p>
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
                            onChange={(e) => patch({ checklist: { ...exp.checklist, [c.key]: e.target.checked } })}
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
                      {exp.attachments.map((a) => (
                        <li key={a.name}>
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
                      if (!f) return;
                      patch({ attachments: [...exp.attachments, { name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }] });
                      e.target.value = "";
                    }}
                  />
                  <Button size="sm" style={{ marginTop: "var(--s-2)" }} onClick={() => fileInput.current?.click()}>
                    <Paperclip size={14} aria-hidden="true" /> Attach file
                  </Button>
                </div>
              </div>
              <div>
                <h4>Likely viva questions</h4>
                <ul className="plain">
                  {exp.vivaQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                {!exp.performedOn && (
                  <Button
                    size="sm"
                    style={{ marginTop: "var(--s-4)" }}
                    onClick={() => patch({ performedOn: todayISO(), status: exp.status === "not_started" ? "draft" : exp.status })}
                  >
                    Mark performed today
                  </Button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
