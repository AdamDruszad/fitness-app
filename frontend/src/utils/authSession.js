/** Shared session state; interrupted requests must never restore a signed-out user. */
export function createAuthSession(client, { readToken, writeToken }) {
  let state = { user: null, loading: true, error: "" };
  let generation = 0;
  let controller;
  const listeners = new Set();
  const publish = (next) => { state = next; listeners.forEach(listener => listener()); };
  const cancel = () => { generation++; controller?.abort(); };
  const logout = () => {
    cancel();
    writeToken(null);
    publish({ user: null, loading: false, error: "" });
  };
  async function refetchUser() {
    cancel();
    if (!readToken()) {
      publish({ user: null, loading: false, error: "" });
      return null;
    }
    const request = generation;
    controller = new AbortController();
    publish({ user: null, loading: true, error: "" });
    try {
      // Fail fast: this check gates the first render, so it gets a short timeout
      // instead of inheriting the 30s global one used by slow AI endpoints.
      const { data } = await client.get("/users/me", { signal: controller.signal, timeout: 8000 });
      if (request !== generation) return null;
      publish({ user: data, loading: false, error: "" });
      return data;
    } catch (error) {
      if (request !== generation) return null;
      if (error.response?.status === 401) logout();
      else publish({ user: null, loading: false, error: "We couldn't check your session. Check your connection and try again." });
      return null;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    refetchUser,
    logout,
    cancel,
    async login(token) {
      if (typeof token !== "string" || !token) throw new Error("The server did not return a session.");
      writeToken(token);
      return refetchUser();
    },
  };
}
