/**
 * @file Login.jsx
 * @description User login page component.
 * Provides credentials authentication form (email & password),
 * stores the session through AuthProvider on success and displays error alerts.
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
  const { login } = useAuth();

  /**
   * Handles user login submission.
   * Submits credentials to /auth/login, stores access_token on success, and lets
   * the route-level redirect in App.jsx move the signed-in user to the right page.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
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

  return (
    <AuthLayout
      title="Welcome back"
      footer={<>Don't have an account? <Link to="/register" className="link">Register</Link></>}
    >
      <form onSubmit={handleSubmit} className="auth-form" aria-busy={isSubmitting}>
        {error && <Notice tone="error" role="alert" id="login-error">{error}</Notice>}
        <AuthField
          id="login-email" label="Email" icon="mail"
          type="email" autoComplete="email" placeholder="you@example.com" required
          disabled={isSubmitting} value={email} onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
        <AuthField
          id="login-password" label="Password" icon="lock"
          type="password" autoComplete="current-password" placeholder="••••••••" required
          disabled={isSubmitting} value={password} onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
        <button type="submit" disabled={isSubmitting} className="btn btn--primary btn--lg btn--block">
          {isSubmitting ? <><span className="spinner" aria-hidden="true" />Logging in...</> : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
