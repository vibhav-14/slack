import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Prefs {
  theme: "system" | "light" | "dark";
  textSize: "default" | "large" | "larger";
  spacing: "normal" | "relaxed";
  font: "hyperlegible" | "system";
}

const DEFAULTS: Prefs = { theme: "system", textSize: "default", spacing: "normal", font: "hyperlegible" };
const KEY = "slack.prefs.v1";

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Mirrors prefs onto <html> data attributes; CSS does the rest. */
function apply(p: Prefs) {
  const el = document.documentElement;
  if (p.theme === "system") delete el.dataset.theme;
  else el.dataset.theme = p.theme;
  el.dataset.text = p.textSize;
  el.dataset.spacing = p.spacing;
  el.dataset.font = p.font;
}

const Ctx = createContext<{ prefs: Prefs; set: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void } | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);

  useEffect(() => {
    apply(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Private mode: preferences last for this session only.
    }
  }, [prefs]);

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  return <Ctx.Provider value={{ prefs, set }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

// Apply before first paint to avoid a theme flash.
apply(load());
