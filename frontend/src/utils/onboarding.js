/** Validate the visible step before moving on or submitting profile changes. */
export function validateOnboardingStep(form, step) {
  if (step === 0 && !["muscle_gain", "fat_loss", "strength", "general"].includes(form.goal)) {
    return { field: "goal", message: "Choose your training goal to continue." };
  }
  if (step === 1 && !["beginner", "intermediate", "advanced"].includes(form.level)) {
    return { field: "level", message: "Choose your experience level to continue." };
  }
  if (step === 2 && ![2, 3, 4, 5, 6].includes(Number(form.days_per_week))) {
    return { field: "days_per_week", message: "Choose between 2 and 6 training days." };
  }
  if (step === 3 && !["gym", "home", "none"].includes(form.equipment)) {
    return { field: "equipment", message: "Choose the equipment available to you." };
  }
  if (step === 4) {
    const age = Number(form.age);
    const weight = Number(form.weight_kg);
    if (!Number.isInteger(age) || age < 10 || age > 120) {
      return { field: "age", message: "Enter your age as a whole number between 10 and 120." };
    }
    if (!Number.isFinite(weight) || weight < 20 || weight > 300) {
      return { field: "weight_kg", message: "Enter a weight between 20 and 300 kg." };
    }
    if (!["male", "female", "other"].includes(form.gender)) {
      return { field: "gender", message: "Choose a gender option to continue." };
    }
  }
  return null;
}

/** Preserve stored values, including intentional empty notes, when loading a profile. */
export function onboardingFormFromProfile(profile) {
  return {
    goal: profile.goal ?? "",
    level: profile.level ?? "",
    days_per_week: profile.days_per_week ?? 3,
    equipment: profile.equipment ?? "",
    age: profile.age ?? "",
    gender: profile.gender ?? "",
    weight_kg: profile.weight_kg ?? "",
    injuries: profile.injuries ?? "",
  };
}
