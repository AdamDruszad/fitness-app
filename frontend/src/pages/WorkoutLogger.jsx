import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import ExerciseArtwork from "../components/ExerciseArtwork";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import client from "../api/client";
import { prepareWorkoutEntries, createWorkoutSaver, getNextTrainingDay } from "../utils/workout";
import { IconBarbell, IconPlus, IconTrash, IconCheck, IconClock, IconArrowLeft, IconAlertTriangle } from "@tabler/icons-react";

export default function WorkoutLogger() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedDay = typeof location.state?.day === "string" ? location.state.day : location.state?.day?.day;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [activeDay, setActiveDay] = useState(null);
  const [logs, setLogs] = useState({});
  const [saving, setSaving] = useState(false);
  const [outcomes, setOutcomes] = useState({});
  const [validation, setValidation] = useState({});
  const saver = useRef(null);
  const savingRef = useRef(false);
  const inputRefs = useRef({});
  const pendingFocus = useRef(null);
  if (!saver.current) saver.current = createWorkoutSaver(client);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    client.get("/plans/current", { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setPlan(data);
      const days = data?.plan_data?.days || [];
      const initialDay = days.find(day => day.day === requestedDay) || getNextTrainingDay(days) || days[0];
      setActiveDay(initialDay?.day || null);
      setLogs(previous => {
        const next = { ...previous };
        days.forEach(day => {
          const dayLogs = { ...(next[day.day] || {}) };
          (day.exercises || []).forEach(exercise => {
            const name = exercise.name || exercise.exercise;
            if (!dayLogs[name]) dayLogs[name] = [{ weight: "", reps: "" }];
          });
          next[day.day] = dayLogs;
        });
        return next;
      });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error.response?.status === 404) setPlan(null);
      else setLoadError("Could not load your plan. Check your connection and try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestedDay, reload]);

  useEffect(() => {
    const input = inputRefs.current[pendingFocus.current];
    if (input) {
      input.focus({ preventScroll: true });
      input.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
      pendingFocus.current = null;
    }
  }, [logs]);

  const days = plan?.plan_data?.days || [];
  const currentDay = days.find(day => day.day === activeDay);
  const exercises = currentDay?.exercises || [];
  const dayLogs = logs[activeDay] || {};
  const outcome = outcomes[activeDay] || { saved: [], failed: [], complete: false, error: "" };
  const prepared = prepareWorkoutEntries(dayLogs);
  const enteredSets = Object.values(dayLogs).flat().filter(set => set.weight !== "" || set.reps !== "").length;
  const completedSets = prepared.entries.reduce((total, entry) => total + entry.sets.length, 0);
  const canSave = !saving && !outcome.complete && (enteredSets > 0 || outcome.saved.length > 0);

  function updateSets(name, update) {
    if (savingRef.current || outcome.saved.includes(name) || outcome.complete) return;
    setLogs(previous => ({ ...previous, [activeDay]: { ...previous[activeDay], [name]: update(previous[activeDay]?.[name] || []) } }));
  }
  function addSet(name) {
    pendingFocus.current = `${activeDay}:${name}:${dayLogs[name]?.length || 0}`;
    updateSets(name, sets => [...sets, { weight: "", reps: "" }]);
  }
  function removeSet(name, index) {
    updateSets(name, sets => sets.filter((_, i) => i !== index));
  }
  async function handleSave() {
    if (!canSave || savingRef.current) return;
    setValidation(previous => ({ ...previous, [activeDay]: true }));
    if (prepared.errors.length) return;
    if (!prepared.entries.length) return;
    const day = activeDay;
    savingRef.current = true;
    setSaving(true);
    setOutcomes(previous => ({ ...previous, [day]: { ...outcome, error: "" } }));
    try {
      const result = await saver.current.save(day, prepared.entries);
      setOutcomes(previous => ({ ...previous, [day]: { ...result, complete: result.failed.length === 0, error: result.failed.length ? `Still to save: ${result.failed.join(", ")}. Your saved exercises are safe; retry will only send the remaining ones.` : "" } }));
    } catch {
      setOutcomes(previous => ({ ...previous, [day]: { ...outcome, error: "Could not create the session. Your entries are still here. Please try again." } }));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <Layout>
    <Link to="/" className="workout-back"><IconArrowLeft size={15} aria-hidden="true" />Back to your plan</Link>
    <PageHeading eyebrow="Make every set count" title="Log workout" description="Your plan, your pace. Record what you complete." />
    {loading ? <div className="workout-empty" role="status"><IconBarbell size={32} aria-hidden="true" /><p>Loading your workout…</p></div>
      : loadError ? <div className="workout-empty"><p role="alert">{loadError}</p><button type="button" className="fitai-secondary-button" onClick={() => setReload(value => value + 1)}>Try again</button></div>
      : !plan || !days.length ? <div className="workout-empty"><IconBarbell size={36} aria-hidden="true" /><h2>Your first session starts with a plan.</h2><p>Set your preferences to build a workout around you.</p><button className="fitai-primary-button" type="button" onClick={() => navigate("/onboarding")}>Create your plan</button></div>
      : <>
        <div className="workout-days" role="group" aria-label="Workout day">{days.map(day => <button type="button" key={day.day} disabled={saving} aria-pressed={day.day === activeDay} onClick={() => setActiveDay(day.day)}>{day.day}<span>{day.exercises?.length || 0} exercises</span></button>)}</div>
        <div className="workout-summary"><div><span className="eyebrow">{activeDay} / Your session</span><h2>{currentDay?.focus}</h2><p>{exercises.length} exercises<span>•</span>Leave weight blank for bodyweight (0 kg).</p></div><div className="session-count"><strong>{completedSets}</strong><span>sets entered</span></div></div>
        {!exercises.length && <div className="workout-empty"><h2>A day to recharge.</h2><p>No exercises scheduled for {activeDay}. Choose another training day above.</p></div>}
        <div className="exercise-list">{exercises.map((exercise, exerciseIndex) => {
          const name = exercise.name || exercise.exercise;
          const sets = dayLogs[name] || [];
          const isSaved = outcome.saved.includes(name);
          const locked = saving || isSaved || outcome.complete;
          const rest = exercise.rest_seconds;
          return <article className={`exercise-card${isSaved ? " is-saved" : ""}`} key={name} aria-labelledby={`exercise-${exerciseIndex}`}>
            <div className="exercise-heading">
              <ExerciseArtwork name={name} />
              <div className="exercise-heading-copy"><span className="exercise-index">EXERCISE {String(exerciseIndex + 1).padStart(2, "0")}</span><h3 id={`exercise-${exerciseIndex}`}>{name}</h3><div className="exercise-prescription">{exercise.sets && exercise.reps && <span>{exercise.sets} sets <b>×</b> {exercise.reps}</span>}{Number.isFinite(Number(rest)) && Number(rest) > 0 && <span><IconClock size={14} aria-hidden="true" />{rest}s rest</span>}</div></div>
              {isSaved && <span className="exercise-saved"><IconCheck size={16} aria-hidden="true" />Saved</span>}
            </div>
            <div className="exercise-entry"><div className="set-grid set-labels" aria-hidden="true"><span>Set</span><span>Weight / kg</span><span>Reps</span><span /></div>
              {sets.map((set, index) => <div className="set-grid" key={index}><span className="set-number">{String(index + 1).padStart(2, "0")}</span>
                <input type="number" min="0" step="0.5" inputMode="decimal" placeholder="0" disabled={locked} aria-label={`${name}, set ${index + 1}, weight in kilograms`} ref={element => { inputRefs.current[`${activeDay}:${name}:${index}`] = element; }} value={set.weight} onChange={event => updateSets(name, rows => rows.map((row, i) => i === index ? { ...row, weight: event.target.value } : row))} />
                <input type="number" min="1" step="1" inputMode="numeric" placeholder="—" disabled={locked} aria-label={`${name}, set ${index + 1}, repetitions`} value={set.reps} onChange={event => updateSets(name, rows => rows.map((row, i) => i === index ? { ...row, reps: event.target.value } : row))} />
                <button type="button" disabled={locked} className="remove-set" onClick={() => removeSet(name, index)} aria-label={`Remove ${name} set ${index + 1}`}><IconTrash size={16} aria-hidden="true" /></button>
              </div>)}
              {!locked && <button className="add-set" type="button" onClick={() => addSet(name)}><IconPlus size={15} aria-hidden="true" />Add set<span className="sr-only"> for {name}</span></button>}
            </div>
          </article>;
        })}</div>
        {validation[activeDay] && prepared.errors.length > 0 && <div className="workout-message workout-message--error" role="alert"><IconAlertTriangle size={19} aria-hidden="true" /><div><strong>Check your entries</strong><ul>{prepared.errors.map(message => <li key={message}>{message}</li>)}</ul></div></div>}
        {outcome.error && <div className="workout-message workout-message--error" role="alert"><IconAlertTriangle size={19} aria-hidden="true" /><p>{outcome.error}</p></div>}
        {exercises.length > 0 && <div className="workout-savebar">
          {outcome.complete ? <><p role="status"><IconCheck size={18} aria-hidden="true" /><strong>Session saved.</strong> Nice work.</p><Link to="/" className="fitai-secondary-button">Back to your plan</Link></> : <><p>{completedSets} sets across {prepared.entries.length} exercises<span>Empty rows are skipped.</span></p><button type="button" className="fitai-primary-button" onClick={handleSave} disabled={!canSave}>{saving ? "Saving session…" : outcome.failed.length ? "Retry remaining exercises" : "Save session"}{!saving && <IconCheck size={17} aria-hidden="true" />}</button></>}
        </div>}
      </>}
  </Layout>;
}

