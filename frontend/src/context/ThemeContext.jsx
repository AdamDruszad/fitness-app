/**
 * @file ThemeContext.jsx
 * @description React Context Provider managing application-wide dark/light theme switching.
 * A saved choice in localStorage wins; otherwise the system preference decides. The '.light'
 * class on document.documentElement switches the CSS tokens (see styles/tokens.css), and an
 * inline script in index.html applies the same rule before first paint to avoid a flash.
 */

import { useState, useEffect } from "react";
import { ThemeContext } from "./theme";

const THEME_COLORS = { dark: "#121110", light: "#f6f2eb" };

function initialTheme() {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Fall back to the system preference. */ }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * ThemeProvider component wrapping application root.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components receiving theme context.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  // Synchronize the CSS class and the browser chrome colour with the active theme
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute("content", THEME_COLORS[theme]));
  }, [theme]);

  // Toggle between dark and light themes; only an explicit choice is remembered
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch { /* Theme works without storage. */ }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
