import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { IconArrowBackUp } from "@tabler/icons-react";
import client from "../api/client";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import { BackLink, Notice, LoadingLine } from "../components/ui";
import { apiError, prescription } from "../utils/plans";

export default function PlanHistory() {
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { const c = new AbortController(); client.get("/plans/", { signal: c.signal }).then(r => { setPlans(r.data); setMore(r.data.length === 20); setLoaded(true); }).catch(e => { if (!c.signal.aborted) { setError(apiError(e)); setLoaded(true); } }); return () => c.abort(); }, []);
  async function loadMore() {
    setBusy(true);
    try { const { data } = await client.get("/plans/", { params: { before: plans.at(-1).id } }); setPlans(p => [...p, ...data]); setMore(data.length === 20); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function restore(plan) {
    try { const { data } = await client.post(`/plans/versions/${plan.id}/restore`, { request_id: crypto.randomUUID(), expected_active_id: plans.find(p => p.is_active)?.id || null }); navigate(`/plans/proposals/${data.id}`); } catch (e) { setError(apiError(e)); }
  }
  return <Layout width="narrow" contentClassName="plan-history">
    <BackLink to="/">Back to my plan</BackLink>
    <PageHeading eyebrow="Your routine over time" title="Plan history" />
    {error && <Notice tone="error" className="review-notice"><p role="alert">{error}</p></Notice>}
    {!loaded ? <LoadingLine>Loading plan history…</LoadingLine> : !plans.length && !error ? <div className="empty"><h2>No plan versions yet.</h2><Link to="/onboarding" className="btn btn--primary">Create your plan</Link></div> : <>
      <h2 className="sr-only">Versions</h2>
      <ul className="version-list">{plans.map(p => <li key={p.id}>
        <details className={`version${p.is_active ? " is-active" : ""}`}>
          <summary>
            <span className="version-badge num">v{p.version}</span>
            <span className="version-main">
              <span className="version-title">{p.plan_data.title}<span className="sr-only"> · v{p.version}</span></span>
              <span className="version-date"><span className="sr-only"> · </span>{new Date(p.created_at).toLocaleDateString()}</span>
            </span>
            {p.is_active && <span className="tag tag--ok"><span className="sr-only"> · </span>Active</span>}
          </summary>
          <div className="version-body">
            <div className="version-days">{p.plan_data.days.map(d => <section key={d.id} className="version-day">
              <h3>{d.day} · <span className="muted">{d.focus}</span></h3>
              <ul>{d.exercises.map(e => <li key={e.id}><span className="version-ex">{e.name}:</span> <span className="muted">{prescription(e)}</span></li>)}</ul>
            </section>)}</div>
            {!p.is_active && <button type="button" className="btn btn--secondary" onClick={() => restore(p)}><IconArrowBackUp size={18} stroke={1.75} aria-hidden="true" />Review this version again</button>}
          </div>
        </details>
      </li>)}</ul>
    </>}
    {more && <button type="button" disabled={busy} className="btn btn--secondary load-more" onClick={loadMore}>Load earlier versions</button>}
  </Layout>;
}
