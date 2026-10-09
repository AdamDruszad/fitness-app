import test from "node:test";
import assert from "node:assert/strict";
import { newDraft, completionPayload, actualSet, formatSets } from "./drafts.js";
import { planChanges, comparableImprovement } from "./plans.js";
const day = { id: "day", day: "Workout A", exercises: [{ id: "bench", name: "Bench press", measurement: "reps", sets: 3, reps: "8–10", load_basis: "total", rest_seconds: 90 }] };
const plan = { id: "plan", version: 3, plan_data: { title: "Routine" } };

test("separate occurrences, snapshots, and accounts; targets never count as performed", () => {
  const a = newDraft(plan, day, "a");
  const b = newDraft(plan, day, "b");
  assert.notEqual(a.occurrence_id, b.occurrence_id);
  assert.notEqual(a.owner, b.owner);
  a.day.exercises[0].name = "Snapshot only";
  assert.equal(day.exercises[0].name, "Bench press");
  a.rows.bench[0] = { weight: 40, reps: 8, done: false };
  assert.throws(() => completionPayload(a), /Complete at least one/);
  a.rows.bench[0].done = true;
  assert.equal(completionPayload(a).exercises[0].sets_data.length, 1);
  a.rows.bench[1] = { weight: 40, reps: "", done: false };
  assert.throws(() => completionPayload(a), /aren't confirmed/);
});

test("timed/bodyweight logging and invalid input preserve measurement meaning", () => {
  const ex = { name: "Plank", measurement: "duration", load_basis: "bodyweight" };
  assert.deepEqual(actualSet({ duration_seconds: "30", weight: "" }, ex), { duration_seconds: 30, weight: null });
  assert.throws(() => actualSet({ duration_seconds: "3.5", weight: "" }, ex));
  assert.throws(() => actualSet({ reps: "8", weight: "Infinity" }, day.exercises[0]));
  assert.equal(formatSets([{ duration_seconds: 30 }], "duration"), "30 s");
});

test("review diff exposes removed exercises and changed prescriptions", () => {
  const base = { days: [day] };
  const next = structuredClone(base); next.days[0].exercises[0].sets = 4;
  assert.equal(planChanges(base, next)[0].label, "Changed");
  next.days[0].exercises = [];
  assert.equal(planChanges(base, next)[0].label, "Removed");
});

test("encouragement requires identical recorded load and set basis", () => {
  const log = { exercise_name: "Bench", measurement: "reps", sets_data: [{ weight: 40, reps: 10 }] };
  const old = { date: "2026-10-01", sets: [{ weight: 40, reps: 8 }] };
  assert.match(comparableImprovement(log, old), /2 more total reps/);
  assert.equal(comparableImprovement(log, { ...old, sets: [{ weight: 42.5, reps: 8 }] }), null);
  assert.equal(comparableImprovement(log, { ...old, sets: [...old.sets, ...old.sets] }), null);
});
