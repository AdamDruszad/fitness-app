/**
 * @file Onboarding.jsx
 * @description Multi-step interactive onboarding wizard.
 * Collects user fitness goals, experience level, weekly availability, equipment access,
 * physical biometrics (age, gender, weight), and injuries/limitations.
 * Once completed, updates the user profile via PUT /users/me and immediately triggers
 * AI workout plan generation via POST /plans/generate.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import client from "../api/client";

// Steps in the onboarding flow sequence
const STEPS = ["Goal", "Level", "Days per week", "Equipment", "Biometrics", "Injuries"];

export default function Onboarding() {
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    goal: "",
    level: "",
    days_per_week: 3,
    equipment: "",
    age: "",
    gender: "",
    weight_kg: "",
    injuries: ""
  });
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [genderOpen, setGenderOpen] = useState(false);
  const navigate = useNavigate();

  // Helper to update specific form field state
  const update = (field, value) => setForm((prevForm) => ({ ...prevForm, [field]: value }));

  /**
   * Pre-populates the form with existing user data if previously saved (e.g. from settings).
   */
  useEffect(() => {
    client.get('/users/me')
      .then((r) => {
        const d = r.data;
        if (d) {
          setForm((prev) => ({
            ...prev,
            goal: d.goal || "",
            level: d.level || "",
            days_per_week: d.days_per_week || 3,
            equipment: d.equipment || "",
            age: d.age || "",
            gender: d.gender || "",
            weight_kg: d.weight_kg || "",
            injuries: d.injuries || ""
          }));
        }
      })
      .catch(() => {})
      .finally(() => setInitLoading(false));
  }, []);

  const genderOptions = [
    { value: 'male', label: '♂️ Male' },
    { value: 'female', label: '♀️ Female' },
    { value: 'other', label: '⚧ Other' },
  ];

  /**
   * Reusable option button group component for step selection.
   */
  const BtnGroup = ({ field, options }) => {
    return (
      <div className="grid grid-cols-2 gap-3 mt-4">
        {options.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => { update(field, opt.value); }}
            className={`py-3 rounded-xl border-2 font-medium transition ${
              form[field] === opt.value
                ? 'border-brand-accent bg-brand-accent/20 text-text-main'
                : 'border-border-subtle text-text-muted hover:border-text-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  };

  /**
   * Submits profile updates to backend and initiates plan generation.
   */
  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      // 1. Update user profile biometrics and fitness preferences
      await client.put("/users/me", {
        age: parseInt(form.age, 10),
        days_per_week: parseInt(form.days_per_week, 10),
        equipment: form.equipment,
        gender: form.gender,
        weight_kg: parseFloat(form.weight_kg),
        injuries: form.injuries,
        goal: form.goal,
        level: form.level
      });

      // 2. Trigger AI service to generate personalized workout plan
      await client.post("/plans/generate");

      // 3. Navigate to Dashboard to view the created plan
      navigate("/");
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to save progress");
    } finally {
      setLoading(false);
    }
  };

  // Step view components rendered conditionally based on active step index
  const steps = [
    // Step 0: Fitness Goal
    <div key={0}>
      <h2 className="text-xl font-bold text-text-main mb-2">What's your goal?</h2>
      <BtnGroup
        field="goal"
        options={[
          { value: 'muscle_gain', label: '💪 Build Muscle' },
          { value: 'fat_loss', label: '🔥 Lose Fat' },
          { value: 'strength', label: '🏋️ Get Stronger' },
          { value: 'general', label: '⚡ General Fitness' }
        ]}
      />
    </div>,

    // Step 1: Experience Level
    <div key={1}>
      <h2 className="text-xl font-bold text-text-main mb-2">What's your experience level?</h2>
      <BtnGroup
        field="level"
        options={[
          { value: 'beginner', label: '🌱 Beginner' },
          { value: 'intermediate', label: '📈 Intermediate' },
          { value: 'advanced', label: '🔝 Advanced' },
        ]}
      />
    </div>,

    // Step 2: Training Days Per Week
    <div key={2}>
      <h2 className="text-xl font-bold text-text-main mb-2">Days per week?</h2>
      <div className="flex gap-3 mt-4">
        {[2, 3, 4, 5, 6].map((d) => (
          <button
            type="button"
            key={d}
            onClick={() => update('days_per_week', d)}
            className={`flex-1 py-3 rounded-xl border-2 font-bold text-lg transition ${
              form.days_per_week === d
                ? 'border-brand-accent bg-brand-accent/20 text-text-main'
                : 'border-border-subtle text-text-muted hover:border-text-muted'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Equipment Availability
    <div key={3}>
      <h2 className="text-xl font-bold text-text-main mb-2">What's your equipment?</h2>
      <BtnGroup
        field="equipment"
        options={[
          { value: 'gym', label: '🏟️ Full Gym' },
          { value: 'home', label: '🏠 Home Equipment' },
          { value: 'none', label: '🤸 No Equipment' },
        ]}
      />
    </div>,

    // Step 4: Biometrics (Age, Weight, Gender)
    <div key={4} className="grid grid-cols-1 gap-3">
      <h2 className="text-xl font-bold text-text-main mb-2">Please enter your biometrics</h2>
      <input
        type="number"
        min="10"
        max="120"
        placeholder="Age"
        value={form.age}
        onChange={(e) => update('age', e.target.value)}
        className="w-full bg-input/70 text-text-main rounded-lg px-4 py-3 outline-none ring-1 ring-border-subtle focus:ring-2 focus:ring-brand-accent"
      />
      <input
        type="number"
        min="20"
        max="300"
        placeholder="Weight (kg)"
        value={form.weight_kg}
        onChange={(e) => update('weight_kg', e.target.value)}
        className="w-full bg-input/70 text-text-main rounded-lg px-4 py-3 outline-none ring-1 ring-border-subtle focus:ring-2 focus:ring-brand-accent"
      />
      <div>
        <button
          type="button"
          onClick={() => setGenderOpen(!genderOpen)}
          onBlur={() => setTimeout(() => setGenderOpen(false), 150)}
          className="w-full bg-input/70 text-left rounded-lg px-4 py-3 ring-1 ring-border-subtle focus:ring-2 focus:ring-brand-accent transition flex items-center justify-between"
        >
          <span className={form.gender ? 'text-text-main' : 'text-text-muted'}>
            {form.gender ? genderOptions.find((opt) => opt.value === form.gender)?.label : 'Select gender'}
          </span>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${genderOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {genderOpen && (
          <div className="mt-2 grid grid-cols-1 gap-2">
            {genderOptions.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => { update('gender', opt.value); setGenderOpen(false); }}
                className={`py-3 rounded-xl border-2 font-medium transition ${
                  form.gender === opt.value
                    ? 'border-brand-accent bg-brand-accent/20 text-text-main'
                    : 'border-border-subtle text-text-muted hover:border-text-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,

    // Step 5: Injuries & Physical Restrictions
    <div key={5}>
      <h2 className="text-xl font-bold text-text-main mb-2">Do you have any injuries?</h2>
      <textarea
        name="injuries"
        placeholder="List any injuries or limitations (e.g. lower back pain, knee issues)"
        value={form.injuries}
        onChange={(e) => { update("injuries", e.target.value); }}
        className="h-28 resize-none w-full bg-input text-text-main rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </div>
  ];

  if (initLoading) return null;

  return (
    <div className="bg-base min-h-screen flex justify-center items-center py-8 px-4 relative overflow-hidden">
      {/* Decorative background grid and gradient light orbs */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-grid-line) 2px, transparent 2px), linear-gradient(to bottom, var(--color-grid-line) 2px, transparent 2px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/40 rounded-full blur-3xl pointer-events-none" />

      {/* Onboarding Wizard Card */}
      <div className="bg-surface rounded-2xl p-8 w-full max-w-sm border border-border-subtle relative z-10">
        {/* Progress step indicators */}
        <div className="flex gap-1 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition ${
                i <= step ? 'bg-brand-accent' : 'bg-border-subtle'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm -mt-1">{error}</p>}

        <p className="text-text-muted text-sm mb-1">Step {step + 1} of {STEPS.length}</p>
        
        {/* Current Active Step */}
        {steps[step]}

        {/* Wizard Navigation Buttons */}
        <div className="flex gap-2 mt-5">
          {step > 0 && (
            <button
              disabled={loading}
              className="border border-border-subtle rounded-lg py-2 px-4 font-medium text-text-main hover:bg-surface/50 transition cursor-pointer disabled:opacity-50"
              type="button"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              disabled={loading}
              className="border border-border-subtle bg-brand-accent rounded-lg py-2 px-4 font-medium text-text-main hover:bg-brand-accent/50 transition cursor-pointer disabled:opacity-50"
              type="button"
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              disabled={loading}
              className="border border-border-subtle bg-brand-accent rounded-lg py-2 px-4 font-medium text-text-main hover:bg-brand-accent/50 transition cursor-pointer disabled:opacity-50"
              type="button"
              onClick={handleSubmit}
            >
              {loading ? "Generating..." : "Generate my plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}