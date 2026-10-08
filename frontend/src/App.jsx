/**
 * @file App.jsx
 * @description Main application router component.
 * Configures client-side routing with React Router, wraps routes in an ErrorBoundary,
 * verifies authentication status via useAuth, and protects authenticated routes.
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import WorkoutLogger from "./pages/WorkoutLogger";
import { lazy, Suspense, useEffect } from "react";
import Progress from "./pages/Progress";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./ErrorBoundary";
const Coach = lazy(() => import("./pages/Coach"));

// Browser titles for every real route; unknown paths fall back to the 404 title.
const PAGE_TITLES = {
  "/": "Your plan",
  "/log": "Log workout",
  "/coach": "AI Coach",
  "/progress": "Your progress",
  "/onboarding": "Training preferences",
  "/login": "Log in",
  "/register": "Create account",
};

/** Keeps document.title in sync with the route so tabs and history stay readable. */
function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `FitAI — ${PAGE_TITLES[pathname] || "Page not found"}`;
  }, [pathname]);
  return null;
}

/**
 * Root Application Component
 */
export default function App() {
  const { user, loading, error, refetchUser, logout } = useAuth();

  // Defer rendering routes until initial token validation check finishes
  if (loading) return <div className="workout-empty" role="status"><p>Opening your training space…</p></div>;
  if (error) return <div className="workout-empty"><h1>Let's reconnect.</h1><p role="alert">{error}</p><button type="button" className="fitai-primary-button" onClick={refetchUser}>Try again</button><button type="button" className="fitai-secondary-button" onClick={logout}>Return to login</button></div>;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DocumentTitle />
        <Routes>
          {/* Public Authentication Routes: signed-in users go to their plan or profile setup */}
          <Route path="/login" element={user ? <Navigate to={user.goal ? "/" : "/onboarding"} replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to={user.goal ? "/" : "/onboarding"} replace /> : <Register />} />

          {/* Protected Routes (require authenticated user session) */}
          <Route
            path="/onboarding"
            element={protectedPage(<Onboarding />)}
          />
          <Route
            path="/"
            element={protectedPage(<Dashboard />)}
          />
          <Route
            path="/log"
            element={protectedPage(<WorkoutLogger />)}
          />
          <Route
            path="/coach"
            element={user ? <Suspense fallback={<div className="workout-empty" role="status">Opening your coach…</div>}><Coach /></Suspense> : <Navigate to="/login" replace />}
          />
          <Route
            path="/progress"
            element={protectedPage(<Progress />)}
          />

          {/* 404 Catch-All Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
