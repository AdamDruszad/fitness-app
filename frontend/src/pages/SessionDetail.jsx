import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
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
  return <Layout><Link className="text-link" to="/progress">Back to progress</Link><PageHeading eyebrow="Your recorded training" title={session?.workout_snapshot?.day?.day || "Saved session"} description={session ? `${session.session_date} · ${session.status === "completed" ? "Completed workout" : "Legacy record — completion unverified"}${session.workout_snapshot ? ` · Plan version ${session.workout_snapshot.version}` : ""}` : "Loading session…"} />
    {error && <p role="alert" className="continuity-error">{error}</p>}
    {(editing || session)?.exercise_logs.map((log, li) => <section className="continuity-card" key={log.id}><h2>{log.exercise_name || "Unspecified legacy exercise"}</h2><p>{log.load_basis.replace("_", " ")}</p>{editing ? (log.sets_data || []).map((s, si) => <div className="prescription-fields" key={si}><label>Set {si + 1}: kg<input type="number" step="any" min="0" disabled={busy || log.load_basis === "bodyweight"} value={s.weight ?? ""} onChange={e => change(li, si, "weight", e.target.value)} /></label><label>{log.measurement === "duration" ? "Seconds" : "Reps"}<input type="number" min="1" step="1" disabled={busy} value={s[log.measurement === "duration" ? "duration_seconds" : "reps"] ?? ""} onChange={e => change(li, si, log.measurement === "duration" ? "duration_seconds" : "reps", e.target.value)} /></label></div>) : <p>{formatSets(log.sets_data, log.measurement)}</p>}{log.target_data && <details><summary>Target used</summary><p>{log.target_data.reason}</p></details>}{log.notes && <p>{log.notes}</p>}</section>)}
    {session && (editing ? <div className="continuity-actions"><button className="fitai-primary-button" disabled={busy} onClick={save}>Save correction</button><button className="fitai-secondary-button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><p>Progress and next targets use your corrected values.</p></div> : <button className="fitai-secondary-button" onClick={() => setEditing(structuredClone(session))}>Correct an entry</button>)}
  </Layout>;
}
