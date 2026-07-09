import { useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import {
  IconAlertCircle,
  IconMoon,
  IconMail,
  IconLock,
} from "@tabler/icons-react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await client.post("/auth/register", { email, password });
      localStorage.setItem("token", data.access_token);
      window.location.href = '/onboarding';
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div className="bg-base h-screen flex justify-center items-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-grid-line) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-accent/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/20 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-surface rounded-2xl p-8 w-full max-w-sm border border-border-subtle relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-7 bg-brand-accent -skew-x-12"></span>
            <span className="text-text-main tracking-tight text-2xl font-bold">
              FitAI
            </span>
          </div>
          <button
            aria-label="Change Theme"
            className="bg-input rounded-full p-2.5 border border-border-subtle shrink-0 cursor-pointer hover:bg-gray-800"
          >
            <IconMoon className="w-4 h-4 text-text-main" stroke={2} />
          </button>
        </div>

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

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm border border-red-800 rounded-lg px-3 py-2 -mt-1 mb-4">
            <IconAlertCircle className="w-4 h-4 shrink-0" stroke={2} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3">
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
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="text-white bg-brand-accent rounded-xl px-2 py-3 mt-2 font-semibold shadow-lg shadow-brand-accent/20 hover:opacity-90 cursor-pointer transition"
          >
            Create account
          </button>
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
