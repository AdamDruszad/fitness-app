import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { IconCheck, IconX, IconPlus, IconArrowBackUp, IconCircleCheck, IconTrendingUp, IconPlayerPlayFilled, IconTarget, IconCopy } from "@tabler/icons-react";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import ExerciseArtwork from "../components/ExerciseArtwork";
import { BackLink, Notice, LoadingLine } from "../components/ui";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { readToken } from "../api/token";
import { actualSet, completionPayload, formatSets, loadDraft, newDraft, saveDraft } from "../utils/drafts";
import { apiError, prescription, comparableImprovement } from "../utils/plans";
import { countLabel } from "../utils/format";

const statusTone = status => /Saved on this device|Workout saved/.test(status) ? "ok" : /Not saved|Waiting/.test(status) ? "warn" : "busy";

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
  const total = draft ? Object.values(draft.rows).flat().length : 0;
  const locked = busy || !!draft?.pending || !!storageError;
  const selectedDay = location.state?.day;
  const trainingDays = plan?.plan_data.days.filter(d => d.exercises.length) || [];

  return <Layout contentClassName="logger">
    <BackLink to="/">Back to my plan</BackLink>
    <PageHeading
      eyebrow="Make every set count"
      title={draft?.day.day || saved?.workout_snapshot?.day?.day || "Workout"}
      description={draft ? `${draft.title} · Version ${draft.version} · ${draft.session_date}` : saved?.workout_snapshot ? `${saved.workout_snapshot.plan_title} · Version ${saved.workout_snapshot.version} · ${saved.session_date}` : "Choose a workout. Your session keeps the plan version it starts with."}
    >
      <p role="status" className={`status-line${saved ? " sr-only" : ""}`}>{status && <><span className={`status-dot status-dot--${statusTone(status)}`} aria-hidden="true" />{status}</>}</p>
    </PageHeading>

    <div className="logger-alerts">
      {error && <Notice tone="error"><p role="alert">{error}</p></Notice>}
      {storageError && <Notice tone="error"><p role="alert">{storageError}</p><button type="button" className="btn btn--secondary btn--sm" onClick={reloadDraft}>Reload saved draft</button></Notice>}
    </div>

    {loading ? <LoadingLine>Recovering your workout…</LoadingLine> : saved ? <section className="card saved" aria-labelledby="saved-title">
      <div className="saved-head">
        <IconCircleCheck size={36} stroke={1.5} className="saved-icon" aria-hidden="true" />
        <h2 id="saved-title" className="display saved-title">Workout saved</h2>
      </div>
      <p className="saved-stats">
        <span><strong className="num">{saved.exercise_logs.reduce((n, e) => n + e.sets_data.length, 0)}</strong> completed sets</span>
        <span aria-hidden="true">·</span>
        <span><strong className="num">{saved.exercise_logs.length}</strong> {saved.exercise_logs.length === 1 ? "exercise" : "exercises"}</span>
      </p>
      <p className="muted">Session recorded. You now have a reference for next time.</p>
      {saved.exercise_logs.some(log => comparableImprovement(log, history[log.slot_id]?.previous)) && <ul className="saved-wins">
        {saved.exercise_logs.map(log => { const improvement = comparableImprovement(log, history[log.slot_id]?.previous); return improvement ? <li key={log.id}><IconTrendingUp size={18} stroke={1.75} aria-hidden="true" />{improvement}</li> : null; })}
      </ul>}
      {saved.exercise_logs.some(log => nextTargets[log.slot_id]?.target) && <section aria-labelledby="next-time-title" className="next-time">
        <h3 id="next-time-title" className="section-title"><IconTarget size={18} stroke={1.75} aria-hidden="true" />Next time</h3>
        <ul className="ledger">{saved.exercise_logs.filter(log => nextTargets[log.slot_id]?.target).map(log => { const target = nextTargets[log.slot_id].target; return <li key={log.id} className="ledger-row next-time-row">
          <div className="ledger-main">
            <p className="ledger-title"><span className="sr-only">Next time · </span>{log.exercise_name}{(target.reps || target.duration_seconds) && <span className="num next-time-dose">{formatSets([target], log.measurement)}</span>}</p>
            <p className="ledger-meta">{target.reason}</p>
          </div>
        </li>; })}</ul>
      </section>}
      <div className="row">
        <Link className="btn btn--primary" to={`/sessions/${saved.id}`}>View saved session</Link>
        <Link className="btn btn--quiet" to="/">Back to my plan</Link>
      </div>
    </section> : !draft ? <>
      {!plan && <div className="empty"><h2>Choose a plan first.</h2><p><Link className="link" to="/coach">Improve my routine with Coach</Link></p></div>}
      {trainingDays.length > 0 && <div className="day-picker">{trainingDays.map(d => <button key={d.id} type="button" className={`day-option${selectedDay === d.day ? " is-selected" : ""}`} disabled={!!storageError} onClick={() => persist(newDraft(plan, d, owner)).catch(() => {})}>
        <span className="day-option-name display">{d.day}</span>
        <span className="day-option-focus">{d.focus}{selectedDay === d.day ? " · Selected from your plan" : ""}</span>
        <span className="day-option-meta">{countLabel(d.exercises.length, "exercise")}<span className="day-option-go"><IconPlayerPlayFilled size={14} aria-hidden="true" />Start</span></span>
      </button>)}</div>}
    </> : <>
      {plan && plan.id !== draft.plan_id && <Notice tone="warn">This session uses an earlier plan version. Your entries stay with this workout.</Notice>}
      <div className="logger-summary">
        <p className="logger-count"><strong className="num">{count}</strong><span className="muted num">/{total}</span> <span>{count === 1 ? "completed set" : "completed sets"}. Copying a target never marks a set done.</span></p>
        <div className="meter" aria-hidden="true"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
      </div>

      <div className="exercise-stack">{draft.day.exercises.map((ex, ei) => { const last = history[ex.id]?.previous; const target = history[ex.id]?.target; const rows = draft.rows[ex.id]; const doneRows = rows.filter(r => r.done).length; const field = ex.measurement === "duration" ? "duration_seconds" : "reps"; return <article className="exercise card" key={ex.id} aria-labelledby={`exercise-${ei}`}>
        <header className="exercise-head">
          <ExerciseArtwork name={ex.name} className="exercise-thumb" />
          <div className="exercise-head-copy">
            <h2 id={`exercise-${ei}`} className="exercise-name">{ex.name}</h2>
            <p className="exercise-dose">{prescription(ex).split(" · ").map(part => <span key={part}>{part}</span>)}<span>Load: {ex.load_basis.replace("_", " ")}</span></p>
          </div>
          <span className={`exercise-tally num${doneRows && doneRows === rows.length ? " is-complete" : ""}`} aria-label={`${doneRows} of ${rows.length} sets done`}>{doneRows}/{rows.length}</span>
        </header>

        <div className="exercise-ref">
          <div className="exercise-last">
            <p className="exercise-ref-label">Last time{last ? ` · ${last.date}` : ""}</p>
            <p className="exercise-ref-value">{last ? formatSets(last.sets, ex.measurement) : "No comparable completed record yet."}</p>
          </div>
          {last && <button type="button" className="btn btn--ghost btn--sm" disabled={locked} onClick={() => fill(ex, true)}><IconCopy size={16} stroke={1.75} aria-hidden="true" />Use previous values</button>}
        </div>

        {target && <details className="target">
          <summary><IconTarget size={18} stroke={1.75} aria-hidden="true" /><span>Next target{target.reps || target.duration_seconds ? <> · <span className="num">{formatSets([target], ex.measurement)}</span></> : " · Establish a baseline"}</span></summary>
          <div className="target-body">
            <p className="muted">{target.reason}</p>
            <div className="target-actions">
              <label className="field target-increment">
                <span className="field-label">Optional available load increment (kg)</span>
                <input className="input" disabled={locked} type="number" min="0" max="100" step="0.25" value={draft.increments[ex.id] || ""} onChange={e => change(d => ({ ...d, increments: { ...d.increments, [ex.id]: Number(e.target.value) } }))} />
              </label>
              {(target.reps || target.duration_seconds) && <button type="button" className="btn btn--secondary" disabled={locked} onClick={() => fill(ex)}>Use target values</button>}
            </div>
          </div>
        </details>}

        {ex.measurement === "legacy" && <Notice tone="warn">Original prescription: {ex.reps}. Clarify its measurement in a plan draft before logging this exercise.</Notice>}

        <div className="sets">
          <div className="set-row set-labels" aria-hidden="true"><span>Set</span><span>Actual kg</span><span>{ex.measurement === "duration" ? "Seconds" : "Reps"}</span><span>Done</span><span /></div>
          {rows.map((r, i) => <div className={`set-row${r.done ? " is-done" : ""}`} data-set-row key={i}>
            <span className="set-number num">{i + 1}</span>
            <input className="input set-input" aria-label={`${ex.name}, set ${i + 1}, kg${ex.load_basis === "per_hand" ? " per dumbbell" : ""}`} type="number" min="0" max="2000" step="any" inputMode="decimal" disabled={locked || r.done || ex.load_basis === "bodyweight"} value={r.weight} placeholder={ex.load_basis === "bodyweight" ? "—" : "kg"} onChange={e => updateRow(ex, i, row => ({ ...row, weight: e.target.value }))} />
            <input className="input set-input" aria-label={`${ex.name}, set ${i + 1}, ${ex.measurement === "duration" ? "seconds" : "repetitions"}`} type="number" min="1" step="1" inputMode="numeric" disabled={locked || r.done} value={r[field]} placeholder={ex.measurement === "duration" ? "s" : "reps"} onChange={e => updateRow(ex, i, row => ({ ...row, [field]: e.target.value }))} />
            <button type="button" className="set-done" aria-label={`Complete ${ex.name} set ${i + 1}`} aria-pressed={r.done} disabled={locked || ex.measurement === "legacy"} onClick={() => toggle(ex, i)}><IconCheck size={20} stroke={2.25} aria-hidden="true" /></button>
            <button type="button" className="icon-btn set-remove" aria-label={`Remove ${ex.name} set ${i + 1}`} title="Remove set" disabled={locked} onClick={() => { setUndo(structuredClone(draft)); change(d => ({ ...d, rows: { ...d.rows, [ex.id]: d.rows[ex.id].filter((_, ri) => ri !== i) } })); }}><IconX size={18} stroke={1.75} aria-hidden="true" /></button>
          </div>)}
        </div>
        <button type="button" className="btn btn--quiet add-set" disabled={locked || rows.length >= 100} onClick={() => change(d => ({ ...d, rows: { ...d.rows, [ex.id]: [...d.rows[ex.id], { weight: "", reps: "", duration_seconds: "", done: false }] } }))}><IconPlus size={18} stroke={1.75} aria-hidden="true" />Add set</button>
        <label className="field exercise-note" htmlFor={`note-${ei}`}>
          <span className="field-label">Optional note <span className="optional">(difficulty or target adjustment)</span></span>
          <input className="input" id={`note-${ei}`} maxLength={2000} disabled={locked} value={draft.notes[ex.id] || ""} onChange={e => change(d => ({ ...d, notes: { ...d.notes, [ex.id]: e.target.value } }))} />
        </label>
      </article>; })}</div>

      {undo && <button type="button" className="btn btn--secondary undo-remove" disabled={locked} onClick={() => { change(() => undo); setUndo(null); }}><IconArrowBackUp size={18} stroke={1.75} aria-hidden="true" />Undo last row removal (restores previous entries)</button>}

      <div className="action-bar finish-bar">
        <p className="action-bar-text"><strong><span className="num">{count}</span> {count === 1 ? "completed set" : "completed sets"}</strong><span>Confirm entered rows before finishing.</span></p>
        <button type="button" className="btn btn--primary" disabled={busy || !count || !!storageError} onClick={finish}>{busy ? <><span className="spinner" aria-hidden="true" />Saving…</> : draft.pending ? "Retry workout save" : "Finish workout"}</button>
      </div>

      <div className="logger-footer">
        {draft.pending ? <button type="button" className="btn btn--ghost" disabled={busy} onClick={resolvePending}>Check save status before editing</button> : <>
          {!confirmDiscard && <button type="button" className="btn btn--quiet" disabled={locked} onClick={() => setConfirmDiscard(true)}>Discard this draft</button>}
          {confirmDiscard && <Notice tone="warn"><p>Remove this device's unfinished workout and its entered sets?</p><div className="row">
            <button type="button" className="btn btn--danger btn--sm" onClick={() => { persist(null).catch(() => {}); setConfirmDiscard(false); }}>Discard entered workout</button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setConfirmDiscard(false)}>Keep training</button>
          </div></Notice>}
        </>}
      </div>
    </>}
  </Layout>;
}
