import { useEffect, useState } from "react";
import { Link } from "react-router";
import { IconDownload, IconRefresh, IconSparkles, IconChevronRight, IconChartLine } from "@tabler/icons-react";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import { Notice, LoadingLine } from "../components/ui";
import client from "../api/client";
import { apiError } from "../utils/plans";
import { formatSets } from "../utils/drafts";
import { countLabel } from "../utils/format";

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
  const weekGoal = Number(summary?.weekly_goal) || 0;
  return <Layout contentClassName="progress">
    <PageHeading eyebrow="See what you did. Choose what's next." title="Your progress" description="Your completed training, with full history and metric-unit export.">
      <button type="button" className="btn btn--secondary" disabled={busy} onClick={download}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Export all workouts (JSON)</button>
    </PageHeading>
    {error && <Notice tone="error" className="progress-error"><p role="alert">{error}</p><button type="button" className="btn btn--secondary btn--sm" onClick={() => setReload(v => v + 1)}><IconRefresh size={16} aria-hidden="true" />Reload history</button></Notice>}
    {loading ? <LoadingLine>Loading your training records…</LoadingLine> : <>
      {summary && <section className="card progress-summary" aria-labelledby="progress-total">
        <h2 id="progress-total" className="stat progress-total"><span className="stat-value num">{summary.completed}</span><span className="stat-label">{Number(summary.completed) === 1 ? "completed workout" : "completed workouts"}</span></h2>
        <div className="stat progress-week">
          <p className="stat-value num">{summary.week_completed}{weekGoal > 0 && <small>/ {summary.weekly_goal}</small>}</p>
          {weekGoal > 0 && <div className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (summary.week_completed / weekGoal) * 100)}%` }} /></div>}
          <p className="stat-label">{summary.week_completed}{summary.weekly_goal ? ` of your ${summary.weekly_goal} planned sessions` : " sessions"} completed this week · Since {summary.week_start}</p>
        </div>
        <form onSubmit={saveGoal} className="goal-form">
          <label className="field">
            <span className="field-label">Optional weekly session goal</span>
            <input className="input" type="number" min="1" max="14" value={goal} onChange={e => setGoal(e.target.value)} />
          </label>
          <button className="btn btn--secondary" disabled={busy}>Save goal</button>
          <p role="status" className="status-line goal-status">{notice && <><span className="status-dot status-dot--ok" aria-hidden="true" />{notice}</>}</p>
        </form>
      </section>}

      {!sessions.length && !error && <div className="empty progress-empty">
        <IconChartLine size={36} stroke={1.5} aria-hidden="true" />
        <h2>Your first workout creates a baseline.</h2>
        <Link className="btn btn--primary" to="/log">Open a workout</Link>
      </div>}

      <div className="progress-grid">
        <section className="stack" aria-labelledby="performance-heading">
          <div className="stack-sm">
            <h2 id="performance-heading" className="section-title">Exercise performance</h2>
            <p className="muted small">Comparisons below cover {countLabel(sessions.length, "loaded record")}{next ? "; load earlier sessions for more" : " (all available history)"}. Equipment and measurement variants stay separate.</p>
          </div>
          <details className="disclosure coach-ideas">
            <summary><IconSparkles size={20} stroke={1.75} className="text-accent-text" aria-hidden="true" />Coach's training ideas</summary>
            <div className="disclosure-body">
              <p className="muted small">Optional AI advice. Actual next-session targets appear in your workout with their source and rule.</p>
              <button type="button" className="btn btn--secondary" disabled={busy} onClick={advice}>Ask for training ideas</button>
              {suggestions?.length > 0 && <ul className="ledger">{suggestions.map((s, i) => <li key={i} className="ledger-row idea"><div className="ledger-main"><p className="ledger-title">{s.exercise}</p><p className="ledger-meta">{s.suggestion}</p></div></li>)}</ul>}
              {suggestions?.length === 0 && <p className="muted small">No coaching ideas available yet.</p>}
            </div>
          </details>
          {groups.size > 0 && <ul className="perf-list">{[...groups.entries()].map(([key, group]) => <li key={key}>
            <details className="perf">
              <summary>
                <span className="perf-head"><span className="perf-name">{group.name}</span><span className="sr-only"> · </span><span className="perf-count">{countLabel(group.entries.length, "record")} loaded</span></span>
                <span className="perf-latest num">{formatSets(group.entries[0].sets_data, group.entries[0].measurement)}</span>
              </summary>
              <ul className="perf-entries">{group.entries.map((e, i) => <li key={i}>
                <Link className="link" to={`/sessions/${e.sessionId}`}>{e.date}</Link>
                <span className="tag">{e.load_basis.replace("_", " ")}</span>
                <span className="perf-sets num">{formatSets(e.sets_data, e.measurement)}</span>
              </li>)}</ul>
            </details>
          </li>)}</ul>}
        </section>

        <section className="stack" aria-labelledby="history-heading">
          <h2 id="history-heading" className="section-title">Session history</h2>
          {sessions.length > 0 && <ul className="ledger">{sessions.map(s => <li key={s.id}>
            <Link className="ledger-row history-row" to={`/sessions/${s.id}`}>
              <span className="date-chip" aria-hidden="true"><span className="num">{new Date(`${s.session_date}T00:00:00`).getDate()}</span>{new Date(`${s.session_date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}</span>
              <span className="ledger-main">
                <span className="ledger-title">{s.workout_snapshot?.day?.day || "Training record"} · {s.session_date}</span>
                <span className="ledger-meta">{countLabel(s.exercise_logs.length, "exercise")} · {s.status === "completed" ? "Completed" : "Legacy record — completion unverified"}</span>
              </span>
              <IconChevronRight size={18} stroke={1.75} className="ledger-end" aria-hidden="true" />
            </Link>
          </li>)}</ul>}
          {next && <button type="button" className="btn btn--secondary" disabled={busy} onClick={more}>Load earlier sessions</button>}
        </section>
      </div>
    </>}
  </Layout>;
}
