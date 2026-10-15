/**
 * @file App.jsx
 * @description Main application router component.
 * Configures client-side routing with React Router, wraps routes in an ErrorBoundary,
 * verifies authentication status via useAuth, and protects authenticated routes.
 * Every page is code-split so the sign-in screen does not download the signed-in app.
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { lazy, Suspense, useEffect } from "react";
import { IconWifiOff } from "@tabler/icons-react";
import { useAuth } from "./hooks/useAuth";
import { ErrorBoundary } from "./ErrorBoundary";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WorkoutLogger = lazy(() => import("./pages/WorkoutLogger"));
const Progress = lazy(() => import("./pages/Progress"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PlanReview = lazy(() => import("./pages/PlanReview"));
const PlanHistory = lazy(() => import("./pages/PlanHistory"));
const SessionDetail = lazy(() => import("./pages/SessionDetail"));
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
    document.title = `FitAI — ${PAGE_TITLES[pathname] || (pathname.startsWith("/plans/") ? "Your routine" : pathname.startsWith("/sessions/") ? "Saved session" : "Page not found")}`;
  }, [pathname]);
  return null;
}

/** Full-screen state used before routes render (session check, lazy page loads). */
function StateScreen({ children, busy = false }) {
  return (
    <div className="center-state">
      <div className="center-panel">
        <span className="brand" aria-hidden="true"><span className="bar" /><span>FitAI</span></span>
        {busy ? <p className="loading-line" role="status"><span className="spinner" aria-hidden="true" />{children}</p> : children}
      </div>
    </div>
  );
}

/**
 * Root Application Component
 */
export default function App() {
  const { user, loading, error, refetchUser, logout } = useAuth();
  const protectedPage = page => user ? <div key={user.id}>{page}</div> : <Navigate to="/login" replace />;

  // Defer rendering routes until initial token validation check finishes
  if (loading) return <StateScreen busy>Opening your training space…</StateScreen>;
  if (error) return (
    <StateScreen>
      <IconWifiOff size={32} stroke={1.5} className="text-accent-text" aria-hidden="true" />
      <h1 className="display state-title">Let's reconnect.</h1>
      <p role="alert" className="muted">{error}</p>
      <div className="row">
        <button type="button" className="btn btn--primary" onClick={refetchUser}>Try again</button>
        <button type="button" className="btn btn--secondary" onClick={logout}>Return to login</button>
      </div>
    </StateScreen>
  );

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DocumentTitle />
        <Suspense fallback={<StateScreen busy>Opening your training space…</StateScreen>}>
          <Routes>
            <Route path="/plans/proposals/:id" element={protectedPage(<PlanReview />)} />
            <Route path="/plans/history" element={protectedPage(<PlanHistory />)} />
            <Route path="/sessions/:id" element={protectedPage(<SessionDetail />)} />
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
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
