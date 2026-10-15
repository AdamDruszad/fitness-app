import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import client from "../api/client";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import PlanEditor from "../components/PlanEditor";
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
  return <Layout><Link to="/coach" className="text-link">Back to Coach</Link><PageHeading eyebrow="Your routine, made actionable" title="Review your plan" description="Review the complete routine before making it active. Previous versions and workouts stay in history." />
    {error && <p role="alert" className="continuity-error">{error}</p>}
    {!proposal ? <button className="fitai-secondary-button" onClick={() => setRetry(v => v + 1)}>Load plan draft</button> : <>
      <p role="status">{proposal.status === "applied" ? "Plan saved. Future workouts use the activated version." : proposal.status === "ready" ? dirty ? "Draft edits are not saved yet." : "Draft saved. Your active plan has not changed." : proposal.error || "Preparing your draft. Reload to check its status."}</p>
      {proposal.status === "applied" && <Link to="/" className="fitai-primary-button">Open my plan</Link>}
      {proposal.stale && <p className="continuity-error">Your active plan changed. Ask Coach below to review this draft against the current version.</p>}
      {missingFavorites.length > 0 && <p className="continuity-error">Requested exercises missing from this draft: {missingFavorites.join(", ")}. Restore them before applying.</p>}
      {edited && <><div className="review-grid"><aside className="continuity-card"><h2>What changed</h2><ul className="plan-changes">{planChanges(proposal.base_plan?.plan_data, edited).map((c, i) => <li key={i}><strong>{c.label}: {c.name}</strong><p>{c.detail}</p></li>)}</ul>{proposal.keep_exercises.length > 0 && <p>Requested to keep: {proposal.keep_exercises.join(", ")}</p>}</aside><PlanEditor plan={edited} onChange={edit} disabled={busy || proposal.status !== "ready"} /></div>
      {proposal.status === "ready" && <div className="workout-savebar"><p>Started workouts keep their original plan snapshot.</p><button className="fitai-secondary-button" disabled={busy || !dirty} onClick={save}>Save draft edits</button><button className="fitai-primary-button" disabled={busy || dirty || proposal.stale || missingFavorites.length > 0} onClick={apply}>{busy ? "Saving…" : "Save as my active plan"}</button></div>}</>}
      <section className="continuity-card"><h2>Ask Coach to adjust</h2><label>Changes to make<textarea value={instructions} onChange={e => setInstructions(e.target.value)} maxLength={6000} /></label><button className="fitai-secondary-button" disabled={busy || dirty || !instructions.trim()} onClick={refine}>Create revised draft</button><button className="text-link" disabled={busy} onClick={() => setRetry(v => v + 1)}>Reload saved draft</button></section>
    </>}
  </Layout>;
}
