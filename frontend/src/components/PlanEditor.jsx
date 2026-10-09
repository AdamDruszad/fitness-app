export default function PlanEditor({ plan, onChange, disabled = false }) {
  const editDay = (index, update) => onChange({ ...plan, days: plan.days.map((d, i) => i === index ? update(d) : d) });
  const edit = (di, ei, key, value) => editDay(di, d => ({ ...d, exercises: d.exercises.map((e, i) => i === ei ? { ...e, [key]: value } : e) }));
  return <fieldset disabled={disabled} className="plan-editor">
    <label>Plan title<input value={plan.title} maxLength={200} onChange={e => onChange({ ...plan, title: e.target.value })} /></label>
    <label>Intended length (weeks)<input type="number" min="1" max="52" value={plan.weeks} onChange={e => onChange({ ...plan, weeks: Number(e.target.value) })} /></label>
    {plan.days.map((day, di) => <section className="continuity-card" key={day.id || di}>
      <label>Workout name<input value={day.day} onChange={e => editDay(di, d => ({ ...d, day: e.target.value }))} /></label>
      <label>Focus<input value={day.focus} onChange={e => editDay(di, d => ({ ...d, focus: e.target.value }))} /></label>
      {day.exercises.map((ex, ei) => <fieldset className="prescription-editor" key={ex.id || ei}><legend>Exercise {ei + 1}</legend>
        <label>Exercise name<input value={ex.name} onChange={e => edit(di, ei, "name", e.target.value)} /></label>
        <div className="prescription-fields">
          <label>Sets<input type="number" min="1" max="20" value={ex.sets} onChange={e => edit(di, ei, "sets", Number(e.target.value))} /></label>
          <label>Measurement<select value={ex.measurement || "reps"} onChange={e => editDay(di, d => ({ ...d, exercises: d.exercises.map((x, i) => i === ei ? { ...x, measurement: e.target.value, reps: e.target.value === "duration" ? null : "8–10", duration_seconds: e.target.value === "duration" ? 30 : null } : x) }))}><option value="reps">Repetitions</option><option value="duration">Seconds</option>{ex.measurement === "legacy" && <option value="legacy">Original prescription</option>}</select></label>
          {ex.measurement === "duration" ? <label>Seconds<input type="number" min="1" value={ex.duration_seconds} onChange={e => edit(di, ei, "duration_seconds", Number(e.target.value))} /></label> : <label>Reps / range<input value={ex.reps || ""} onChange={e => edit(di, ei, "reps", e.target.value)} /></label>}
          <label>Rest (seconds)<input type="number" min="0" max="3600" value={ex.rest_seconds} onChange={e => edit(di, ei, "rest_seconds", Number(e.target.value))} /></label>
          <label>Load basis<select value={ex.load_basis || "unspecified"} onChange={e => edit(di, ei, "load_basis", e.target.value)}>{["unspecified", "total", "per_hand", "added", "bodyweight", "assistance"].map(v => <option key={v} value={v}>{v.replace("_", " ")}</option>)}</select></label>
          <label>Optional starting load (kg)<input type="number" min="0" max="2000" step="any" value={ex.target_weight ?? ""} onChange={e => edit(di, ei, "target_weight", e.target.value === "" ? null : Number(e.target.value))} /></label>
        </div>
        <label>Notes<input value={ex.notes || ""} onChange={e => edit(di, ei, "notes", e.target.value)} /></label>
        <button type="button" className="text-link" onClick={() => editDay(di, d => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }))}>Remove {ex.name}</button>
      </fieldset>)}
      <button type="button" className="fitai-secondary-button" onClick={() => editDay(di, d => ({ ...d, exercises: [...d.exercises, { id: crypto.randomUUID(), name: "New exercise", sets: 3, reps: "8–10", measurement: "reps", rest_seconds: 90, load_basis: "unspecified", notes: "" }] }))}>Add exercise</button>
    </section>)}
  </fieldset>;
}
