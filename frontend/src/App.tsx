import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { TodayPage } from "./pages/Today";
import { PrioritiesPage } from "./pages/Priorities";
import { SubjectPage } from "./pages/Subject";
import { TopicPage } from "./pages/Topic";
import { PlanPage } from "./pages/Plan";
import { PracticePage } from "./pages/Practice";
import { QuizPage } from "./pages/Quiz";
import { WeakPage } from "./pages/Weak";
import { LabsPage } from "./pages/Labs";
import { SourcesPage } from "./pages/Sources";
import { SettingsPage } from "./pages/Settings";
import { TimetablePage } from "./pages/Timetable";

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TodayPage />} />
        <Route path="priorities" element={<PrioritiesPage />} />
        <Route path="subjects/:id" element={<SubjectPage />} />
        <Route path="topics/:id" element={<TopicPage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="practice/:id" element={<QuizPage />} />
        <Route path="weak" element={<WeakPage />} />
        <Route path="labs" element={<LabsPage />} />
        <Route path="sources" element={<SourcesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="page">
      <h1 className="page-title">Page not found</h1>
      <p className="page-lede">
        That link doesn't match anything in your workspace. <Link to="/">Go to Today</Link>.
      </p>
    </div>
  );
}
