import { useAuth } from "../hooks/useAuth";
import { Link, useLocation } from "react-router";
import { IconLayoutDashboard, IconBarbell, IconMessageChatbot, IconChartLine, IconSettings, IconLogout } from "@tabler/icons-react";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";
import { useEffect } from "react";

// `section` lists deeper paths that belong to a tab, so it stays highlighted there.
const NAV_ITEMS = [
  { to: "/", icon: IconLayoutDashboard, label: "Your plan", section: ["/plans/"] },
  { to: "/log", icon: IconBarbell, label: "Workout", section: [] },
  { to: "/coach", icon: IconMessageChatbot, label: "Coach", section: [] },
  { to: "/progress", icon: IconChartLine, label: "Progress", section: ["/sessions/"] },
];

/**
 * App shell for signed-in pages.
 * width: "wide" (default, 1120px) or "narrow" (760px reading column).
 */
export default function Layout({ children, contentClassName = "", width = "wide" }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  const navigation = NAV_ITEMS.map(({ to, icon: Icon, label, section }) => {
    const exact = pathname === to;
    const inSection = exact || section.some(prefix => pathname.startsWith(prefix));
    return (
      <Link key={to} to={to} className={inSection ? "is-active" : undefined} aria-current={exact ? "page" : inSection ? "true" : undefined}>
        <Icon size={20} stroke={1.75} aria-hidden="true" /><span>{label}</span>
      </Link>
    );
  });
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <div className="shell app-header-inner">
          <Brand />
          <nav className="primary-nav" aria-label="Main navigation">{navigation}</nav>
          <div className="header-actions">
            <ThemeToggle />
            <Link to="/onboarding" className="icon-btn" aria-label="Training preferences" title="Training preferences"><IconSettings size={20} stroke={1.75} aria-hidden="true" /></Link>
            <button type="button" onClick={logout} className="icon-btn" aria-label="Sign out" title="Sign out"><IconLogout size={20} stroke={1.75} aria-hidden="true" /></button>
          </div>
        </div>
      </header>
      {user?.is_guest && (
        <div className="demo-banner" role="note">
          <p className="shell">You're in a demo account with sample data. Sign out and register to keep your own training.</p>
        </div>
      )}
      <main id="main-content" tabIndex={-1} className={`page${width === "narrow" ? " page--narrow" : ""} ${contentClassName}`.trim()}>{children}</main>
      <nav className="tab-bar" aria-label="Mobile navigation">{navigation}</nav>
    </div>
  );
}
