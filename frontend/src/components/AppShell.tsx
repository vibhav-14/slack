import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarDays,
  CircleHelp,
  FileStack,
  FlaskConical,
  ListOrdered,
  Menu,
  Settings,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import { useConcepts, useSubjects, usePlan } from "../api/hooks";
import { usingMock } from "../api/client";
import { isWeak } from "../lib/constants";
import { todayISO } from "../lib/dates";

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
    <div className={`shell${open ? " drawer-open" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="topbar">
        <button type="button" className="btn btn-ghost btn-icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <span className="topbar-title">Margin</span>
      </header>

      <Sidebar onClose={() => setOpen(false)} />
      <button type="button" className="drawer-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setOpen(false)} />

      <main className="main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const subjects = useSubjects();
  const concepts = useConcepts();
  const plan = usePlan();
  const now = todayISO();

  const weakCount = concepts.data?.filter(isWeak).length;
  const todayLeft = plan.data?.sessions.filter((s) => s.date === now && !s.done).length;

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <NavLink to="/" className="sb-brand" end>
          <span className="sb-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M7.5 5h5M7.5 8h5M7.5 11h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
            </svg>
          </span>
          <span className="sb-brand-name">
            Margin
            <span className="sb-brand-sub">Semester 5 · B.Tech CSE</span>
          </span>
        </NavLink>
        <button type="button" className="btn btn-ghost btn-icon btn-sm close-drawer" aria-label="Close navigation" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <nav className="sb-nav" aria-label="Workspace">
        <NavLink to="/" end className="sb-link">
          <Sun size={18} aria-hidden="true" />
          <span className="label">Today</span>
          {!!todayLeft && <span className="count" aria-label={`${todayLeft} sessions left today`}>{todayLeft}</span>}
        </NavLink>
        <NavLink to="/priorities" className="sb-link">
          <ListOrdered size={18} aria-hidden="true" />
          <span className="label">Priorities</span>
        </NavLink>
        <NavLink to="/plan" className="sb-link">
          <CalendarDays size={18} aria-hidden="true" />
          <span className="label">Revision plan</span>
        </NavLink>
        <NavLink to="/practice" className="sb-link">
          <CircleHelp size={18} aria-hidden="true" />
          <span className="label">Practice</span>
        </NavLink>
        <NavLink to="/weak" className="sb-link">
          <TriangleAlert size={18} aria-hidden="true" />
          <span className="label">Weak concepts</span>
          {!!weakCount && <span className="count" aria-label={`${weakCount} weak concepts`}>{weakCount}</span>}
        </NavLink>
        <NavLink to="/labs" className="sb-link">
          <FlaskConical size={18} aria-hidden="true" />
          <span className="label">Lab records</span>
        </NavLink>
      </nav>

      <nav className="sb-nav" aria-labelledby="sb-subjects">
        <p className="sb-group-label" id="sb-subjects">
          Subjects
        </p>
        {subjects.data?.map((s) => (
          <NavLink key={s.id} to={`/subjects/${s.id}`} className="sb-link">
            <span className="sb-code">{s.code}</span>
            <span className="label">{s.name}</span>
          </NavLink>
        ))}
        {subjects.isLoading && <span className="skel" style={{ margin: "var(--s-2) var(--s-3)" }} />}
      </nav>

      <nav className="sb-nav sb-foot" aria-label="Workspace settings">
        <NavLink to="/sources" className="sb-link">
          <FileStack size={18} aria-hidden="true" />
          <span className="label">Sources</span>
        </NavLink>
        <NavLink to="/settings" className="sb-link">
          <Settings size={18} aria-hidden="true" />
          <span className="label">Settings</span>
        </NavLink>
        {usingMock && <p className="sb-demo">Demo data · no backend connected</p>}
      </nav>
    </aside>
  );
}
