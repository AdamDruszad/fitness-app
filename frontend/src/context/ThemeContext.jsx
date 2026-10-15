/**
 * @file ThemeContext.jsx
 * @description React Context Provider managing application-wide dark/light theme switching.
 * Persists the user's theme preference in localStorage and toggles the '.light' CSS class
 * on document.documentElement for Tailwind CSS / custom CSS variable styling.
 */

import { useState, useEffect } from "react";
import { ThemeContext } from "./theme";

/**
 * ThemeProvider component wrapping application root.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components receiving theme context.
 */
export function ThemeProvider({ children }) {
  // Read initial theme preference from localStorage, default to "dark"
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });

  // Synchronize CSS class on <html> element and persist in localStorage
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try { localStorage.setItem("theme", theme); } catch { /* Theme works without storage. */ }
  }, [theme]);

  // Toggle between dark and light themes
  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
