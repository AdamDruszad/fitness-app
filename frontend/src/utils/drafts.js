/** IndexedDB read/compare/write transactions protect concurrent tabs and account boundaries. */
let database;
function open() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open("fitai-training", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath: "owner" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
export async function loadDraft(owner) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("drafts").objectStore("drafts").get(owner);
    request.onsuccess = () => resolve(request.result || { owner, revision: 0, draft: null });
    request.onerror = () => reject(request.error);
  });
}
export async function saveDraft(owner, expectedRevision, draft) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    const store = tx.objectStore("drafts");
    const get = store.get(owner);
    let conflict = false;
    get.onsuccess = () => {
      if ((get.result?.revision || 0) !== expectedRevision) { conflict = true; tx.abort(); return; }
      store.put({ owner, revision: expectedRevision + 1, draft });
    };
    tx.oncomplete = () => resolve(expectedRevision + 1);
    tx.onabort = tx.onerror = () => reject(new Error(conflict ? "This workout changed in another tab. Reload the saved draft before continuing." : "Changes aren't saved on this device. Keep this page open and retry."));
  });
}

export function newDraft(plan, day, owner, now = new Date()) {
  return { owner, occurrence_id: crypto.randomUUID(), plan_id: plan.id, version: plan.version,
    title: plan.plan_data.title, day: structuredClone(day),
    session_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    rows: Object.fromEntries(day.exercises.map(e => [e.id, Array.from({ length: e.sets }, () => ({ weight: "", reps: "", duration_seconds: "", done: false }))])),
    targets: {}, increments: {}, notes: {}, pending: null };
}

export function actualSet(row, exercise) {
  const field = exercise.measurement === "duration" ? "duration_seconds" : "reps";
  const count = Number(row[field]);
  if (!Number.isSafeInteger(count) || count < 1 || count > (field === "reps" ? 10000 : 86400)) throw new Error(`${exercise.name}: enter valid ${field === "reps" ? "repetitions" : "seconds"}.`);
  const weight = row.weight === "" || row.weight == null ? null : Number(row.weight);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 2000)) throw new Error(`${exercise.name}: use a load from 0 to 2000 kg.`);
  if (exercise.measurement === "legacy") throw new Error(`Choose a typed prescription for ${exercise.name} in a plan draft first.`);
  return { [field]: count, weight: exercise.load_basis === "bodyweight" ? null : weight };
}

export function completionPayload(draft) {
  const exercises = draft.day.exercises.map(exercise => ({ slot_id: exercise.id, measurement: exercise.measurement,
    sets_data: draft.rows[exercise.id].filter(r => r.done).map(r => actualSet(r, exercise)),
    target_data: draft.targets[exercise.id] || null, notes: draft.notes[exercise.id] || "" })).filter(e => e.sets_data.length);
  if (!exercises.length) throw new Error("Complete at least one actual set first.");
  if (draft.day.exercises.some(e => draft.rows[e.id].some(r => !r.done && [r.weight, r.reps, r.duration_seconds].some(v => v !== "" && v != null)))) throw new Error("Some entered rows aren't confirmed. Mark them done or clear them before finishing.");
  return { occurrence_id: draft.occurrence_id, plan_id: draft.plan_id, day_id: draft.day.id, session_date: draft.session_date, exercises };
}

export function formatSets(sets, measurement) {
  if (!sets?.length) return "No recorded sets";
  return sets.map(s => `${s.weight != null ? `${s.weight} kg × ` : ""}${measurement === "duration" ? `${s.duration_seconds} s` : `${s.reps} reps`}`).join(" · ");
}
