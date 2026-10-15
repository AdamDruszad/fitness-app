import { IconLock, IconMail } from "@tabler/icons-react";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

// The product promise, from the app manifest description.
const PROMISE = ["Improve your routine.", "Record your training.", "See what to attempt next."];

/** Split sign-in layout: knurled brand panel (desktop) beside the form card. */
export default function AuthLayout({ title, intro, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-panel" aria-label="About FitAI">
        <span className="brand" aria-hidden="true"><span className="bar" /><span>FitAI</span></span>
        <ol className="auth-promise">
          {PROMISE.map((line, index) => <li key={line}><span className="num">{String(index + 1).padStart(2, "0")}</span>{line}</li>)}
        </ol>
        <p className="auth-caption">Your personal AI-powered fitness coach.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-topbar">
          <span className="auth-mobile-brand"><Brand to="/login" /></span>
          <ThemeToggle />
        </div>
        <section className="auth-card" id="auth-form" aria-labelledby="auth-title">
          <h1 id="auth-title" className="display auth-title">{title}</h1>
          {intro && <p className="muted auth-intro">{intro}</p>}
          {children}
          <p className="auth-footer">{footer}</p>
        </section>
      </main>
    </div>
  );
}

/** Labelled email/password input with a leading icon. */
export function AuthField({ id, label, icon, hint, ...inputProps }) {
  const Icon = icon === "mail" ? IconMail : IconLock;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="input-icon">
        <Icon size={18} stroke={1.75} aria-hidden="true" />
        <input id={id} className="input" {...inputProps} />
      </div>
      {hint}
    </div>
  );
}
