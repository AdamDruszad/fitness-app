import { useAuth } from "../hooks/useAuth";
import { Link, useLocation } from "react-router";
import { IconLayoutDashboard, IconBarbell, IconMessageChatbot, IconChartLine, IconSettings, IconLogout } from "@tabler/icons-react";
import Brand from "./Brand";
import ThemeToggle from "./ThemeToggle";

const NAV_ITEMS = [
  { to: "/", icon: IconLayoutDashboard, label: "Your plan" },
  { to: "/log", icon: IconBarbell, label: "Workout" },
  { to: "/coach", icon: IconMessageChatbot, label: "Coach" },
  { to: "/progress", icon: IconChartLine, label: "Progress" },
];

export default function Layout({ children, contentClassName = "" }) {
  const { logout } = useAuth();
  const { pathname } = useLocation();
  const navigation = NAV_ITEMS.map(({ to, icon: Icon, label }) => <Link key={to} to={to} className={pathname === to ? "is-active" : ""} aria-current={pathname === to ? "page" : undefined}><Icon size={20} stroke={1.7} aria-hidden="true" /><span>{label}</span></Link>);
  return (
    <div className="fitai-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="fitai-header">
        <div className="fitai-header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">{navigation}</nav>
          <div className="header-actions">
            <ThemeToggle />
            <Link to="/onboarding" className="icon-button" aria-label="Training preferences" title="Training preferences"><IconSettings size={19} aria-hidden="true" /></Link>
            <button type="button" onClick={logout} className="icon-button" aria-label="Sign out" title="Sign out"><IconLogout size={19} aria-hidden="true" /></button>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={`fitai-content ${contentClassName}`}>{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">{navigation}</nav>
    </div>
  );
}

