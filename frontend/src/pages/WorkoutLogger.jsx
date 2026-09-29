import Layout from "../components/Layout";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import client from "../api/client";
import {
  IconBarbell,
  IconPlus,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";

export default function WorkoutLogger() {
  const location = useLocation();
  const navigate = useNavigate();

  const [plan, setPlan] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(null);
  // logs: { [dayName]: { [exerciseName]: [ {weight: '', reps: ''}, ... ] } }
  const [logs, setLogs] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Ref for auto-scrolling to newly added set
  const lastSetRef = useRef(null);

  // Fetch plan — same 404-vs-real-error pattern as Dashboard
  useEffect(() => {
    setLoading(true);
    client
      .get("/plans/current")
      .then((r) => {
        const p = r.data;
        setPlan(p);

        // Determine initial active day:
        // 1. location.state.day from Dashboard (if present)
        // 2. today's weekday name if it matches a plan day
        // 3. first plan day as fallback
        const stateDay = location.state?.day;
        const todayName = new Date().toLocaleDateString("en-US", {
          weekday: "long",
        });
        const days = p?.plan_data?.days || [];
        const match =
          days.find((d) => d.day === stateDay) ||
          days.find((d) => d.day === todayName) ||
          days[0];
        if (match) {
          setActiveDay(match.day);
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setPlan(null);
        } else {
          setError("Could not load your plan");
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const days = plan?.plan_data?.days || [];
  const currentDay = days.find((d) => d.day === activeDay);
  const exercises = currentDay?.exercises || [];

  // Initialize logs for active day (empty sets for exercises not yet touched)
  useEffect(() => {
    if (!activeDay || exercises.length === 0) return;
    setLogs((prev) => {
      const dayLogs = prev[activeDay] || {};
      let changed = false;
      const updated = { ...dayLogs };
      exercises.forEach((ex) => {
        const name = ex.name || ex.exercise;
        if (!updated[name]) {
          updated[name] = [{ weight: "", reps: "" }];
          changed = true;
        }
      });
      if (!changed) return prev;
      return { ...prev, [activeDay]: updated };
    });
  }, [activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll last added set into view
  useEffect(() => {
    if (lastSetRef.current) {
      lastSetRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      lastSetRef.current = null;
    }
  }, [logs]);

  function updateSet(exerciseName, setIndex, field, value) {
    setLogs((prev) => {
      const dayLogs = { ...(prev[activeDay] || {}) };
      const sets = [...(dayLogs[exerciseName] || [])];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      dayLogs[exerciseName] = sets;
      return { ...prev, [activeDay]: dayLogs };
    });
  }

  function addSet(exerciseName) {
    setLogs((prev) => {
      const dayLogs = { ...(prev[activeDay] || {}) };
      dayLogs[exerciseName] = [
        ...(dayLogs[exerciseName] || []),
        { weight: "", reps: "" },
      ];
      return { ...prev, [activeDay]: dayLogs };
    });
  }

  function removeSet(exerciseName, setIndex) {
    setLogs((prev) => {
      const dayLogs = { ...(prev[activeDay] || {}) };
      const sets = [...(dayLogs[exerciseName] || [])];
      sets.splice(setIndex, 1);
      dayLogs[exerciseName] = sets;
      return { ...prev, [activeDay]: dayLogs };
    });
  }

  // Check if there's data to save for the ACTIVE day only
  const activeDayLogs = logs[activeDay] || {};
  const hasData = Object.values(activeDayLogs).some((sets) =>
    sets.some((s) => s.weight !== "" && s.reps !== "")
  );

  async function handleSave() {
    if (!hasData || saving) return;

    setSaving(true);
    setSaveError("");

    try {
      // Step 1: Create the session
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const sessionRes = await client.post("/sessions", {
        session_date: today,
      });
      const sessionId = sessionRes.data.id;

      // Step 2: Build exercise log requests scoped to activeDay only
      const entries = Object.entries(activeDayLogs)
        .map(([exerciseName, sets]) => {
          const validSets = sets
            .filter((s) => s.weight !== "" && s.reps !== "")
            .map((s) => ({
              weight: parseFloat(s.weight),
              reps: parseInt(s.reps, 10),
            }))
            // Filter out any NaN values that could cause 422 on the backend
            .filter((s) => !Number.isNaN(s.weight) && !Number.isNaN(s.reps));

          if (validSets.length === 0) return null;

          return {
            exerciseName,
            promise: client.post(`/sessions/${sessionId}/logs`, {
              exercise_name: exerciseName,
              sets_data: validSets,
            }),
          };
        })
        .filter(Boolean);

      // Step 3: Use allSettled so partial failures don't swallow successes
      const results = await Promise.allSettled(
        entries.map((e) => e.promise)
      );

      const failed = entries
        .filter((_, i) => results[i].status === "rejected")
        .map((e) => e.exerciseName);

      if (failed.length === 0 && entries.length > 0) {
        setSaved(true);
        setTimeout(() => navigate("/"), 1500);
      } else if (entries.length === 0) {
        // NaN filtering removed all sets — nothing was actually sent
        setSaveError("No valid data to save. Check your numbers and try again.");
      } else if (failed.length === entries.length) {
        setSaveError("Failed to save any exercises. Please try again.");
      } else {
        const savedCount = entries.length - failed.length;
        setSaveError(
          `${savedCount}/${entries.length} exercises saved. Failed: ${failed.join(", ")}.`
        );
      }
    } catch {
      // Session creation itself failed
      setSaveError("Could not create session. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Switch day — logs are preserved per-day, no wipe needed
  function switchDay(dayName) {
    if (dayName === activeDay) return;
    setActiveDay(dayName);
    setSaved(false);
    setSaveError("");
  }

  return (
    <Layout>
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-bold text-text-main">Log workout</h1>

        {error ? (
          <p className="px-4 py-2 flex justify-center items-center text-red-400 text-sm -mt-1 border border-red-400 rounded-md shadow-xl/50 shadow-red-400/40">
            {error}
          </p>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 bg-brand-accent/10 rounded-full animate-pulse">
              <IconBarbell
                className="text-brand-accent"
                size={32}
                stroke={1.5}
              />
            </div>
            <p className="text-text-muted text-sm font-medium animate-pulse">
              Loading your plan...
            </p>
          </div>
        ) : plan === null ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <IconAlertTriangle
              className="text-text-muted"
              size={32}
              stroke={1.5}
            />
            <p className="text-text-muted text-sm">
              You need a workout plan first.
            </p>
            <button
              className="border border-border-subtle bg-brand-accent rounded-lg py-2 px-4 font-medium text-text-main hover:bg-brand-accent/50 transition"
              type="button"
              onClick={() => navigate("/onboarding")}
            >
              Generate a Plan
            </button>
          </div>
        ) : (
          <>
            {/* Day tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {days.map((d) => {
                const isActive = d.day === activeDay;
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => switchDay(d.day)}
                    className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-brand-accent text-white"
                        : "bg-surface/70 border border-border-subtle text-text-muted hover:text-text-main hover:border-text-muted/30"
                    }`}
                  >
                    {d.day.slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {/* Day focus header */}
            {currentDay && (
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-text-main">
                    {currentDay.focus}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    {exercises.length} exercises &middot; {activeDay}
                  </p>
                </div>
              </div>
            )}

            {/* Exercise cards */}
            <div className="flex flex-col gap-4">
              {exercises.map((ex) => {
                const name = ex.name || ex.exercise;
                const sets = activeDayLogs[name] || [];

                return (
                  <div
                    key={name}
                    className="bg-surface/70 border border-border-subtle rounded-xl overflow-hidden"
                  >
                    {/* Exercise header */}
                    <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <IconBarbell
                          className="text-brand-accent"
                          size={18}
                          stroke={1.5}
                        />
                        <span className="text-sm font-semibold text-text-main">
                          {name}
                        </span>
                      </div>
                      {ex.sets && ex.reps && (
                        <span className="text-xs text-text-muted">
                          Target: {ex.sets}&times;{ex.reps}
                        </span>
                      )}
                    </div>

                    {/* Sets table */}
                    <div className="px-4 py-3">
                      {/* Column headers */}
                      <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 mb-2">
                        <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
                          Set
                        </span>
                        <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
                          kg
                        </span>
                        <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
                          Reps
                        </span>
                        <span />
                      </div>

                      {/* Set rows */}
                      {sets.map((s, idx) => (
                        <div
                          key={idx}
                          ref={idx === sets.length - 1 ? lastSetRef : null}
                          className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 mb-2 items-center"
                        >
                          <span className="text-xs text-text-muted font-medium text-center">
                            {idx + 1}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="0"
                            value={s.weight}
                            onChange={(e) =>
                              updateSet(name, idx, "weight", e.target.value)
                            }
                            className="bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-brand-accent/50 transition"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={s.reps}
                            onChange={(e) =>
                              updateSet(name, idx, "reps", e.target.value)
                            }
                            className="bg-input border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-main placeholder:text-text-muted/40 focus:outline-none focus:border-brand-accent/50 transition"
                          />
                          <button
                            type="button"
                            onClick={() => removeSet(name, idx)}
                            className="flex items-center justify-center text-text-muted hover:text-red-400 transition cursor-pointer"
                            aria-label={`Remove set ${idx + 1}`}
                          >
                            <IconTrash size={15} stroke={1.5} />
                          </button>
                        </div>
                      ))}

                      {/* Add set button */}
                      <button
                        type="button"
                        onClick={() => addSet(name)}
                        className="flex items-center gap-1.5 text-xs text-brand-accent font-medium mt-1 hover:text-brand-accent/70 transition cursor-pointer"
                      >
                        <IconPlus size={14} stroke={2} />
                        Add set
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save section */}
            {saveError && (
              <p className="px-4 py-2 flex justify-center items-center text-red-400 text-sm border border-red-400 rounded-md shadow-xl/50 shadow-red-400/40">
                {saveError}
              </p>
            )}

            {saved ? (
              <div className="flex items-center justify-center gap-2 py-3.5 px-4 text-[15px] font-bold text-green-400 rounded-xl bg-green-400/10 border border-green-400/30">
                <IconCheck size={20} />
                Session saved!
              </div>
            ) : (
              <button
                type="button"
                disabled={!hasData || saving}
                onClick={handleSave}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 active:scale-[0.98] transition text-[15px] font-bold rounded-xl cursor-pointer ${
                  hasData && !saving
                    ? "text-white bg-brand-accent hover:bg-brand-accent/90"
                    : "text-text-muted/50 bg-surface/50 border border-border-subtle cursor-not-allowed"
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save session"
                )}
              </button>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}