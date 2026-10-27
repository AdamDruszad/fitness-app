// Synthetic data shaped like backend/app/schemas/{user,plan,session}.py.
// All requests are intercepted; these tests never use a real account or AI provider.
export const NOW = "2026-10-15T09:30:00";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const PLAN_ID = id(10);
export const PROPOSAL_ID = id(20);
export const SESSION_ID = id(30);
export const user = {
  id: id(1), email: "lifter@example.com", age: 34, gender: "female", weight_kg: 64.5,
  goal: "strength", level: "intermediate", days_per_week: 3, weekly_session_goal: 3,
  equipment: "gym", injuries: "", is_guest: false,
};
const exercise = (slot, name, extra = {}) => ({
  id: slot, exercise_id: slot, name, sets: 3, reps: "6–8", measurement: "reps",
  duration_seconds: null, load_basis: "total", notes: "", target_weight: 52.5, rest_seconds: 120, ...extra,
});
export const plan = {
  id: PLAN_ID, version: 3, is_active: true, created_at: "2026-10-01T18:00:00Z",
  source: "coach", base_plan_id: null, lineage_id: PLAN_ID,
  plan_data: {
    schema_version: 2, title: "Strength base · 3 days", weeks: 8,
    days: [
      { id: "monday", day: "Monday", focus: "Upper body push", exercises: [exercise("bench", "Bench press"), exercise("press", "Overhead press")] },
      { id: "wednesday", day: "Wednesday", focus: "Lower body", exercises: [exercise("squat", "Back squat"), exercise("plank", "Plank", { measurement: "duration", reps: null, duration_seconds: 45, load_basis: "bodyweight", target_weight: null })] },
      { id: "friday", day: "Friday", focus: "Upper body pull", exercises: [exercise("row", "Barbell row"), exercise("curl", "Dumbbell curl", { load_basis: "per_hand" })] },
    ],
  },
};
const session = {
  id: SESSION_ID, session_date: "2026-10-13", notes: null, status: "completed", revision: 1,
  created_at: "2026-10-13T18:00:00Z", completed_at: "2026-10-13T19:00:00Z",
  occurrence_id: id(40), plan_id: PLAN_ID, day_id: "monday",
  workout_snapshot: { plan_title: plan.plan_data.title, version: 3, day: plan.plan_data.days[0] },
  exercise_logs: [{ id: id(50), exercise_name: "Bench press", exercise_id: "bench", slot_id: "bench", measurement: "reps", load_basis: "total", sets_data: [{ weight: 52.5, reps: 8 }, { weight: 52.5, reps: 7 }], target_data: { rule: "repeat-v1", reason: "Repeat your previous load.", weight: 52.5, reps: 8 }, notes: "Felt strong." }],
};

export async function mockApi(context, { empty = false, fail = false, longNames = false } = {}) {
  const active = structuredClone(plan);
  if (longNames) {
    active.plan_data.title = "VeryLongUnbrokenTrainingPlanName".repeat(6);
    for (const day of active.plan_data.days) {
      day.focus = "StrengthAndConditioning".repeat(7);
      day.exercises[0].name = "DumbbellExercise".repeat(12);
    }
  }
  const proposal = {
    id: PROPOSAL_ID, status: "ready", revision: 1, base_plan_id: PLAN_ID, applied_plan_id: null,
    plan_data: structuredClone(active.plan_data), instructions: "Improve my routine", keep_exercises: [],
    error: null, created_at: "2026-10-14T20:00:00Z", request_id: id(60), stale: false, base_plan: active, active_id: PLAN_ID,
  };
  proposal.plan_data.days[0].exercises[0].sets = 4;
  const recorded = structuredClone(session);
  const requests = [];
  const unexpected = [];
  let guest = false;
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization, Content-Type", "access-control-allow-methods": "GET, POST, PUT, OPTIONS" };
  await context.route("http://localhost:8000/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/\/$/, "");
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const body = request.postData() ? request.postDataJSON() : null;
    requests.push({ method, path, body });
    if (path === "/users/me") return json({ ...user, is_guest: guest, ...(empty ? { goal: null, level: null, equipment: null, days_per_week: null, age: null, weight_kg: null } : {}), ...body });
    if (path === "/auth/login" || path === "/auth/register") return json({ access_token: "test-token", token_type: "bearer" });
    if (path === "/auth/guest") { guest = true; return json({ access_token: "test-token", token_type: "bearer" }); }
    if (path === "/plans/current") return fail ? json({ detail: "Plan unavailable" }, 500) : empty ? json({ detail: "No plan" }, 404) : json(active);
    if (path === "/plans") return json(empty ? [] : [active, { ...active, id: id(11), version: 2, is_active: false }]);
    if (path === "/plans/proposals") return json(method === "GET" ? empty ? [] : [proposal] : proposal);
    if (path === `/plans/proposals/${PROPOSAL_ID}`) {
      if (method === "PUT") { proposal.plan_data = body.plan_data; proposal.revision++; }
      return json(proposal);
    }
    if (path === `/plans/proposals/${PROPOSAL_ID}/apply`) { proposal.status = "applied"; return json(active); }
    if (/^\/plans\/versions\/.+\/restore$/.test(path)) return json(proposal);
    if (path === "/sessions/summary") return json({ completed: empty ? 0 : 3, week_completed: empty ? 0 : 1, weekly_goal: empty ? null : 3, week_start: "2026-10-12" });
    if (path === "/sessions") return fail ? json({ detail: "Sessions unavailable" }, 500) : json(empty ? [] : [recorded]);
    if (path === "/sessions/history") return fail ? json({ detail: "History unavailable" }, 500) : json({ items: empty ? [] : [recorded], next: null });
    if (path === "/sessions/export") return json({ schema_version: 1, units: { load: "kg", duration: "seconds" }, sessions: [recorded] });
    if (path === "/sessions/previous") {
      const day = active.plan_data.days.find(d => d.id === body.day_id);
      return json(Object.fromEntries(day.exercises.map(ex => [ex.id, { previous: null, target: { rule: "baseline", source_session_id: null, reason: "Record a comfortable starting session to establish a baseline." } }])));
    }
    if (path === "/sessions/complete") {
      const day = active.plan_data.days.find(d => d.id === body.day_id);
      Object.assign(recorded, { session_date: body.session_date, occurrence_id: body.occurrence_id, day_id: day.id, workout_snapshot: { plan_title: active.plan_data.title, version: 3, day },
        exercise_logs: body.exercises.map((ex, i) => ({ ...ex, id: id(80 + i), exercise_id: ex.slot_id, exercise_name: day.exercises.find(e => e.id === ex.slot_id).name, load_basis: day.exercises.find(e => e.id === ex.slot_id).load_basis })) });
      return json(recorded);
    }
    if (path === `/sessions/${SESSION_ID}/correction`) {
      recorded.exercise_logs = recorded.exercise_logs.map(log => ({ ...log, sets_data: body.logs[log.id] || log.sets_data }));
      recorded.revision++;
      return json(recorded);
    }
    if (path === `/sessions/${SESSION_ID}`) return json(recorded);
    if (path === "/chat" && method === "GET") return json(empty ? [] : [{ id: id(70), role: "assistant", content: "Let's work on your training.\n\n| Exercise | Sets |\n|---|---|\n| Bench press | 3 × 8 |" }]);
    if (path === "/chat" && method === "POST") return route.fulfill({ headers: { ...cors, "content-type": "text/event-stream" }, body: `data: ${JSON.stringify("Keep the load steady and add a rep when ready.")}\n\nevent: done\ndata: ${JSON.stringify({ id: id(71), user_id: id(72) })}\n\n` });
    if (path === "/progress/suggestions") return json({ suggestions: [{ exercise: "Bench press", suggestion: "Build a consistent baseline first." }] });
    unexpected.push(`${method} ${path}`);
    return json({ detail: `Unmocked ${method} ${path}` }, 500);
  });
  return { requests, unexpected };
}
