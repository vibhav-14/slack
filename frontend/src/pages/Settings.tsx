import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePatchProfile, usePatchSubject, useProfile, useSubjects, useTimetable } from "../api/hooks";
import type { Subject } from "../api/types";
import { relativeDays } from "../lib/dates";
import { usePrefs, type Prefs } from "../lib/prefs";
import { shortCode } from "../lib/subjects";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { SectionHead, Segmented } from "../components/ui";
import { useToast } from "../components/Toast";

export function SettingsPage() {
  useDocumentTitle("Settings");
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <ClassSettings />
      <ExamDates />
      <ReadingSettings />
      <AiSettings />
    </div>
  );
}

function ClassSettings() {
  const profile = useProfile();
  const timetable = useTimetable();
  const patch = usePatchProfile();
  const toast = useToast();
  const p = profile.data;
  const classes = timetable.data?.availableClasses ?? [];

  return (
    <section className="section" aria-labelledby="class">
      <SectionHead id="class" title="Your class" note="Used to pick your timetable and lab group out of the department PDF." />
      <dl className="props" style={{ marginTop: 0, borderBottom: 0 }}>
        <dt>Class</dt>
        <dd>
          {classes.length ? (
            <select
              className="select select-sm"
              value={p?.classLabel ?? ""}
              onChange={(e) =>
                patch.mutate(
                  { classLabel: e.target.value },
                  { onSuccess: () => toast("Class saved. Retry the timetable in Sources to load it.") },
                )
              }
            >
              <option value="" disabled>
                Choose…
              </option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <span>{p?.classLabel ?? <span className="muted">Upload your timetable first</span>}</span>
          )}
        </dd>
        <dt>Lab group</dt>
        <dd>
          <Segmented<string>
            label="Lab group"
            value={String(p?.labGroup ?? 1)}
            onChange={(v) => patch.mutate({ labGroup: Number(v) }, { onSuccess: () => toast(`Lab group set to ${v}.`) })}
            options={[
              { value: "1", label: "Group 1" },
              { value: "2", label: "Group 2" },
            ]}
          />
        </dd>
        {p?.institution && (
          <>
            <dt>Institution</dt>
            <dd>{p.institution}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function ExamDates() {
  const subjects = useSubjects();
  return (
    <section className="section" aria-labelledby="exams">
      <SectionHead
        id="exams"
        title="Exam dates"
        note="Until you set them, Slack plans as if every exam is on its default date. Rebuild the plan after changing these."
      />
      {subjects.data?.length ? (
        <ul className="list-plain">
          {subjects.data.map((s) => (
            <ExamDateRow key={s.id} subject={s} />
          ))}
        </ul>
      ) : (
        <p className="muted">Subjects appear here once your timetable or slides are uploaded.</p>
      )}
    </section>
  );
}

function ExamDateRow({ subject: s }: { subject: Subject }) {
  const patch = usePatchSubject();
  const toast = useToast();
  return (
    <li>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{s.name}</div>
        <span className="row-sub">
          <span className="mono">{shortCode(s)}</span> · {s.examDateConfirmed ? relativeDays(s.examDate) : "estimated"}
        </span>
      </div>
      <input
        type="date"
        className="input select-sm"
        aria-label={`Exam date for ${s.name}`}
        value={s.examDate}
        onChange={(e) =>
          e.target.value &&
          patch.mutate({ id: s.id, examDate: e.target.value }, { onError: () => toast("Couldn't save the date.", { error: true }) })
        }
      />
    </li>
  );
}

function ReadingSettings() {
  const { prefs, set } = usePrefs();
  return (
    <section className="section" aria-labelledby="reading">
      <SectionHead id="reading" title="Reading" note="Changes apply straight away and are saved on this device." />
      <dl className="props" style={{ marginTop: 0, borderBottom: 0 }}>
        <dt>Text size</dt>
        <dd>
          <Segmented<Prefs["textSize"]>
            label="Text size"
            value={prefs.textSize}
            onChange={(v) => set("textSize", v)}
            options={[
              { value: "default", label: "Default" },
              { value: "large", label: "Large" },
              { value: "larger", label: "Larger" },
            ]}
          />
        </dd>
        <dt>Spacing</dt>
        <dd>
          <Segmented<Prefs["spacing"]>
            label="Line and letter spacing"
            value={prefs.spacing}
            onChange={(v) => set("spacing", v)}
            options={[
              { value: "normal", label: "Normal" },
              { value: "relaxed", label: "Relaxed" },
            ]}
          />
        </dd>
        <dt>Typeface</dt>
        <dd>
          <Segmented<Prefs["font"]>
            label="Typeface"
            value={prefs.font}
            onChange={(v) => set("font", v)}
            options={[
              { value: "hyperlegible", label: "Atkinson Hyperlegible" },
              { value: "system", label: "System font" },
            ]}
          />
        </dd>
        <dt>Theme</dt>
        <dd>
          <Segmented<Prefs["theme"]>
            label="Theme"
            value={prefs.theme}
            onChange={(v) => set("theme", v)}
            options={[
              { value: "system", label: "Match system" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </dd>
      </dl>
      <p className="prose" style={{ marginTop: "var(--s-4)", padding: "var(--s-4)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
        Atkinson Hyperlegible was designed for low-vision readers: letters that are easy to confuse, like I, l and 1, or b
        and d, have distinct shapes. Relaxed spacing adds room between lines, letters and words, which many readers with
        dyslexia find easier.
      </p>
    </section>
  );
}

function AiSettings() {
  const profile = useProfile();
  const on = profile.data?.aiAvailable;
  return (
    <section className="section" aria-labelledby="ai">
      <SectionHead id="ai" title="Question writing" />
      <p className="prose">
        Quiz questions always come from your own slides — their rule tables, comparisons and misconceptions.{" "}
        {on ? (
          <>
            Claude is also connected: it writes extra questions grounded in each deck's text, and you can ask for more
            from any topic page.
          </>
        ) : (
          <>
            To have Claude write extra questions grounded in your slides, set <code>ANTHROPIC_API_KEY</code> where the
            backend runs and restart it.
          </>
        )}
      </p>
    </section>
  );
}
