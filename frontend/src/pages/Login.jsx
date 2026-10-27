/**
 * @file Login.jsx
 * @description User login page component.
 * Provides credentials authentication form (email & password) and a one-click
 * demo session, stores the session through AuthProvider on success and displays error alerts.
 */

import { useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import AuthLayout, { AuthField } from "../components/AuthLayout";
import { Notice } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingDemo, setIsStartingDemo] = useState(false);
  const { login } = useAuth();
  const busy = isSubmitting || isStartingDemo;

  /**
   * Handles user login submission.
   * Submits credentials to /auth/login, stores access_token on success, and lets
   * the route-level redirect in App.jsx move the signed-in user to the right page.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setIsSubmitting(true);
    setError("");

    try {
      const { data } = await client.post("/auth/login", { email, password });
      // Persist access token in localStorage for subsequent authenticated API requests
      await login(data.access_token);
    } catch (err) {
      setError(err.response?.status === 401 ? "Invalid email or password." : "Couldn't log in. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Opens a fresh guest account with a sample plan and history (/auth/guest),
   * so visitors can explore the app without registering.
   */
  const handleDemo = async () => {
    if (busy) return;
    setIsStartingDemo(true);
    setError("");

    try {
      const { data } = await client.post("/auth/guest");
      await login(data.access_token);
    } catch (err) {
      setError(err.response?.status === 429
        ? "Too many demo sessions from your network. Try again in a few minutes."
        : "Couldn't open the demo. Check your connection and try again.");
    } finally {
      setIsStartingDemo(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      footer={<>Don't have an account? <Link to="/register" className="link">Register</Link></>}
    >
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={busy}>
        {error && <Notice tone="error" role="alert" id="login-error">{error}</Notice>}
        <AuthField
          id="login-email" label="Email" icon="mail"
          type="email" autoComplete="email" placeholder="you@example.com" required
          disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
        <AuthField
          id="login-password" label="Password" icon="lock"
          type="password" autoComplete="current-password" placeholder="••••••••" required
          disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
        <button type="submit" disabled={busy} className="btn btn--primary btn--lg btn--block">
          {isSubmitting ? <><span className="spinner" aria-hidden="true" />Logging in...</> : "Log in"}
        </button>
      </form>
      <div className="auth-demo">
        <p id="demo-hint" className="muted">Just looking? Open a demo with a sample plan and workout history. No registration needed.</p>
        <button type="button" onClick={handleDemo} disabled={busy} aria-describedby="demo-hint" className="btn btn--secondary btn--lg btn--block">
          {isStartingDemo ? <><span className="spinner" aria-hidden="true" />Opening demo...</> : "Try the demo"}
        </button>
      </div>
    </AuthLayout>
  );
}
