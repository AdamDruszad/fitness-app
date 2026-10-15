import { useEffect, useState } from "react";
import { IconDeviceMobile } from "@tabler/icons-react";
import { useAuth } from "../hooks/useAuth";
import { loadDraft } from "../utils/drafts";

export default function InstallHelp() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const install = e => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", install);
    if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").then(reg => {
      if (!active) return;
      if (reg.waiting) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => { const worker = reg.installing; worker?.addEventListener("statechange", () => { if (active && worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker); }); });
    }).catch(() => { if (active) setNotice("Home-screen use is available where supported. Installation setup could not finish; try again later."); });
    return () => { active = false; window.removeEventListener("beforeinstallprompt", install); };
  }, []);
  async function install() { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
  async function update() {
    try {
      const { draft } = await loadDraft(user.id);
      if (draft) { setNotice("An update is ready. Finish or discard your saved workout before applying it."); return; }
      // Activation is explicit, and deliberately never forces a page reload.
      waiting.postMessage("ACTIVATE_AFTER_WORKOUT"); setWaiting(null); setNotice("Update activated. It will be used next time you open FitAI.");
    } catch { setNotice("Could not check saved workouts. Apply the update after your session."); }
  }
  return (
    <details className="disclosure install-help">
      <summary><IconDeviceMobile size={20} stroke={1.75} className="text-accent-text" aria-hidden="true" />Keep FitAI one tap away</summary>
      <div className="disclosure-body small">
        <p>Add FitAI to your home screen for an app-like training space.</p>
        {prompt ? <button type="button" className="btn btn--secondary" onClick={install}>Add to home screen</button> : <p className="muted">On iPhone/iPad: open in Safari, tap Share, then Add to Home Screen. On Android or desktop: use your browser's Install app or Add to Home Screen menu where supported.</p>}
        <p className="muted">Opening the app requires a connection. In-progress workouts saved on this device can be recovered after reconnecting. Browser storage can be cleared; only “Workout saved” confirms a server record.</p>
        {waiting && <button type="button" className="btn btn--secondary" onClick={update}>Apply available update after training</button>}
        <p role="status">{notice}</p>
      </div>
    </details>
  );
}
