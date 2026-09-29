/**
 * @file AuthContext.jsx
 * @description Application-wide React context for managing user authentication state,
 * profile data, and session actions (login, logout, refetch).
 */

import { createContext, useState, useEffect, useCallback } from "react";
import client from "../api/client";

export const AuthContext = createContext(null);

/**
 * AuthProvider component wrapping the application tree.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await client.get("/users/me");
      setUser(response.data);
    } catch {
      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (token) => {
    localStorage.setItem("token", token);
    await fetchCurrentUser();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refetchUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
