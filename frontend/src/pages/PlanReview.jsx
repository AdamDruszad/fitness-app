import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { IconRefresh, IconSparkles } from "@tabler/icons-react";
import client from "../api/client";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import PlanEditor from "../components/PlanEditor";
import { BackLink, Notice } from "../components/ui";
import { apiError, planChanges } from "../utils/plans";
import { useAuth } from "../hooks/useAuth";

export default function PlanReview() {
  const { id } = useParams();
  const { user } = useAuth();
  const editKey = `fitai:proposal:${user.id}:${id}`;
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [edited, setEdited] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    client.get(`/plans/proposals/${id}`, { signal: c.signal }).then(({ data }) => {
      setProposal(data); let local;
      try { local = JSON.parse(localStorage.getItem(editKey)); } catch { /* Server draft remains recoverable. */ }
      setEdited(data.status === "ready" && local?.revision === data.revision ? local.plan : data.plan_data);
    }).catch(e => { if (!c.signal.aborted) setError(apiError(e)); });
    return () => c.abort();
  }, [id, retry, editKey]);
  function edit(plan) {
    setEdited(plan);
    try { localStorage.setItem(editKey, JSON.stringify({ revision: proposal.revision, plan })); }
    catch { setError("Draft edits are only in this page. Save draft edits before leaving."); }
  }
  const dirty = proposal && JSON.stringify(edited) !== JSON.stringify(proposal.plan_data);
  const missingFavorites = proposal?.keep_exercises.filter(name => !edited?.days.some(day => day.exercises.some(e => e.name.trim().toLowerCase() === name.trim().toLowerCase()))) || [];
  async function save() {
    setBusy(true); setError("");
    try { const { data } = await client.put(`/plans/proposals/${id}`, { revision: proposal.revision, plan_data: edited }); setProposal(data); setEdited(data.plan_data); try { localStorage.removeItem(editKey); } catch { /* Revision prevents stale restore. */ } }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function apply() {
    setBusy(true); setError("");
    try { await client.post(`/plans/proposals/${id}/apply`, { revision: proposal.revision, expected_active_id: proposal.base_plan_id }); const { data } = await client.get(`/plans/proposals/${id}`); setProposal(data); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function refine() {
    setBusy(true); setError("");
    try { const { data } = await client.post("/plans/proposals", { request_id: crypto.randomUUID(), base_plan_id: proposal.active_id, from_proposal_id: id, instructions, keep_exercises: proposal.keep_exercises }); navigate(`/plans/proposals/${data.id}`); }
    catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  const changes = edited ? planChanges(proposal?.base_plan?.plan_data, edited) : [];
  const counts = ["Kept", "Changed", "Added", "Removed"].map(label => [label, changes.filter(c => c.label === label).length]).filter(([, n]) => n);
  const statusText = proposal ? (proposal.status === "applied" ? "Plan saved. Future workouts use the activated version." : proposal.status === "ready" ? dirty ? "Draft edits are not saved yet." : "Draft saved. Your active plan has not changed." : proposal.error || "Preparing your draft. Reload to check its status.") : "";
  const statusTone = proposal?.status === "applied" ? "ok" : proposal?.status === "ready" ? dirty ? "warn" : "info" : proposal?.error ? "error" : "info";
  return <Layout contentClassName="plan-review">
    <BackLink to="/coach">Back to Coach</BackLink>
    <PageHeading eyebrow="Your routine, made actionable" title="Review your plan" description="Review the complete routine before making it active. Previous versions and workouts stay in history." />
    {error && <Notice tone="error" className="review-notice"><p role="alert">{error}</p></Notice>}
    {!proposal ? <button type="button" className="btn btn--secondary" onClick={() => setRetry(v => v + 1)}>Load plan draft</button> : <>
      <Notice tone={statusTone} className="review-notice"><div className="review-status"><p role="status">{statusText}</p>{proposal.status === "applied" && <Link to="/" className="btn btn--primary btn--sm">Open my plan</Link>}</div></Notice>
      {proposal.stale && <Notice tone="warn" className="review-notice">Your active plan changed. Ask Coach below to review this draft against the current version.</Notice>}
      {missingFavorites.length > 0 && <Notice tone="warn" className="review-notice">Requested exercises missing from this draft: {missingFavorites.join(", ")}. Restore them before applying.</Notice>}
      {edited && <><div className="review-grid">
        <aside className="card review-changes" aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="section-title">What changed</h2>
          {counts.length > 0 && <p className="change-counts">{counts.map(([label, n]) => <span key={label} className={`tag change-tag change-tag--${label.toLowerCase()}`}>{label} <span className="num">{n}</span></span>)}</p>}
          <ul className="plan-changes">{changes.map((c, i) => <li key={i} className={`plan-change plan-change--${c.label.toLowerCase()}`}><p className="plan-change-title"><span className="plan-change-label">{c.label}:</span> {c.name}</p><p className="plan-change-detail">{c.detail}</p></li>)}</ul>
          {proposal.keep_exercises.length > 0 && <p className="keep-list"><span className="muted">Requested to keep:</span> {proposal.keep_exercises.join(", ")}</p>}
        </aside>
        <section className="review-editor" aria-label="Edit the draft">
          <PlanEditor plan={edited} onChange={edit} disabled={busy || proposal.status !== "ready"} />
        </section>
      </div>
      {proposal.status === "ready" && <div className="action-bar review-bar">
        <p className="action-bar-text">Started workouts keep their original plan snapshot.</p>
        <div className="action-bar-actions">
          <button type="button" className="btn btn--secondary" disabled={busy || !dirty} onClick={save}>Save draft edits</button>
          <button type="button" className="btn btn--primary" disabled={busy || dirty || proposal.stale || missingFavorites.length > 0} onClick={apply}>{busy ? <><span className="spinner" aria-hidden="true" />Saving…</> : "Save as my active plan"}</button>
        </div>
      </div>}</>}
      <section className="card review-adjust" aria-labelledby="adjust-heading">
        <h2 id="adjust-heading" className="section-title"><IconSparkles size={20} stroke={1.75} className="text-accent-text" aria-hidden="true" />Ask Coach to adjust</h2>
        <label className="field"><span className="field-label">Changes to make</span><textarea className="textarea" value={instructions} onChange={e => setInstructions(e.target.value)} maxLength={6000} /></label>
        <div className="row">
          <button type="button" className="btn btn--secondary" disabled={busy || dirty || !instructions.trim()} onClick={refine}>Create revised draft</button>
          <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => setRetry(v => v + 1)}><IconRefresh size={16} aria-hidden="true" />Reload saved draft</button>
        </div>
      </section>
    </>}
  </Layout>;
}
