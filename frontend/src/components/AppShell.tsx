import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useConcepts, useProfile, useSubjects, usePlan } from "../api/hooks";
import { isWeak } from "../lib/constants";
import { todayISO } from "../lib/dates";
import { shortCode } from "../lib/subjects";

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Masthead open={open} onToggle={() => setOpen((o) => !o)} />
      <main className="main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

function Masthead({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const subjects = useSubjects();
  const concepts = useConcepts();
  const plan = usePlan();
  const profile = useProfile();
  const now = todayISO();
  const p = profile.data;

  const weakCount = concepts.data?.filter(isWeak).length;
  const todayLeft = plan.data?.sessions.filter((s) => s.date === now && !s.done).length;

  return (
    <header className={`masthead${open ? " is-open" : ""}`}>
      <div className="sheet mast-grid">
        <NavLink to="/" className="wordmark" end>
          Slack
        </NavLink>

        <button type="button" className="mast-menu" aria-expanded={open} aria-controls="mast-links" onClick={onToggle}>
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          Menu
        </button>

        <div className="mast-links" id="mast-links">
          <nav className="mast-nav" aria-label="Workspace">
            <NavLink to="/" end>
              Today
              {!!todayLeft && <sup aria-label={`${todayLeft} sessions left today`}>{todayLeft}</sup>}
            </NavLink>
            <NavLink to="/priorities">Priorities</NavLink>
            <NavLink to="/timetable">Timetable</NavLink>
            <NavLink to="/plan">Plan</NavLink>
            <NavLink to="/practice">Practice</NavLink>
            <NavLink to="/weak">
              Weak spots
              {!!weakCount && <sup aria-label={`${weakCount} weak concepts`}>{weakCount}</sup>}
            </NavLink>
            <NavLink to="/labs">Labs</NavLink>
            <span className="mast-spacer" aria-hidden="true" />
            <NavLink to="/sources">Sources</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>

          <nav className="mast-subjects" aria-label="Subjects">
            {p?.classLabel && <span className="mast-class">{p.classLabel}</span>}
            {subjects.data?.map((s) => (
              <NavLink key={s.id} to={`/subjects/${s.id}`} title={s.name} aria-label={s.name}>
                {shortCode(s)}
              </NavLink>
            ))}
            {subjects.data?.length === 0 && <NavLink to="/sources">Add your timetable or slides</NavLink>}
            {subjects.isError && <span className="mast-class">Can't reach the server</span>}
          </nav>
        </div>
      </div>
    </header>
  );
}
