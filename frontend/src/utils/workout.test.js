import test from "node:test";
import assert from "node:assert/strict";
import { createWorkoutSaver, getNextTrainingDay, isWithinLastSevenDays, prepareWorkoutEntries } from "./workout.js";

const exercise = (exerciseName, weight = 0, reps = 10) => ({ exerciseName, sets: [{ weight, reps }] });

test("training selection includes today, ignores rest days, and wraps the week", () => {
  const monday = { day: "Monday", exercises: ["Squat"] };
  const friday = { day: "Friday", exercises: ["Row"] };
  const days = [friday, { day: "Sunday", exercises: [] }, monday];
  assert.equal(getNextTrainingDay(days, new Date(2026, 9, 5)), monday);
  assert.equal(getNextTrainingDay(days, new Date(2026, 9, 6)), friday);
  assert.equal(getNextTrainingDay(days, new Date(2026, 9, 10)), monday);
});

test("numbered plans fall back to the first training day and empty plans have none", () => {
  const day = { day: "Day 1 - Push", exercises: ["Push-ups"] };
  assert.equal(getNextTrainingDay([{ day: "Rest", exercises: [] }, day]), day);
  assert.equal(getNextTrainingDay([]), null);
  assert.equal(getNextTrainingDay([{ day: "Monday" }]), null);
});

test("last seven days include six days ago through today and reject future/invalid dates", () => {
  const today = new Date(2026, 0, 3, 23, 59);
  assert.equal(isWithinLastSevenDays("2025-12-28", today), true);
  assert.equal(isWithinLastSevenDays("2026-01-03", today), true);
  assert.equal(isWithinLastSevenDays("2025-12-27", today), false);
  assert.equal(isWithinLastSevenDays("2026-01-04", today), false);
  assert.equal(isWithinLastSevenDays("not-a-date", today), false);
});

test("blank rows are skipped and bodyweight rows save as zero kilograms", () => {
  assert.deepEqual(prepareWorkoutEntries({
    "Push-ups": [{ weight: "", reps: "" }, { weight: "  ", reps: " 12 " }],
    Squat: [{ weight: null, reps: undefined }],
  }), { entries: [exercise("Push-ups", 0, 12)], errors: [] });
});

test("valid decimal weights and numeric values preserve exercise and set order", () => {
  assert.deepEqual(prepareWorkoutEntries({
    Row: [{ weight: "12.5", reps: "8" }, { weight: 10, reps: 9 }],
    Plank: [{ weight: 0, reps: 1 }],
  }), { entries: [
    { exerciseName: "Row", sets: [{ weight: 12.5, reps: 8 }, { weight: 10, reps: 9 }] },
    exercise("Plank", 0, 1),
  ], errors: [] });
});

test("started invalid rows produce actionable exercise/set errors", () => {
  const invalid = [
    { weight: "20", reps: "" }, { weight: "-1", reps: "5" },
    { weight: "Infinity", reps: "5" }, { weight: "hello", reps: "5" },
    { weight: "0", reps: "0" }, { weight: "0", reps: "-2" },
    { weight: "0", reps: "1.5" }, { weight: "0", reps: "9007199254740992" },
  ];
  const result = prepareWorkoutEntries({ Squat: invalid, Row: [{ weight: "5", reps: "8" }] });
  assert.deepEqual(result.entries, [exercise("Row", 5, 8)]);
  assert.equal(result.errors.length, invalid.length);
  result.errors.forEach((message, index) => assert.match(message, new RegExp(`Squat, set ${index + 1}:`)));
});

test("partial retry reuses its session and does not resend successful exercises", async () => {
  const calls = [];
  let failRow = true;
  const saver = createWorkoutSaver({ async post(path, data) {
    calls.push({ path, data });
    if (path === "/sessions") return { data: { id: 42 } };
    if (data.exercise_name === "Row" && failRow) throw new Error("Temporary failure");
    return { data: {} };
  } });
  const entries = [exercise("Push-ups"), exercise("Row", 20, 8)];
  assert.deepEqual(await saver.save("Monday", entries), { saved: ["Push-ups"], failed: ["Row"] });
  failRow = false;
  assert.deepEqual(await saver.save("Monday", entries), { saved: ["Push-ups", "Row"], failed: [] });
  assert.equal(calls.filter(call => call.path === "/sessions").length, 1);
  assert.equal(calls.filter(call => call.data.exercise_name === "Push-ups").length, 1);
  assert.equal(calls.filter(call => call.data.exercise_name === "Row").length, 2);
  assert.ok(calls.slice(1).every(call => call.path === "/sessions/42/logs"));
  assert.match(calls[0].data.session_date, /^\d{4}-\d{2}-\d{2}$/);
  const count = calls.length;
  await saver.save("Monday", entries);
  assert.equal(calls.length, count, "Repeated completed save performs no writes");
});

test("different days receive separate sessions even with the same exercise name", async () => {
  const calls = [];
  let sequence = 0;
  const saver = createWorkoutSaver({ async post(path, data) {
    calls.push({ path, data });
    return { data: { id: path === "/sessions" ? ++sequence : undefined } };
  } });
  await saver.save("Monday", [exercise("Squat", 40, 8)]);
  await saver.save("Friday", [exercise("Squat", 45, 6)]);
  assert.deepEqual(calls.map(call => call.path), ["/sessions", "/sessions/1/logs", "/sessions", "/sessions/2/logs"]);
  assert.deepEqual(calls[3].data, { exercise_name: "Squat", sets_data: [{ weight: 45, reps: 6 }] });
});

test("failed session creation can be retried without sending logs to a missing session", async () => {
  const paths = [];
  let failSession = true;
  const saver = createWorkoutSaver({ async post(path) {
    paths.push(path);
    if (path === "/sessions" && failSession) throw new Error("Offline");
    return { data: { id: 7 } };
  } });
  await assert.rejects(saver.save("Monday", [exercise("Squat")]), /Offline/);
  assert.deepEqual(paths, ["/sessions"]);
  failSession = false;
  assert.deepEqual(await saver.save("Monday", [exercise("Squat")]), { saved: ["Squat"], failed: [] });
  assert.deepEqual(paths, ["/sessions", "/sessions", "/sessions/7/logs"]);
});
