export function prescription(exercise) {
  return `${exercise.sets} sets × ${exercise.measurement === "duration" ? `${exercise.duration_seconds} s` : exercise.reps}${exercise.target_weight != null ? ` · Starting load ${exercise.target_weight} kg` : ""} · ${exercise.rest_seconds} s rest`;
}

export function comparableImprovement(log, previous) {
  if (!previous || log.sets_data.length !== previous.sets.length) return null;
  if (!log.sets_data.every((s, i) => s.weight === previous.sets[i].weight)) return null;
  const field = log.measurement === "duration" ? "duration_seconds" : "reps";
  const before = previous.sets.reduce((n, s) => n + (s[field] || 0), 0);
  const after = log.sets_data.reduce((n, s) => n + (s[field] || 0), 0);
  if (after <= before) return null;
  return `${log.exercise_name}: ${after - before} more ${field === "reps" ? "total reps" : "seconds"} across the same number of sets and recorded load than ${previous.date}.`;
}

export function planChanges(base, next) {
  const old = (base?.days || []).flatMap(d => d.exercises.map(e => ({ ...e, day: d.day })));
  const fresh = (next?.days || []).flatMap(d => d.exercises.map(e => ({ ...e, day: d.day })));
  const used = new Set();
  const result = fresh.map(e => {
    const match = old.find(o => !used.has(o) && ((o.id && o.id === e.id) || (o.name === e.name && o.day === e.day)));
    if (!match) return { label: "Added", name: `${e.day}: ${e.name}`, detail: prescription(e) };
    used.add(match);
    const same = match.name === e.name && match.day === e.day && prescription(match) === prescription(e) && match.notes === e.notes && match.target_weight === e.target_weight && match.load_basis === e.load_basis;
    return { label: same ? "Kept" : "Changed", name: `${e.day}: ${e.name}`, detail: same ? prescription(e) : `${match.day}: ${match.name}, ${prescription(match)} → ${prescription(e)}${match.load_basis !== e.load_basis ? ` · Load basis: ${match.load_basis || "unspecified"} → ${e.load_basis || "unspecified"}` : ""}${match.notes !== e.notes ? ` · Notes: ${match.notes || "none"} → ${e.notes || "none"}` : ""}` };
  });
  return [...result, ...old.filter(o => !used.has(o)).map(o => ({ label: "Removed", name: `${o.day}: ${o.name}`, detail: prescription(o) }))];
}

export function apiError(error) {
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(e => e.msg).join(". ") : "Could not connect. Your work is still here; try again.";
}
