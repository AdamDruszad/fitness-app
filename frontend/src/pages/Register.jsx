/**
 * @file Register.jsx
 * @description New user registration page component.
 * Validates user input (email format and 8+ character password), sends registration request,
 * stores the issued JWT token in localStorage, and navigates immediately to the onboarding flow.
 */

import { useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import { apiError } from "../utils/apiError";
import {
  IconAlertCircle,
  IconMoon,
  IconMail,
  IconLock,
  IconSun
} from "@tabler/icons-react";
import { useTheme } from "../hooks/useTheme";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme, toggleTheme } = useTheme();

  /**
   * Handles new account registration form submission.
   * Calls /auth/register, sets local storage token, and redirects to /onboarding.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const { data } = await client.post("/auth/register", { email: email.trim(), password });
      localStorage.setItem("token", data.access_token);
      window.location.href = '/onboarding';
    } catch (err) {
      setError(apiError(err, "Registration failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-base min-h-screen flex justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Decorative ambient background elements */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-grid-line) 2px, transparent 2px), linear-gradient(to bottom, var(--color-grid-line) 2px, transparent 2px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl pointer-events-none" />

      {/* Registration Card Form */}
      <div className="bg-surface rounded-2xl p-6 sm:p-8 w-full max-w-sm border border-border-subtle relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-7 bg-brand-accent -skew-x-12"></span>
            <span className="text-text-main tracking-tight text-2xl font-bold">
              FitAI
            </span>
          </div>
          {/* Theme switcher toggle */}
          <button
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="bg-input rounded-full p-2.5 min-w-11 min-h-11 flex items-center justify-center border border-border-subtle shrink-0 cursor-pointer hover:bg-surface/50"
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <IconMoon className="w-4 h-4 text-text-main" stroke={2} />
            ) : (
              <IconSun className="w-4 h-4 text-text-main" stroke={2} />
            )}
          </button>
        </div>

        {/* Pulse waveform accent icon */}
        <svg
          className="w-full h-8 mb-6 block text-brand-accent"
          viewBox="0 0 292 32"
          aria-hidden="true"
        >
          <path
            d="M0 16 L54 16 L68 4 L84 28 L99 9 L112 16 L292 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <h1 className="text-text-main font-bold text-3xl mb-2">
          Create an account
        </h1>
        <p className="text-text-muted tracking-tight mb-5">
          Get your own personalized AI workout plan.
        </p>

        {/* Error notification banner */}
        {error && (
          <div id="registration-error" role="alert" className="workout-message workout-message--error mb-4">
            <IconAlertCircle className="w-4 h-4 shrink-0" stroke={2} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <fieldset disabled={isSubmitting} className="grid grid-cols-1 gap-3 min-w-0">
            <legend className="sr-only">Account details</legend>
          {/* Email field */}
          <label htmlFor="register-email" className="text-sm font-medium text-text-main">Email</label>
          <div className="relative">
            <IconMail
              aria-hidden="true"
              className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
              stroke={2}
            />
            <input
              id="register-email"
              name="email"
              aria-describedby={error ? "registration-error" : undefined}
              className="w-full bg-input border border-border-subtle text-text-main placeholder:text-text-muted rounded-xl pl-10 pr-3 py-3 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 transition"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              required
            />
          </div>

          {/* Password field with minimum length requirement */}
          <label htmlFor="register-password" className="text-sm font-medium text-text-main">Password</label>
          <div className="relative">
            <IconLock
              aria-hidden="true"
              className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
              stroke={2}
            />
            <input
              id="register-password"
              name="password"
              aria-describedby={error ? "password-hint registration-error" : "password-hint"}
              className="w-full bg-input border border-border-subtle text-text-main placeholder:text-text-muted rounded-xl pl-10 pr-3 py-3 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 transition"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              required
              minLength={8}
              maxLength={128}
            />
          </div>

          <p id="password-hint" className="text-xs text-text-muted">Use 8–128 characters.</p>

          {/* Submit action button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex justify-center items-center text-white bg-brand-accent rounded-xl px-2 py-3 mt-2 font-semibold shadow-lg shadow-brand-accent/20 hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? (
              <>
                <span aria-hidden="true" className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </button>
          </fieldset>
        </form>

        <p className="text-text-muted text-sm text-center mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-accent font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
