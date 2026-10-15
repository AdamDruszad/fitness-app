import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { IconPencil, IconTarget } from "@tabler/icons-react";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import { BackLink, Notice } from "../components/ui";
import client from "../api/client";
import { apiError } from "../utils/plans";
import { formatSets } from "../utils/drafts";

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(); client.get(`/sessions/${id}`, { signal: c.signal }).then(r => setSession(r.data)).catch(e => { if (!c.signal.aborted) setError(apiError(e)); }); return () => c.abort(); }, [id]);
  async function save() {
    setBusy(true); setError("");
    try {
      const logs = Object.fromEntries(editing.exercise_logs.filter(log => log.sets_data?.length).map(log => [log.id, log.sets_data.map(s => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, Number(v)])))]));
      const { data } = await client.put(`/sessions/${id}/correction`, { revision: session.revision, logs, notes: editing.notes });
      setSession(data); setEditing(null);
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  function change(li, si, field, value) {
    setEditing(s => ({ ...s, exercise_logs: s.exercise_logs.map((l, i) => i !== li ? l : { ...l, sets_data: l.sets_data.map((set, j) => j !== si ? set : { ...set, [field]: value }) }) }));
  }
  return <Layout width="narrow" contentClassName="session-detail">
    <BackLink to="/progress">Back to progress</BackLink>
    <PageHeading eyebrow="Your recorded training" title={session?.workout_snapshot?.day?.day || "Saved session"} description={session ? `${session.session_date} · ${session.status === "completed" ? "Completed workout" : "Legacy record — completion unverified"}${session.workout_snapshot ? ` · Plan version ${session.workout_snapshot.version}` : ""}` : "Loading session…"}>
      {session && !editing && <button type="button" className="btn btn--secondary" onClick={() => setEditing(structuredClone(session))}><IconPencil size={18} stroke={1.75} aria-hidden="true" />Correct an entry</button>}
    </PageHeading>
    {error && <Notice tone="error" className="review-notice"><p role="alert">{error}</p></Notice>}
    <div className="session-logs">{(editing || session)?.exercise_logs.map((log, li) => <section className="session-log" key={log.id} aria-labelledby={`log-${li}`}>
      <div className="session-log-head">
        <h2 id={`log-${li}`} className="session-log-name">{log.exercise_name || "Unspecified legacy exercise"}</h2>
        <span className="tag">{log.load_basis.replace("_", " ")}</span>
      </div>
      {editing ? <div className="correction-rows">{(log.sets_data || []).map((s, si) => <div className="correction-row" key={si}>
        <label className="field"><span className="field-label">Set {si + 1}: kg</span><input className="input" type="number" step="any" min="0" disabled={busy || log.load_basis === "bodyweight"} value={s.weight ?? ""} onChange={e => change(li, si, "weight", e.target.value)} /></label>
        <label className="field"><span className="field-label">{log.measurement === "duration" ? "Seconds" : "Reps"}</span><input className="input" type="number" min="1" step="1" disabled={busy} value={s[log.measurement === "duration" ? "duration_seconds" : "reps"] ?? ""} onChange={e => change(li, si, log.measurement === "duration" ? "duration_seconds" : "reps", e.target.value)} /></label>
      </div>)}</div> : <p className="session-sets">{log.sets_data?.length ? formatSets(log.sets_data, log.measurement).split(" · ").map((part, i) => <span key={i} className="set-chip num"><span className="set-chip-index">{i + 1}</span>{part}</span>) : formatSets(log.sets_data, log.measurement)}</p>}
      {log.target_data && <details className="target session-target"><summary><IconTarget size={18} stroke={1.75} aria-hidden="true" />Target used</summary><div className="target-body"><p className="muted">{log.target_data.reason}</p></div></details>}
      {log.notes && <p className="session-note">{log.notes}</p>}
    </section>)}</div>
    {session && editing && <div className="action-bar">
      <p className="action-bar-text">Progress and next targets use your corrected values.</p>
      <div className="action-bar-actions">
        <button type="button" className="btn btn--secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>{busy ? <><span className="spinner" aria-hidden="true" />Save correction</> : "Save correction"}</button>
      </div>
    </div>}
  </Layout>;
}
