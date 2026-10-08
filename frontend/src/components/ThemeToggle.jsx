import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return <button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>{theme === "dark" ? <IconSun size={19} stroke={1.7} /> : <IconMoon size={19} stroke={1.7} />}</button>;
}
