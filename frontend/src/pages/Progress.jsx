import { useEffect, useState } from "react";
import { Link } from "react-router";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import client from "../api/client";
import { apiError } from "../utils/plans";
import { formatSets } from "../utils/drafts";

function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function Progress() {
  const [sessions, setSessions] = useState([]);
  const [next, setNext] = useState(null);
  const [summary, setSummary] = useState(null);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const [suggestions, setSuggestions] = useState(null);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true); setError("");
    Promise.all([client.get("/sessions/history", { signal: c.signal }), client.get("/sessions/summary", { signal: c.signal, params: { today: localDate() } })]).then(([history, stats]) => { setSessions(history.data.items); setNext(history.data.next); setSummary(stats.data); setGoal(stats.data.weekly_goal || ""); }).catch(e => { if (!c.signal.aborted) setError(apiError(e)); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [reload]);
  async function more() {
    setBusy(true);
    try { const { data } = await client.get("/sessions/history", { params: { before: next } }); setSessions(s => [...s, ...data.items]); setNext(data.next); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function saveGoal(e) {
    e.preventDefault(); setBusy(true);
    try { await client.put("/users/me", { weekly_session_goal: goal === "" ? null : Number(goal) }); setSummary(s => ({ ...s, weekly_goal: goal || null })); setNotice("Weekly goal saved."); }
    catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  }
  async function download() {
    setBusy(true);
    try { const { data } = await client.get("/sessions/export", { responseType: "blob" }); const url = URL.createObjectURL(data); const a = document.createElement("a"); a.href = url; a.download = "fitai-workouts.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function advice() {
    setBusy(true);
    try { const { data } = await client.get("/progress/suggestions"); setSuggestions(data.suggestions); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  const groups = new Map();
  for (const session of sessions.filter(s => s.status === "completed")) for (const log of session.exercise_logs) {
    const key = log.exercise_id || `${log.exercise_name}:${log.measurement}:${log.load_basis}`;
    if (!groups.has(key)) groups.set(key, { name: log.exercise_name, entries: [] });
    groups.get(key).entries.push({ ...log, date: session.session_date, sessionId: session.id });
  }
  return <Layout><PageHeading eyebrow="See what you did. Choose what's next." title="Your progress" description="Your completed training, with full history and metric-unit export." />
    {error && <div className="continuity-error" role="alert">{error}<button className="fitai-secondary-button" onClick={() => setReload(v => v + 1)}>Reload history</button></div>}
    {loading ? <p role="status">Loading your training records…</p> : <>
      {summary && <section className="continuity-card"><h2>{summary.completed} completed workouts</h2><p>{summary.week_completed}{summary.weekly_goal ? ` of your ${summary.weekly_goal} planned sessions` : " sessions"} completed this week · Since {summary.week_start}</p><form onSubmit={saveGoal}><label>Optional weekly session goal<input type="number" min="1" max="14" value={goal} onChange={e => setGoal(e.target.value)} /></label><button className="fitai-secondary-button" disabled={busy}>Save goal</button></form><p role="status">{notice}</p></section>}
      {!sessions.length && !error && <section className="continuity-card"><h2>Your first workout creates a baseline.</h2><Link className="fitai-primary-button" to="/log">Open a workout</Link></section>}
      <h2>Exercise performance</h2><p>Comparisons below cover {sessions.length} loaded records{next ? "; load earlier sessions for more" : " (all available history)"}. Equipment and measurement variants stay separate.</p>
      <details className="continuity-card"><summary>Coach's training ideas</summary><p>Optional AI advice. Actual next-session targets appear in your workout with their source and rule.</p><button className="fitai-secondary-button" disabled={busy} onClick={advice}>Ask for training ideas</button>{suggestions?.map((s, i) => <p key={i}><strong>{s.exercise}</strong><br />{s.suggestion}</p>)}{suggestions?.length === 0 && <p>No coaching ideas available yet.</p>}</details>
      {[...groups.entries()].map(([key, group]) => <details className="continuity-card" key={key}><summary>{group.name} · {group.entries.length} records loaded</summary>{group.entries.map((e, i) => <p key={i}><Link className="text-link" to={`/sessions/${e.sessionId}`}>{e.date}</Link> · {e.load_basis.replace("_", " ")}<br />{formatSets(e.sets_data, e.measurement)}</p>)}</details>)}
      <h2>Session history</h2>{sessions.map(s => <Link className="continuity-card session-history-link" key={s.id} to={`/sessions/${s.id}`}><strong>{s.workout_snapshot?.day?.day || "Training record"} · {s.session_date}</strong><span>{s.exercise_logs.length} exercises · {s.status === "completed" ? "Completed" : "Legacy record — completion unverified"}</span></Link>)}
      <div className="continuity-actions">{next && <button className="fitai-secondary-button" disabled={busy} onClick={more}>Load earlier sessions</button>}<button className="text-link" disabled={busy} onClick={download}>Export all workouts (JSON)</button></div>
    </>}
  </Layout>;
}
