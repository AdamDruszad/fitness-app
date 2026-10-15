import { IconPlus, IconTrash } from "@tabler/icons-react";
import { countLabel } from "../utils/format";

export default function PlanEditor({ plan, onChange, disabled = false }) {
  const editDay = (index, update) => onChange({ ...plan, days: plan.days.map((d, i) => i === index ? update(d) : d) });
  const edit = (di, ei, key, value) => editDay(di, d => ({ ...d, exercises: d.exercises.map((e, i) => i === ei ? { ...e, [key]: value } : e) }));
  return <fieldset disabled={disabled} className="plan-editor">
    <legend className="sr-only">Plan editor</legend>
    <div className="plan-editor-top">
      <label className="field"><span className="field-label">Plan title</span><input className="input" value={plan.title} maxLength={200} onChange={e => onChange({ ...plan, title: e.target.value })} /></label>
      <label className="field"><span className="field-label">Intended length (weeks)</span><input className="input" type="number" min="1" max="52" value={plan.weeks} onChange={e => onChange({ ...plan, weeks: Number(e.target.value) })} /></label>
    </div>
    {plan.days.map((day, di) => <details className="disclosure plan-day" key={day.id || di}>
      <summary>
        <span className="plan-day-index num" aria-hidden="true">{String(di + 1).padStart(2, "0")}</span>
        <span className="plan-day-summary"><span>{day.day}</span><span className="muted small">{day.focus} · {countLabel(day.exercises.length, "exercise")}</span></span>
      </summary>
      <div className="disclosure-body">
        <div className="plan-editor-top">
          <label className="field"><span className="field-label">Workout name</span><input className="input" value={day.day} onChange={e => editDay(di, d => ({ ...d, day: e.target.value }))} /></label>
          <label className="field"><span className="field-label">Focus</span><input className="input" value={day.focus} onChange={e => editDay(di, d => ({ ...d, focus: e.target.value }))} /></label>
        </div>
        {day.exercises.map((ex, ei) => <fieldset className="prescription-editor" key={ex.id || ei}><legend className="eyebrow">Exercise {ei + 1}</legend>
          <label className="field prescription-name"><span className="field-label">Exercise name</span><input className="input" value={ex.name} onChange={e => edit(di, ei, "name", e.target.value)} /></label>
          <div className="prescription-fields">
            <label className="field"><span className="field-label">Sets</span><input className="input" type="number" min="1" max="20" value={ex.sets} onChange={e => edit(di, ei, "sets", Number(e.target.value))} /></label>
            <label className="field"><span className="field-label">Measurement</span><select className="select" value={ex.measurement || "reps"} onChange={e => editDay(di, d => ({ ...d, exercises: d.exercises.map((x, i) => i === ei ? { ...x, measurement: e.target.value, reps: e.target.value === "duration" ? null : "8–10", duration_seconds: e.target.value === "duration" ? 30 : null } : x) }))}><option value="reps">Repetitions</option><option value="duration">Seconds</option>{ex.measurement === "legacy" && <option value="legacy">Original prescription</option>}</select></label>
            {ex.measurement === "duration" ? <label className="field"><span className="field-label">Seconds</span><input className="input" type="number" min="1" value={ex.duration_seconds} onChange={e => edit(di, ei, "duration_seconds", Number(e.target.value))} /></label> : <label className="field"><span className="field-label">Reps / range</span><input className="input" value={ex.reps || ""} onChange={e => edit(di, ei, "reps", e.target.value)} /></label>}
            <label className="field"><span className="field-label">Rest (seconds)</span><input className="input" type="number" min="0" max="3600" value={ex.rest_seconds} onChange={e => edit(di, ei, "rest_seconds", Number(e.target.value))} /></label>
            <label className="field"><span className="field-label">Load basis</span><select className="select" value={ex.load_basis || "unspecified"} onChange={e => edit(di, ei, "load_basis", e.target.value)}>{["unspecified", "total", "per_hand", "added", "bodyweight", "assistance"].map(v => <option key={v} value={v}>{v.replace("_", " ")}</option>)}</select></label>
            <label className="field"><span className="field-label">Optional starting load (kg)</span><input className="input" type="number" min="0" max="2000" step="any" value={ex.target_weight ?? ""} onChange={e => edit(di, ei, "target_weight", e.target.value === "" ? null : Number(e.target.value))} /></label>
          </div>
          <label className="field"><span className="field-label">Notes</span><input className="input" value={ex.notes || ""} onChange={e => edit(di, ei, "notes", e.target.value)} /></label>
          <button type="button" className="btn btn--danger btn--sm prescription-remove" onClick={() => editDay(di, d => ({ ...d, exercises: d.exercises.filter((_, i) => i !== ei) }))}><IconTrash size={16} stroke={1.75} aria-hidden="true" />Remove {ex.name}</button>
        </fieldset>)}
        <button type="button" className="btn btn--secondary plan-add" onClick={() => editDay(di, d => ({ ...d, exercises: [...d.exercises, { id: crypto.randomUUID(), name: "New exercise", sets: 3, reps: "8–10", measurement: "reps", rest_seconds: 90, load_basis: "unspecified", notes: "" }] }))}><IconPlus size={18} stroke={1.75} aria-hidden="true" />Add exercise</button>
      </div>
    </details>)}
  </fieldset>;
}
