/**
 * @file App.jsx
 * @description Main application router component.
 * Configures client-side routing with React Router, wraps routes in an ErrorBoundary,
 * verifies authentication status via useAuth, and protects authenticated routes.
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import WorkoutLogger from "./pages/WorkoutLogger";
import Coach from "./pages/Coach";
import Progress from "./pages/Progress";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Root Application Component
 */
export default function App() {
  const { user, loading } = useAuth();

  // Defer rendering routes until initial token validation check finishes
  if (loading) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes (require authenticated user session) */}
          <Route
            path="/onboarding"
            element={user ? <Onboarding /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/"
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/log"
            element={user ? <WorkoutLogger /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/coach"
            element={user ? <Coach /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/progress"
            element={user ? <Progress /> : <Navigate to="/login" replace />}
          />

          {/* 404 Catch-All Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
