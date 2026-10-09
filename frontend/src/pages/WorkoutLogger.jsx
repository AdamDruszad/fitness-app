import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import ExerciseArtwork from "../components/ExerciseArtwork";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { readToken } from "../api/token";
import { actualSet, completionPayload, formatSets, loadDraft, newDraft, saveDraft } from "../utils/drafts";
import { apiError, prescription, comparableImprovement } from "../utils/plans";

export default function WorkoutLogger() {
  const { user } = useAuth();
  const location = useLocation();
  const [plan, setPlan] = useState(null);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [nextTargets, setNextTargets] = useState({});
  const [undo, setUndo] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const revision = useRef(0);
  const current = useRef(null);
  const queue = useRef(Promise.resolve());
  const blocked = useRef(false);
  const alive = useRef(true);
  const operation = useRef(false);
  const ownerToken = useRef(readToken());
  const owner = user.id;
  const occurrence = draft?.occurrence_id;
  const incrementsKey = JSON.stringify(draft?.increments || {});

  useEffect(() => {
    alive.current = true;
    const c = new AbortController();
    loadDraft(owner).then(record => {
      if (c.signal.aborted) return;
      revision.current = record.revision; current.current = record.draft; setDraft(record.draft);
      setStatus(record.draft?.pending ? "Waiting to sync" : record.draft ? "Saved on this device" : "");
    }).catch(e => { if (!c.signal.aborted) { blocked.current = true; setStorageError(e.message); } }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    client.get("/plans/current", { signal: c.signal }).then(r => setPlan(r.data)).catch(e => { if (!c.signal.aborted && e.response?.status !== 404) setError(apiError(e)); });
    return () => { alive.current = false; c.abort(); };
  }, [owner]);

  useEffect(() => {
    if (!occurrence) return;
    const c = new AbortController();
    const d = current.current;
    client.post("/sessions/previous", { plan_id: d.plan_id, day_id: d.day.id, increments: JSON.parse(incrementsKey) }, { signal: c.signal })
      .then(r => { if (!c.signal.aborted) setHistory(r.data); })
      .catch(e => { if (!c.signal.aborted) setError(`Previous performance unavailable. ${apiError(e)}`); });
    return () => c.abort();
  }, [occurrence, incrementsKey]);

  function persist(next) {
    current.current = next; setDraft(next); setStatus("Saving on this device…");
    const work = queue.current.then(async () => {
      if (blocked.current) throw new Error("Reload the saved draft to resolve the storage conflict.");
      const result = await saveDraft(owner, revision.current, next);
      revision.current = result;
      if (alive.current && current.current === next) setStatus(next?.pending ? "Waiting to sync" : "Saved on this device");
    });
    queue.current = work.catch(e => { blocked.current = true; if (alive.current) { setStorageError(e.message); setStatus("Not saved on this device"); } });
    return work;
  }
  function change(update) {
    if (operation.current || current.current?.pending || blocked.current) return;
    setError(""); persist(update(current.current)).catch(() => {});
  }
  function updateRow(ex, index, update) {
    change(d => ({ ...d, rows: { ...d.rows, [ex.id]: d.rows[ex.id].map((r, i) => i === index ? update(r) : r) } }));
  }
  function toggle(ex, index) {
    try { const row = draft.rows[ex.id][index]; if (!row.done) actualSet(row, ex); updateRow(ex, index, r => ({ ...r, done: !r.done })); }
    catch (e) { setError(e.message); }
  }
  function fill(ex, previous = false) {
    const record = history[ex.id];
    const target = record?.target;
    change(d => ({ ...d, targets: { ...d.targets, [ex.id]: previous ? { rule: "copy-previous", source_session_id: record.previous.session_id, reason: "Explicitly copied previous performance" } : target },
      rows: { ...d.rows, [ex.id]: d.rows[ex.id].map((r, i) => {
        if (r.done) return r;
        const value = previous ? record.previous.sets[i] : target;
        return value ? { ...r, weight: value.weight ?? "", reps: value.reps ?? "", duration_seconds: value.duration_seconds ?? "" } : r;
      }) } }));
  }
  async function finish() {
    if (operation.current || blocked.current || readToken() !== ownerToken.current) return;
    operation.current = true; setBusy(true); setError("");
    try {
      const d = current.current;
      const payload = d.pending || completionPayload(d);
      if (!d.pending) await persist({ ...d, pending: payload });
      await queue.current;
      if (!alive.current || readToken() !== ownerToken.current) return;
      setStatus("Saving workout…");
      // Identical payload and occurrence ID resolve even a committed, lost response.
      const { data } = await client.post("/sessions/complete", payload);
      if (!alive.current) return;
      setSaved(data); setStatus("Workout saved");
      await persist(null); setStatus("Workout saved");
      client.post("/sessions/previous", { plan_id: d.plan_id, day_id: d.day.id, increments: d.increments }).then(r => { if (alive.current) setNextTargets(r.data); }).catch(() => {});
    } catch (e) { if (alive.current) { setError(e.response ? apiError(e) : e.message); setStatus(current.current?.pending ? "Waiting to sync — retry with the same workout" : "Saved on this device"); } }
    finally { operation.current = false; if (alive.current) setBusy(false); }
  }
  async function resolvePending() {
    if (busy) return;
    setBusy(true); setError("");
    try { const { data } = await client.get(`/sessions/occurrences/${draft.occurrence_id}`); setSaved(data); await persist(null); setStatus("Workout saved"); }
    catch (e) { if (e.response?.status === 404) { await persist({ ...draft, pending: null }); } else setError(apiError(e)); }
    finally { setBusy(false); }
  }
  async function reloadDraft() {
    try { await queue.current; const record = await loadDraft(owner); revision.current = record.revision; current.current = record.draft; setDraft(record.draft); blocked.current = false; setStorageError(""); setStatus(record.draft?.pending ? "Waiting to sync" : "Saved on this device"); }
    catch (e) { setStorageError(e.message); }
  }
  const count = draft ? Object.values(draft.rows).flat().filter(r => r.done).length : 0;
  const locked = busy || !!draft?.pending || !!storageError;
  return <Layout><Link className="text-link" to="/">Back to my plan</Link><PageHeading eyebrow="Make every set count" title={draft?.day.day || "Workout"} description={draft ? `${draft.title} · Version ${draft.version} · ${draft.session_date}` : "Choose a workout. Your session keeps the plan version it starts with."} />
    <p role="status">{status}</p>
    {error && <p className="continuity-error" role="alert">{error}</p>}
    {storageError && <div className="continuity-error" role="alert"><p>{storageError}</p><button className="fitai-secondary-button" onClick={reloadDraft}>Reload saved draft</button></div>}
    {loading ? <p role="status">Recovering your workout…</p> : saved ? <section className="continuity-card"><h2>Workout saved</h2><p>{saved.exercise_logs.reduce((n, e) => n + e.sets_data.length, 0)} completed sets · {saved.exercise_logs.length} exercises</p><p>Session recorded. You now have a reference for next time.</p>{saved.exercise_logs.map(log => { const improvement = comparableImprovement(log, history[log.slot_id]?.previous); return improvement ? <p key={log.id}>{improvement}</p> : null; })}{Object.entries(nextTargets).slice(0, 2).map(([id, result]) => <p key={id}><strong>Next time · {saved.exercise_logs.find(l => l.slot_id === id)?.exercise_name}</strong><br />{result.target.reason}</p>)}<Link className="fitai-primary-button" to={`/sessions/${saved.id}`}>View saved session</Link><Link className="text-link" to="/">Back to my plan</Link></section> : !draft ? <>
      {!plan && <p>Choose a plan first. <Link to="/coach">Improve my routine with Coach</Link></p>}
      <div className="workout-days">{plan?.plan_data.days.filter(d => d.exercises.length).map(d => <button key={d.id} type="button" disabled={!!storageError} onClick={() => persist(newDraft(plan, d, owner)).catch(() => {})}>{d.day}<span>{d.focus}{location.state?.day === d.day ? " · Selected from your plan" : ""}</span></button>)}</div>
    </> : <>
      {plan && plan.id !== draft.plan_id && <p>This session uses an earlier plan version. Your entries stay with this workout.</p>}
      <p>{count} completed sets. Copying a target never marks a set done.</p>
      {draft.day.exercises.map((ex, ei) => { const last = history[ex.id]?.previous; const target = history[ex.id]?.target; return <article className="exercise-card" key={ex.id}>
        <div className="exercise-heading"><ExerciseArtwork name={ex.name} /><div className="exercise-heading-copy"><h2>{ex.name}</h2><p>{prescription(ex)}</p><p>Load: {ex.load_basis.replace("_", " ")}</p></div></div>
        <div className="exercise-entry">
          <p><strong>Last time{last ? ` · ${last.date}` : ""}</strong><br />{last ? formatSets(last.sets, ex.measurement) : "No comparable completed record yet."}</p>
          {last && <button className="text-link" disabled={locked} onClick={() => fill(ex, true)}>Use previous values</button>}
          {target && <details className="continuity-card"><summary>Next target{target.reps || target.duration_seconds ? ` · ${formatSets([target], ex.measurement)}` : " · Establish a baseline"}</summary><p>{target.reason}</p>
            <label>Optional available load increment (kg)<input disabled={locked} type="number" min="0" max="100" step="0.25" value={draft.increments[ex.id] || ""} onChange={e => change(d => ({ ...d, increments: { ...d.increments, [ex.id]: Number(e.target.value) } }))} /></label>
            {(target.reps || target.duration_seconds) && <button className="fitai-secondary-button" disabled={locked} onClick={() => fill(ex)}>Use target values</button>}
          </details>}
          {ex.measurement === "legacy" && <p className="continuity-error">Original prescription: {ex.reps}. Clarify its measurement in a plan draft before logging this exercise.</p>}
          <div className="actual-set-labels" aria-hidden="true"><span>Set</span><span>Actual kg</span><span>{ex.measurement === "duration" ? "Seconds" : "Reps"}</span><span>Done</span></div>
          {draft.rows[ex.id].map((r, i) => <div className="actual-set" key={i}>
            <span>{i + 1}</span><input aria-label={`${ex.name}, set ${i + 1}, kg${ex.load_basis === "per_hand" ? " per dumbbell" : ""}`} type="number" min="0" max="2000" step="any" inputMode="decimal" disabled={locked || r.done || ex.load_basis === "bodyweight"} value={r.weight} placeholder={ex.load_basis === "bodyweight" ? "—" : "kg"} onChange={e => updateRow(ex, i, row => ({ ...row, weight: e.target.value }))} />
            <input aria-label={`${ex.name}, set ${i + 1}, ${ex.measurement === "duration" ? "seconds" : "repetitions"}`} type="number" min="1" step="1" inputMode="numeric" disabled={locked || r.done} value={ex.measurement === "duration" ? r.duration_seconds : r.reps} onChange={e => updateRow(ex, i, row => ({ ...row, [ex.measurement === "duration" ? "duration_seconds" : "reps"]: e.target.value }))} />
            <button className="fitai-secondary-button" aria-label={`${r.done ? "Undo" : "Complete"} ${ex.name} set ${i + 1}`} aria-pressed={r.done} disabled={locked || ex.measurement === "legacy"} onClick={() => toggle(ex, i)}>{r.done ? "✓" : "Done"}</button>
            <button className="text-link" aria-label={`Remove ${ex.name} set ${i + 1}`} disabled={locked} onClick={() => { setUndo(structuredClone(draft)); change(d => ({ ...d, rows: { ...d.rows, [ex.id]: d.rows[ex.id].filter((_, ri) => ri !== i) } })); }}>Remove</button>
          </div>)}
          <button className="add-set" disabled={locked || draft.rows[ex.id].length >= 100} onClick={() => change(d => ({ ...d, rows: { ...d.rows, [ex.id]: [...d.rows[ex.id], { weight: "", reps: "", duration_seconds: "", done: false }] } }))}>Add set</button>
          <label className="session-note" htmlFor={`note-${ei}`}>Optional note (difficulty or target adjustment)<input id={`note-${ei}`} maxLength={2000} disabled={locked} value={draft.notes[ex.id] || ""} onChange={e => change(d => ({ ...d, notes: { ...d.notes, [ex.id]: e.target.value } }))} /></label>
        </div>
      </article>; })}
      {undo && <button className="fitai-secondary-button" disabled={locked} onClick={() => { change(() => undo); setUndo(null); }}>Undo last row removal (restores previous entries)</button>}
      <div className="workout-savebar"><p>{count} completed sets<span>Confirm entered rows before finishing.</span></p><button className="fitai-primary-button" disabled={busy || !count || !!storageError} onClick={finish}>{busy ? "Saving…" : draft.pending ? "Retry workout save" : "Finish workout"}</button></div>
      {draft.pending ? <button className="text-link" disabled={busy} onClick={resolvePending}>Check save status before editing</button> : <><button className="text-link" disabled={locked} onClick={() => setConfirmDiscard(true)}>Discard this draft</button>{confirmDiscard && <div className="continuity-card"><p>Remove this device's unfinished workout and its entered sets?</p><button className="fitai-secondary-button" onClick={() => { persist(null).catch(() => {}); setConfirmDiscard(false); }}>Discard entered workout</button><button className="text-link" onClick={() => setConfirmDiscard(false)}>Keep training</button></div>}</>}
    </>}
  </Layout>;
}
