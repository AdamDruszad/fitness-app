import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import client from "../api/client";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import { apiError, prescription } from "../utils/plans";

export default function PlanHistory() {
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { const c = new AbortController(); client.get("/plans/", { signal: c.signal }).then(r => { setPlans(r.data); setMore(r.data.length === 20); }).catch(e => { if (!c.signal.aborted) setError(apiError(e)); }); return () => c.abort(); }, []);
  async function loadMore() {
    setBusy(true);
    try { const { data } = await client.get("/plans/", { params: { before: plans.at(-1).id } }); setPlans(p => [...p, ...data]); setMore(data.length === 20); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function restore(plan) {
    try { const { data } = await client.post(`/plans/versions/${plan.id}/restore`, { request_id: crypto.randomUUID(), expected_active_id: plans.find(p => p.is_active)?.id || null }); navigate(`/plans/proposals/${data.id}`); } catch (e) { setError(apiError(e)); }
  }
  return <Layout><PageHeading eyebrow="Your routine over time" title="Plan history" /><Link to="/">Back to my plan</Link>{error && <p role="alert">{error}</p>}{plans.map(p => <details className="continuity-card" key={p.id}><summary>{p.plan_data.title} · v{p.version}{p.is_active ? " · Active" : ""} · {new Date(p.created_at).toLocaleDateString()}</summary>{p.plan_data.days.map(d => <section key={d.id}><h3>{d.day} · {d.focus}</h3><ul>{d.exercises.map(e => <li key={e.id}>{e.name}: {prescription(e)}</li>)}</ul></section>)}{!p.is_active && <button className="fitai-secondary-button" onClick={() => restore(p)}>Review this version again</button>}</details>)}{more && <button disabled={busy} className="fitai-secondary-button" onClick={loadMore}>Load earlier versions</button>}</Layout>;
}
