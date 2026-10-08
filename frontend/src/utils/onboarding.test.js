import test from "node:test";
import assert from "node:assert/strict";
import { onboardingFormFromProfile, validateOnboardingStep } from "./onboarding.js";
import { apiError } from "./apiError.js";

const completeProfile = {
  goal: "strength", level: "beginner", days_per_week: 3, equipment: "none",
  age: 25, gender: "other", weight_kg: 70.5, injuries: "",
};

test("all completed steps accept a valid profile with optional empty injury notes", () => {
  for (let step = 0; step < 6; step++) assert.equal(validateOnboardingStep(completeProfile, step), null);
});

test("each required choice must be recognized before advancing", () => {
  for (const [step, field] of [[0, "goal"], [1, "level"], [2, "days_per_week"], [3, "equipment"]]) {
    for (const value of ["", null, "unexpected"]) {
      assert.equal(validateOnboardingStep({ ...completeProfile, [field]: value }, step).field, field);
    }
  }
  assert.equal(validateOnboardingStep({ ...completeProfile, days_per_week: "4" }, 2), null);
  assert.equal(validateOnboardingStep({ ...completeProfile, days_per_week: 3.5 }, 2).field, "days_per_week");
});

test("biometrics reject empty, fractional ages, and out-of-range input", () => {
  for (const age of ["", "not a number", 9, 121, 25.5, Infinity]) {
    assert.equal(validateOnboardingStep({ ...completeProfile, age }, 4).field, "age");
  }
  for (const weight_kg of ["", "not a number", 19.9, 300.1, Infinity]) {
    assert.equal(validateOnboardingStep({ ...completeProfile, weight_kg }, 4).field, "weight_kg");
  }
  assert.equal(validateOnboardingStep({ ...completeProfile, gender: "" }, 4).field, "gender");
});

test("biometric boundaries and decimal weights are valid", () => {
  for (const age of [10, 120, "25"]) {
    for (const weight_kg of [20, 300, "75.5"]) {
      assert.equal(validateOnboardingStep({ ...completeProfile, age, weight_kg }, 4), null);
    }
  }
});

test("profile loading preserves saved preferences and fills only missing values", () => {
  assert.deepEqual(onboardingFormFromProfile(completeProfile), completeProfile);
  assert.deepEqual(onboardingFormFromProfile({}), {
    goal: "", level: "", days_per_week: 3, equipment: "", age: "", gender: "", weight_kg: "", injuries: "",
  });
  assert.equal(onboardingFormFromProfile({ days_per_week: 0 }).days_per_week, 0);
});

test("API validation arrays become readable text without rendering objects", () => {
  const error = { response: { data: { detail: [
    { loc: ["body", "weight_kg"], msg: "Enter a valid number" },
    { loc: ["body", "age"], msg: "Required" },
    null, { msg: 123 },
  ] } } };
  assert.equal(apiError(error), "weight kg: Enter a valid number. age: Required");
});

test("API errors preserve useful messages and fall back for unknown shapes", () => {
  assert.equal(apiError({ response: { data: { detail: "Email already registered" } } }), "Email already registered");
  for (const detail of [null, "  ", [], [{}], [{ msg: "  " }], { message: "Unknown" }]) {
    assert.equal(apiError({ response: { data: { detail } } }, "Try again"), "Try again");
  }
  assert.equal(apiError(null, "Try again"), "Try again");
});
