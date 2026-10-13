import { useEffect, useState } from "react";
import { useResetDemo } from "../api/hooks";
import { usingMock } from "../api/client";
import { usePrefs, type Prefs } from "../lib/prefs";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import { Button, SectionHead, Segmented } from "../components/ui";
import { useToast } from "../components/Toast";

export function SettingsPage() {
  useDocumentTitle("Settings");
  const { prefs, set } = usePrefs();

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

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
          Atkinson Hyperlegible was designed for low-vision readers: letters that are easy to confuse, like I, l and 1, or
          b and d, have distinct shapes. Relaxed spacing adds room between lines, letters and words, which many readers
          with dyslexia find easier.
        </p>
      </section>

      <section className="section" aria-labelledby="data">
        <SectionHead id="data" title="Data" />
        {usingMock ? <DemoData /> : <p>Connected to {import.meta.env.VITE_API_URL}.</p>}
      </section>
    </div>
  );
}

function DemoData() {
  const reset = useResetDemo();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  return (
    <div className="stack" style={{ gap: "var(--s-3)" }}>
      <p className="prose">
        No backend is connected, so you're using a demo semester stored in this browser. Set <code>VITE_API_URL</code> to
        your FastAPI server to use real data.
      </p>
      <div className="row">
        {confirming ? (
          <>
            <Button
              variant="danger"
              busy={reset.isPending}
              onClick={() =>
                reset.mutate(undefined, {
                  onSuccess: () => {
                    setConfirming(false);
                    toast("Demo data reset.");
                  },
                })
              }
            >
              Yes, reset everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep my progress
            </Button>
          </>
        ) : (
          <Button onClick={() => setConfirming(true)}>Reset demo data</Button>
        )}
      </div>
      {confirming && <p className="small muted">This clears topic statuses, quiz history, plan progress and lab records.</p>}
    </div>
  );
}
