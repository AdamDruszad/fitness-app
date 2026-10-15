import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return (
    <button type="button" className={`icon-btn ${className}`.trim()} onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? <IconSun size={20} stroke={1.75} aria-hidden="true" /> : <IconMoon size={20} stroke={1.75} aria-hidden="true" />}
    </button>
  );
}
