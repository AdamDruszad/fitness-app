/**
 * @file useAuth.js
 * @description Custom React hook providing access to shared authentication state and actions.
 */

import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * useAuth hook
 * 
 * Provides authenticated user profile, loading state, and session management handlers.
 * 
 * @returns {{
 *   user: Object|null,
 *   loading: boolean,
 *   login: (token: string) => Promise<void>,
 *   logout: () => void,
 *   refetchUser: () => Promise<void>
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}