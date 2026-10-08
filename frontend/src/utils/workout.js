export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getNextTrainingDay(days, today = new Date()) {
  const trainingDays = days.filter(day => day.exercises?.length);
  return trainingDays.reduce((best, day) => {
    const dayIndex = WEEKDAYS.indexOf(day.day);
    if (dayIndex < 0) return best;
    const distance = (dayIndex - today.getDay() + 7) % 7;
    return !best || distance < best.distance ? { day, distance } : best;
  }, null)?.day || trainingDays[0] || null;
}

export function isWithinLastSevenDays(dateString, today = new Date()) {
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(current);
  start.setDate(start.getDate() - 6);
  const date = new Date(`${dateString}T00:00:00`);
  return date >= start && date <= current;
}

export function prepareWorkoutEntries(dayLogs) {
  const entries = [];
  const errors = [];
  for (const [exerciseName, sets] of Object.entries(dayLogs)) {
    const validSets = [];
    sets.forEach((set, index) => {
      const weightText = String(set.weight ?? "").trim();
      const repsText = String(set.reps ?? "").trim();
      if (!weightText && !repsText) return;
      const weight = weightText === "" ? 0 : Number(weightText);
      const reps = Number(repsText);
      if (!Number.isFinite(weight) || weight < 0 || !repsText || !Number.isSafeInteger(reps) || reps < 1) {
        errors.push(`${exerciseName}, set ${index + 1}: use a non-negative weight and a whole number of reps above zero.`);
        return;
      }
      validSets.push({ weight, reps });
    });
    if (validSets.length) entries.push({ exerciseName, sets: validSets });
  }
  return { entries, errors };
}

// Keep successful exercise writes and their session id during a partial retry.
// Network-safe idempotency across reloads still requires server support.
export function createWorkoutSaver(client) {
  const attempts = new Map();
  return {
    async save(day, entries) {
      let attempt = attempts.get(day);
      if (!attempt) {
        const date = new Date();
        const sessionDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const response = await client.post("/sessions", { session_date: sessionDate });
        attempt = { id: response.data.id, saved: new Set() };
        attempts.set(day, attempt);
      }
      const pending = entries.filter(entry => !attempt.saved.has(entry.exerciseName));
      const results = await Promise.allSettled(pending.map(entry => client.post(`/sessions/${attempt.id}/logs`, { exercise_name: entry.exerciseName, sets_data: entry.sets })));
      const failed = [];
      results.forEach((result, index) => {
        const name = pending[index].exerciseName;
        if (result.status === "fulfilled") attempt.saved.add(name);
        else failed.push(name);
      });
      return { saved: [...attempt.saved], failed };
    },
  };
}

