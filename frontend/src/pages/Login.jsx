/**
 * @file Login.jsx
 * @description User login page component.
 * Provides credentials authentication form (email & password),
 * handles JWT storage in localStorage on success, displays error alerts,
 * and includes a light/dark theme toggle button.
 */

import { useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import { IconMoon, IconMail, IconLock, IconSun } from "@tabler/icons-react";
import { useTheme } from "../hooks/useTheme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme, toggleTheme } = useTheme();

  /**
   * Handles user login submission.
   * Submits credentials to /auth/login, stores access_token on success,
   * and routes user to dashboard ("/").
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      const { data } = await client.post("/auth/login", { email, password });
      // Persist access token in localStorage for subsequent authenticated API requests
      localStorage.setItem("token", data.access_token);
      window.location.href = "/";
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-base h-screen flex justify-center items-center px-4 relative overflow-hidden">
      {/* Decorative background grid and gradient light orbs */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-grid-line) 2px, transparent 2px), linear-gradient(to bottom, var(--color-grid-line) 2px, transparent 2px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card Form */}
      <div className="bg-surface rounded-2xl p-8 w-full max-w-sm border border-border-subtle relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-7 bg-brand-accent -skew-x-12"></span>
            <span className="text-text-main tracking-tight text-2xl font-bold">
              FitAI
            </span>
          </div>
          {/* Theme switcher toggle button */}
          <button
            aria-label="Change Theme"
            className="bg-input rounded-full p-2.5 border border-border-subtle shrink-0 cursor-pointer hover:bg-surface/50"
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

        <h1 className="text-text-main font-bold text-3xl mb-5">Welcome back</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
          {/* Email input field */}
          <div className="relative">
            <IconMail
              className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
              stroke={2}
            />
            <input
              aria-label="Email"
              className="w-full bg-input border border-border-subtle text-text-main placeholder:text-text-muted rounded-xl pl-10 pr-3 py-3 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 transition"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password input field */}
          <div className="relative">
            <IconLock
              className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
              stroke={2}
            />
            <input
              aria-label="Password"
              className="w-full bg-input border border-border-subtle text-text-main placeholder:text-text-muted rounded-xl pl-10 pr-3 py-3 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 transition"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Validation error message */}
          {error && <p className="text-red-400 text-sm -mt-1">{error}</p>}

          {/* Submit action button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex justify-center items-center text-white bg-brand-accent rounded-xl px-2 py-3 mt-2 font-semibold shadow-lg shadow-brand-accent/20 hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Logging in...
              </>
            ) : (
              "Log in"
            )}
          </button>
        </form>

        <p className="text-text-muted text-sm text-center mt-5">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-accent font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
