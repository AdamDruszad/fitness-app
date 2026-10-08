import { useEffect, useState, useSyncExternalStore } from "react";
import { AuthContext } from "./AuthContext";
import client from "../api/client";
import { readToken, writeToken } from "../api/token";
import { createAuthSession } from "../utils/authSession";

export function AuthProvider({ children }) {
  const [session] = useState(() => createAuthSession(client, { readToken, writeToken }));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    session.refetchUser();
    const syncStorage = (event) => {
      if (event.key === "token" || event.key === null) {
        writeToken(event.key === "token" ? event.newValue : null);
        session.refetchUser();
      }
    };
    window.addEventListener("fitai:unauthorized", session.logout);
    window.addEventListener("storage", syncStorage);
    return () => {
      session.cancel();
      window.removeEventListener("fitai:unauthorized", session.logout);
      window.removeEventListener("storage", syncStorage);
    };
  }, [session]);
  return <AuthContext.Provider value={{ ...state, login: session.login, logout: session.logout, refetchUser: session.refetchUser }}>{children}</AuthContext.Provider>;
}
