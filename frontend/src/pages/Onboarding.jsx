import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { IconArrowLeft, IconArrowRight, IconCheck, IconSparkles } from "@tabler/icons-react";
import client from "../api/client";
import Layout from "../components/Layout";
import PageHeading from "../components/PageHeading";
import InstallHelp from "../components/InstallHelp";
import { BackLink, Notice, LoadingLine } from "../components/ui";
import { apiError } from "../utils/apiError";
import { onboardingFormFromProfile, validateOnboardingStep } from "../utils/onboarding";

const STEPS = ["Goal", "Experience", "Schedule", "Equipment", "About you", "Review"];
const GOALS = [
  { value: "muscle_gain", label: "Build muscle", description: "Train for size and definition" },
  { value: "fat_loss", label: "Lose fat", description: "Build a consistent routine" },
  { value: "strength", label: "Get stronger", description: "Focus on strength" },
  { value: "general", label: "General fitness", description: "Move more and feel fitter" },
];
const LEVELS = [
  { value: "beginner", label: "Beginner", description: "New to regular training" },
  { value: "intermediate", label: "Intermediate", description: "Comfortable with the basics" },
  { value: "advanced", label: "Advanced", description: "An established training routine" },
];
const EQUIPMENT = [
  { value: "gym", label: "Full gym", description: "Machines and free weights" },
  { value: "home", label: "Home equipment", description: "Your own training setup" },
  { value: "none", label: "No equipment", description: "Bodyweight exercises" },
];

function ChoiceGroup({ field, options, value, onChange, invalid }) {
  return (
    <div className="choice-grid" role="group" aria-labelledby="step-heading" aria-describedby={invalid ? "onboarding-error" : undefined}>
      {options.map((option, index) => (
        <button
          id={index === 0 ? field : undefined}
          type="button"
          key={option.value}
          aria-pressed={value === option.value}
          onClick={() => onChange(field, option.value)}
          className="choice"
        >
          <span className="choice-mark" aria-hidden="true">{value === option.value && <IconCheck size={14} stroke={3} />}</span>
          <span className="choice-label">{option.label}</span>
          <span className="choice-description">{option.description}</span>
        </button>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const [form, setForm] = useState(() => onboardingFormFromProfile({}));
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [initLoading, setInitLoading] = useState(true);
  const [initError, setInitError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);
  const [phase, setPhase] = useState("");
  const submissionInFlight = useRef(false);
  const headingRef = useRef(null);
  const navigate = useNavigate();
  const loading = phase !== "";

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    client.get("/users/me", { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Missing profile");
        setForm(onboardingFormFromProfile(data));
        setHasSavedPreferences(Boolean(data.goal));
      })
      .catch(() => {
        if (active) setInitError("We couldn't load your saved preferences. Retry to continue with your existing details.");
      })
      .finally(() => {
        if (active) setInitLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [loadAttempt]);

  function retryLoad() {
    setInitError("");
    setInitLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }

  function update(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
    setInvalidField("");
  }

  function checkStep(stepToCheck) {
    const issue = validateOnboardingStep(form, stepToCheck);
    if (!issue) return true;
    setStep(stepToCheck);
    setError(issue.message);
    setInvalidField(issue.field);
    requestAnimationFrame(() => document.getElementById(issue.field)?.focus());
    return false;
  }

  function goToStep(next) {
    setError("");
    setInvalidField("");
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function handleSubmit(event, preferencesOnly = false) {
    event.preventDefault();
    if (submissionInFlight.current || initLoading || initError) return;
    if (step < STEPS.length - 1) {
      if (checkStep(step)) goToStep(step + 1);
      return;
    }
    for (let index = 0; index < STEPS.length; index++) {
      if (!checkStep(index)) return;
    }
    submissionInFlight.current = true;
    setError("");
    setPhase("saving");
    let preferencesSaved = false;
    try {
      await client.put("/users/me", {
        ...form,
        age: Number(form.age),
        days_per_week: Number(form.days_per_week),
        weight_kg: Number(form.weight_kg),
      });
      preferencesSaved = true;
      setHasSavedPreferences(true);
      if (preferencesOnly) { navigate("/"); return; }
      setPhase("generating");
      let base = null;
      try { base = (await client.get("/plans/current")).data; } catch (e) { if (e.response?.status !== 404) throw e; }
      const { data } = await client.post("/plans/proposals", { request_id: crypto.randomUUID(), base_plan_id: base?.id || null, instructions: "Create a complete routine using my saved preferences. Preserve useful exercises from my current plan where appropriate." }, { timeout: 120000 });
      navigate(`/plans/proposals/${data.id}`);
    } catch (failure) {
      const detail = apiError(failure, "Please try again.");
      setError(preferencesSaved
        ? `Your preferences were saved, but we couldn't generate a plan. ${detail}`
        : `We couldn't save your preferences. ${detail}`);
    } finally {
      submissionInFlight.current = false;
      setPhase("");
    }
  }

  const titles = ["What would you like to work toward?", "What's your experience level?", "How often can you train?", "What equipment do you have?", "A little about you", "Review your preferences"];
  const descriptions = ["Choose the main focus for your training.", "We'll use this to tailor your plan to your experience.", "Choose a weekly schedule you can keep up with.", "Your plan will use the equipment available to you.", "These details help personalize your training plan.", "Add any limitations, then check your details before generating a plan."];
  const selectedLabel = (options, value) => options.find((option) => option.value === value)?.label || "Not selected";

  return (
    <Layout contentClassName="onboarding">
      <BackLink to="/">Back to your plan</BackLink>
      <PageHeading eyebrow="Make it yours" title={hasSavedPreferences ? "Training preferences" : "Build your training plan"} description="A plan that fits your goals, schedule, and equipment.">
        <Link to="/coach" className="btn btn--quiet"><IconSparkles size={18} stroke={1.75} aria-hidden="true" />Already have a routine? Improve it with Coach</Link>
      </PageHeading>

      {initLoading ? (
        <LoadingLine>Loading your preferences...</LoadingLine>
      ) : initError ? (
        <Notice tone="error">
          <p role="alert">{initError}</p>
          <button type="button" onClick={retryLoad} className="btn btn--primary btn--sm">Retry loading</button>
        </Notice>
      ) : (
        <div className="onboarding-grid">
          <nav aria-label="Setup progress" className="stepper">
            <ol>
              {STEPS.map((label, index) => (
                <li key={label} aria-current={index === step ? "step" : undefined} className={index < step ? "is-done" : index === step ? "is-current" : undefined}>
                  <span aria-hidden="true" className="stepper-mark">{index < step ? <IconCheck size={14} stroke={3} /> : <span className="num">{index + 1}</span>}</span>
                  <span className="stepper-label">{label}<span className="sr-only">{index < step ? " — completed" : ""}</span></span>
                </li>
              ))}
            </ol>
          </nav>

          <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="card onboarding-form">
            <p className="eyebrow">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
            <h2 id="step-heading" ref={headingRef} tabIndex={-1} className="display onboarding-title">{titles[step]}</h2>
            <p className="muted">{descriptions[step]}</p>
            {error && <Notice tone="error" id="onboarding-error" role="alert">{error}</Notice>}

            <fieldset disabled={loading} className="onboarding-fields">
              <legend className="sr-only">{STEPS[step]}</legend>
              {step === 0 && <ChoiceGroup field="goal" options={GOALS} value={form.goal} onChange={update} invalid={invalidField === "goal"} />}
              {step === 1 && <ChoiceGroup field="level" options={LEVELS} value={form.level} onChange={update} invalid={invalidField === "level"} />}
              {step === 2 && (
                <div className="days-picker" role="group" aria-labelledby="step-heading" aria-describedby={invalidField === "days_per_week" ? "onboarding-error" : undefined}>
                  {[2, 3, 4, 5, 6].map((days) => <button key={days} id={days === 2 ? "days_per_week" : undefined} type="button" aria-label={`${days} days per week`} aria-pressed={Number(form.days_per_week) === days} onClick={() => update("days_per_week", days)} className="day-count"><span className="num">{days}</span><span aria-hidden="true">days</span></button>)}
                </div>
              )}
              {step === 3 && <ChoiceGroup field="equipment" options={EQUIPMENT} value={form.equipment} onChange={update} invalid={invalidField === "equipment"} />}
              {step === 4 && (
                <div className="about-grid">
                  <div className="field"><label htmlFor="age" className="field-label">Age</label><input id="age" name="age" type="number" inputMode="numeric" required min="10" max="120" step="1" value={form.age} onChange={(event) => update("age", event.target.value)} aria-invalid={invalidField === "age"} aria-describedby={invalidField === "age" ? "onboarding-error" : undefined} className="input" /></div>
                  <div className="field"><label htmlFor="weight_kg" className="field-label">Weight (kg)</label><input id="weight_kg" name="weight_kg" type="number" inputMode="decimal" required min="20" max="300" step="0.1" value={form.weight_kg} onChange={(event) => update("weight_kg", event.target.value)} aria-invalid={invalidField === "weight_kg"} aria-describedby={invalidField === "weight_kg" ? "onboarding-error" : undefined} className="input" /></div>
                  <div className="field about-wide"><label htmlFor="gender" className="field-label">Gender</label><select id="gender" name="gender" required value={form.gender} onChange={(event) => update("gender", event.target.value)} aria-invalid={invalidField === "gender"} aria-describedby={invalidField === "gender" ? "onboarding-error" : undefined} className="select"><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                </div>
              )}
              {step === 5 && (
                <div className="review-step">
                  <div className="field">
                    <label htmlFor="injuries" className="field-label">Injuries or limitations <span className="optional">(optional)</span></label>
                    <textarea id="injuries" name="injuries" rows={3} value={form.injuries} onChange={(event) => update("injuries", event.target.value)} aria-describedby="injuries-hint" placeholder="Anything your plan should take into account" className="textarea" />
                    <p id="injuries-hint" className="hint">Leave this empty if you have no limitations to add.</p>
                  </div>
                  <dl className="review-list">
                    {[["Goal", selectedLabel(GOALS, form.goal)], ["Experience", selectedLabel(LEVELS, form.level)], ["Schedule", `${form.days_per_week} days per week`], ["Equipment", selectedLabel(EQUIPMENT, form.equipment)], ["Age", `${form.age} years`], ["Weight", `${form.weight_kg} kg`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                  </dl>
                  <p className="muted small">Save your preferences alone, or create a plan draft to review. Your active routine changes only when you apply the reviewed draft.</p>
                </div>
              )}
              <div className="onboarding-actions">
                {step > 0 && <button type="button" onClick={() => goToStep(step - 1)} className="btn btn--secondary"><IconArrowLeft size={16} aria-hidden="true" /> Back</button>}
                {step === 5 && <button type="button" className="btn btn--quiet" disabled={loading} onClick={e => handleSubmit(e, true)}>Save preferences only</button>}
                <button type="submit" className="btn btn--primary onboarding-next" disabled={loading}>
                  {loading && <span className="spinner" aria-hidden="true" />}
                  {phase === "saving" ? "Saving preferences..." : phase === "generating" ? "Generating plan..." : step < STEPS.length - 1 ? "Continue" : hasSavedPreferences ? "Generate new plan" : "Generate my plan"}
                  {!loading && step < STEPS.length - 1 && <IconArrowRight size={16} aria-hidden="true" />}
                </button>
              </div>
            </fieldset>
            <p role="status" className="hint onboarding-status">{phase === "generating" ? "Your preferences are saved. Keep this page open while we create your plan." : phase === "saving" ? "Saving your training preferences..." : ""}</p>
          </form>
        </div>
      )}
      <InstallHelp />
    </Layout>
  );
}
