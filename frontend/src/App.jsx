import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import WorkoutLogger from "./pages/WorkoutLogger";
import Coach from "./pages/Coach";
import Progress from "./pages/Progress";

import { ErrorBoundary } from "./ErrorBoundary";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/onboarding"
            element={user ? <Onboarding /> : <Navigate to="/login" />}
          />
          <Route
            path="/"
            element={user ? <Dashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/log"
            element={user ? <WorkoutLogger /> : <Navigate to="/login" />}
          />
          <Route
            path="/coach"
            element={user ? <Coach /> : <Navigate to="/login" />}
          />
          <Route
            path="/progress"
            element={user ? <Progress /> : <Navigate to="/login" />}
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
