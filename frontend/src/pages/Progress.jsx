/**
 * @file Progress.jsx
 * @description Fitness progress and analytics dashboard.
 * Computes workout volume metrics (total workouts, weekly sessions, total exercises logged),
 * queries AI progressive overload recommendations, lists distinct exercises with
 * personal bests (max weight kg, total volume), and displays drill-down chronological
 * performance histories for selected exercises.
 */

import Layout from "../components/Layout";
import { useState, useEffect, useRef } from "react";
import client from "../api/client";
import PageHeading from "../components/PageHeading";
import { Link } from "react-router";
import {
  IconBarbell,
  IconTrendingUp,
  IconLoader2,
  IconMoodEmpty,
  IconCalendar,
  IconChevronDown,
  IconRepeat,
} from "@tabler/icons-react";

export default function Progress() {
  const [sessions, setSessions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseHistory, setExerciseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyRequestRef = useRef(null);

  /**
   * Loads workout sessions and AI progressive overload suggestions on mount.
   */
  useEffect(() => {
    const controller = new AbortController();
    // 1. Fetch all logged workout sessions
    client
      .get("/sessions", { signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) setSessions(r.data); })
      .catch(() => { if (!controller.signal.aborted) setError("Could not load sessions"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    // 2. Fetch AI progressive overload coaching suggestions
    client
      .get("/progress/suggestions", { signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) setSuggestions(r.data.suggestions || []); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setSuggestionsLoading(false); });
    return () => {
      controller.abort();
      historyRequestRef.current?.abort();
    };
  }, []);

  // Compute unique list of all exercises logged across all sessions
  const allExercises = [
    ...new Set(
      sessions.flatMap((s) =>
        (s.exercise_logs || []).map((log) => log.exercise_name)
      )
    ),
  ];

  /**
   * Calculates aggregate stats for a specific exercise across all past sessions.
   * 
   * @param {string} exerciseName - Name of the exercise to analyze.
   * @returns {{ totalSets: number, maxWeight: number, totalReps: number, sessionCount: number }}
   */
  function getExerciseStats(exerciseName) {
    let totalSets = 0;
    let maxWeight = 0;
    let totalReps = 0;
    let sessionCount = 0;

    sessions.forEach((s) => {
      const logs = (s.exercise_logs || []).filter(
        (l) => l.exercise_name === exerciseName
      );
      if (logs.length > 0) sessionCount++;
      logs.forEach((log) => {
        const sets = log.sets_data || [];
        totalSets += sets.length;
        sets.forEach((set) => {
          if (set.weight > maxWeight) maxWeight = set.weight;
          totalReps += set.reps || 0;
        });
      });
    });

    return { totalSets, maxWeight, totalReps, sessionCount };
  }

  /**
   * Fetches chronological set history for a single exercise.
   * Toggles drawer if same exercise is clicked twice.
   * 
   * @param {string} name - Exercise name.
   */
  function loadExerciseHistory(name) {
    historyRequestRef.current?.abort();
    setHistoryError("");
    setExerciseHistory([]);
    if (selectedExercise === name) {
      setSelectedExercise(null);
      setHistoryLoading(false);
      return;
    }
    const controller = new AbortController();
    historyRequestRef.current = controller;
    setSelectedExercise(name);
    setHistoryLoading(true);
    client
      .get(`/progress/exercise/${encodeURIComponent(name)}`, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setExerciseHistory(r.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryError("Could not load this exercise's history. Close and reopen it to try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
  }

  // Top-level summary metric calculations
  const totalSessions = sessions.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const thisWeekSessions = sessions.filter(
    (s) => {
      const date = new Date(`${s.session_date}T00:00:00`);
      return date >= weekStart && date <= today;
    }
  ).length;
  const totalExercisesLogged = sessions.reduce(
    (sum, s) => sum + (s.exercise_logs || []).length,
    0
  );

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <PageHeading eyebrow="Small steps, stronger you" title="Your progress" description="A snapshot of your latest 20 sessions. Open an exercise to explore its history." />

        {error ? (
            <p role="alert" className="px-4 py-2 flex justify-center items-center text-danger-text text-sm border border-danger-text/40 rounded-md">
            {error}
          </p>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <IconLoader2
              className="text-brand-accent animate-spin"
              size={32}
            aria-hidden="true" />
            <p className="text-text-muted text-sm font-medium animate-pulse">
              Loading your progress...
            </p>
          </div>
        ) : sessions.length === 0 ? (
          /* Empty State */
          <div className="bg-surface/40 border border-border-subtle border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
            <IconMoodEmpty
              size={36}
              className="text-text-muted/50"
              stroke={1.5}
            aria-hidden="true" />
            <p className="text-text-muted text-sm">
              No workout data yet. Start logging sessions to track your
              progress!
            </p>
            <Link to="/log" className="fitai-primary-button">Log your first workout</Link>
          </div>
        ) : (
          <>
            {/* Aggregate Volume KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-surface/70 border border-border-subtle rounded-xl p-3.5">
                <div className="text-xs text-text-muted flex flex-wrap items-center gap-1">
                  <IconCalendar size={12} aria-hidden="true" />
                  Recent
                </div>
                <div className="text-2xl font-bold mt-1 text-text-main">
                  {totalSessions}
                </div>
              </div>
              <div className="bg-surface/70 border border-border-subtle rounded-xl p-3.5">
                <div className="text-xs text-text-muted flex flex-wrap items-center gap-1">
                  <IconRepeat size={12} aria-hidden="true" />
                  Last 7 days
                </div>
                <div className="text-2xl font-bold mt-1 text-text-main">
                  {thisWeekSessions}
                </div>
              </div>
              <div className="bg-surface/70 border border-border-subtle rounded-xl p-3.5">
                <div className="text-xs text-text-muted flex flex-wrap items-center gap-1">
                  <IconBarbell size={12} aria-hidden="true" />
                  Exercise logs
                </div>
                <div className="text-2xl font-bold mt-1 text-text-main">
                  {totalExercisesLogged}
                </div>
              </div>
            </div>

            {/* AI Progressive Overload Suggestions Card */}
            {suggestionsLoading ? (
              <div className="bg-surface/50 rounded-xl p-4 border border-border-subtle animate-pulse">
                <div className="h-4 w-40 bg-border-subtle rounded mb-3" />
                <div className="h-3 w-full bg-border-subtle rounded" />
              </div>
            ) : suggestions.length > 0 ? (
              <div className="rounded-2xl p-4 bg-brand-accent/10 border border-brand-accent/25">
                <div className="flex items-center gap-2 mb-3">
                  <IconTrendingUp
                    size={18}
                    className="text-brand-accent"
                    stroke={2}
                  aria-hidden="true" />
                  <span className="text-sm font-semibold text-text-main">
                    Ideas for your next session
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="bg-raised border border-border-subtle rounded-xl px-3.5 py-2.5"
                    >
                      <div className="text-sm font-medium text-text-main">
                        {s.exercise}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {s.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Exercises List and Drill-down Drawer */}
            <div>
              <h2 className="text-[15px] text-text-main font-semibold mb-2.5">
                Exercises in your recent sessions ({allExercises.length})
              </h2>
              <div className="flex flex-col gap-2">
                {allExercises.map((name) => {
                  const stats = getExerciseStats(name);
                  const isSelected = selectedExercise === name;

                  return (
                    <div key={name}>
                      <button
                          type="button"
                          aria-expanded={isSelected}
                        onClick={() => loadExerciseHistory(name)}
                        className={`progress-exercise-button w-full text-left bg-surface/70 border rounded-xl px-4 py-3 flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${
                          isSelected
                            ? "border-brand-accent bg-brand-accent/5"
                            : "border-border-subtle hover:border-text-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconBarbell
                            className={
                              isSelected
                                ? "text-brand-accent"
                                : "text-text-muted"
                            }
                            size={20}
                            stroke={1.5}
                          aria-hidden="true" />
                          <div>
                            <div className="text-sm font-semibold text-text-main">
                              {name}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {stats.sessionCount} sessions &middot;{" "}
                              {stats.totalSets} sets &middot; Recent best:{" "}
                              {stats.maxWeight > 0 ? `${stats.maxWeight} kg` : 'Bodyweight'}
                            </div>
                          </div>
                        </div>
                        <IconChevronDown
                          className={`progress-chevron ${
                            isSelected
                              ? "text-brand-accent"
                              : "text-text-muted/50"
                          }`}
                          size={18}
                          stroke={1.5}
                        aria-hidden="true" />
                      </button>

                      {/* Expanded Drill-down Performance View */}
                      {isSelected && (
                        <div className="ml-4 mt-2 mb-1 border-l-2 border-brand-accent/30 pl-4">
                          {historyLoading ? (
                            <div className="flex items-center gap-2 py-3">
                              <IconLoader2
                                size={16}
                                className="text-brand-accent animate-spin"
                              aria-hidden="true" />
                              <span className="text-xs text-text-muted">
                                Loading history...
                              </span>
                            </div>
                          ) : historyError ? (
                            <p role="alert" className="text-xs text-danger-text py-2">{historyError}</p>
                          ) : exerciseHistory.length === 0 ? (
                            <p className="text-xs text-text-muted py-2">
                              No history data available.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {exerciseHistory.map((entry, idx) => (
                                <div
                                  key={idx}
                                  className="bg-surface/50 border border-border-subtle rounded-lg px-3 py-2"
                                >
                                  <div className="text-xs text-text-muted mb-1 flex items-center gap-1">
                                    <IconCalendar size={11} aria-hidden="true" />
                                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      }
                                    )}
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    {(entry.sets || []).map((set, si) => (
                                      <span
                                        key={si}
                                        className="text-xs bg-brand-accent/10 text-accent-text rounded-md px-2 py-0.5 font-medium"
                                      >
                                        {set.weight}kg × {set.reps}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Sessions List */}
            <div>
              <h2 className="text-[15px] text-text-main font-semibold mb-2.5">
                Recent sessions
              </h2>
              <div className="flex flex-col gap-2">
                {sessions.slice(0, 10).map((s, idx) => (
                  <div
                    key={idx}
                    className="bg-surface/70 border border-border-subtle rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 text-sm font-medium text-text-main">
                      <IconCalendar size={18} className="text-text-muted" aria-hidden="true" />
                      {new Date(`${s.session_date}T00:00:00`).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <span className="text-[13px] text-text-muted">
                      {(s.exercise_logs || []).length} exercises
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
