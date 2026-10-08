/**
 * @file useTheme.js
 * @description Custom React hook providing access to the current theme state ("dark" | "light")
 * and the toggleTheme function provided by ThemeContext.
 */

import { useContext } from "react";
import { ThemeContext } from "../context/theme";

/**
 * Hook to consume theme state and toggle handler.
 * 
 * @returns {{ theme: string, toggleTheme: () => void }}
 */
export function useTheme() {
  return useContext(ThemeContext);
}
