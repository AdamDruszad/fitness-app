let memoryToken = null;

export function readToken() {
  try { return localStorage.getItem("token") || memoryToken; }
  catch { return memoryToken; }
}

export function writeToken(token) {
  memoryToken = token;
  try {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  } catch { /* The session can still work in this tab when storage is unavailable. */ }
}
