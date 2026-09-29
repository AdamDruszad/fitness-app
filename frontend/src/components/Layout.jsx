/**
 * @file Layout.jsx
 * @description Master app layout component wrapping authenticated views.
 * Provides the ambient background grid styling, top navigation header with branding
 * and settings/signout links, page container, and bottom navigation bar with active route highlighting.
 */

import { useAuth } from "../hooks/useAuth";
import { Link, useLocation, useNavigate } from "react-router";
import {
    IconLayoutDashboard,
    IconBarbell,
    IconMessageChatbot,
    IconChartLine
} from "@tabler/icons-react";

/**
 * Bottom navigation destinations.
 */
const NAV_ITEMS = [
    { to: "/", icon: IconLayoutDashboard, label: "Dashboard" },
    { to: "/log", icon: IconBarbell, label: "Log" },
    { to: "/coach", icon: IconMessageChatbot, label: "Coach" },
    { to: "/progress", icon: IconChartLine, label: "Progress" },
];

/**
 * Layout Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child page content to render inside main container.
 */
export default function Layout({ children }) {
    const { logout } = useAuth();
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-base relative">
            {/* Ambient Background Decorative Grid & Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, var(--color-grid-line) 2px, transparent 2px), linear-gradient(to bottom, var(--color-grid-line) 2px, transparent 2px)",
                        backgroundSize: "40px 40px",
                    }}
                />
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl" />
            </div>

            {/* Top Navigation Header */}
            <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-base/40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-7 bg-brand-accent -skew-x-12"></span>
                    <span className="text-text-main tracking-tight text-2xl font-bold">
                        FitAI
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <Link
                        to="/onboarding"
                        className="text-text-muted hover:text-text-main font-medium transition"
                    >
                        Settings
                    </Link>
                    <button
                        className="text-text-muted hover:text-text-main font-medium cursor-pointer transition"
                        onClick={handleLogout}
                    >
                        Sign out
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 px-6 py-6 max-w-3xl mx-auto pb-24">
                {children}
            </main>

            {/* Fixed Bottom Mobile Navigation Bar */}
            <nav className="fixed z-20 bottom-0 left-0 right-0 bg-base/85 backdrop-blur-md border-t border-border-subtle px-6 py-2">
                <div className="max-w-3xl mx-auto flex justify-around">
                    {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
                        const active = pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-medium transition ${active
                                    ? "text-brand-accent"
                                    : "text-text-muted hover:text-text-main"
                                    }`}
                            >
                                <Icon size={22} stroke={1.8} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}