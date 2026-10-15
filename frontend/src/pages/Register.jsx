/**
 * @file Register.jsx
 * @description New user registration page component.
 * Validates user input (email format and 8+ character password), sends registration request,
 * stores the issued token through AuthProvider, and lets routing continue to onboarding.
 */

import { useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import { apiError } from "../utils/apiError";
import { useAuth } from "../hooks/useAuth";
import AuthLayout, { AuthField } from "../components/AuthLayout";
import { Notice } from "../components/ui";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  /**
   * Handles new account registration form submission.
   * Calls /auth/register, stores the token, and lets the route-level redirect in
   * App.jsx send the new user to /onboarding (or / if they already have a plan).
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const { data } = await client.post("/auth/register", { email: email.trim(), password });
      await login(data.access_token);
    } catch (err) {
      setError(apiError(err, "Registration failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create an account"
      intro="Get your own personalized AI workout plan."
      footer={<>Already have an account? <Link to="/login" className="link">Log in</Link></>}
    >
      {error && <Notice tone="error" role="alert" id="registration-error">{error}</Notice>}
      <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <fieldset disabled={isSubmitting} className="auth-form">
          <legend className="sr-only">Account details</legend>
          <AuthField
            id="register-email" name="email" label="Email" icon="mail"
            type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" required
            value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
            aria-describedby={error ? "registration-error" : undefined}
          />
          <AuthField
            id="register-password" name="password" label="Password" icon="lock"
            type="password" autoComplete="new-password" placeholder="••••••••" required minLength={8} maxLength={128}
            value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
            aria-describedby={error ? "password-hint registration-error" : "password-hint"}
            hint={<p id="password-hint" className="hint">Use 8–128 characters.</p>}
          />
          <button type="submit" disabled={isSubmitting} className="btn btn--primary btn--lg btn--block">
            {isSubmitting ? <><span className="spinner" aria-hidden="true" />Creating account...</> : "Create account"}
          </button>
        </fieldset>
      </form>
    </AuthLayout>
  );
}
