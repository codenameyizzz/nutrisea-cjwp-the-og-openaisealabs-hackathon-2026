import type { AccountProfile } from "./account-session";

export type AllergyStatus = "reported" | "none" | "undisclosed" | "";
export interface OnboardingProfile {
  age: string;
  gender: "laki-laki" | "perempuan" | "";
  heightCm: string;
  weightKg: string;
  occupation: string;
  goal: "maintain" | "turun-berat-badan" | "otot";
  allergies: string[];
  mealBudget: string;
}

export const NO_RESTRICTIONS = "I don't have any specific dietary restrictions.";
export const UNDISCLOSED = "Prefer not to say.";

export function toggleDietaryNeed(current: string[], value: string): string[] {
  if (value === NO_RESTRICTIONS || value === UNDISCLOSED) return [value];
  const selected = current.filter(item => item !== NO_RESTRICTIONS && item !== UNDISCLOSED);
  return selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
}

export function needsDietaryFollowUp(selected: string[]): boolean {
  return selected.some(value => value !== NO_RESTRICTIONS && value !== UNDISCLOSED);
}

export function profileAnswers(profile: OnboardingProfile) {
  const age = Number(profile.age);
  const budget = Number(profile.mealBudget);
  return {
    q5: !profile.mealBudget || !Number.isFinite(budget) ? "" : budget < 25000 ? "Under Rp25,000"
      : budget <= 35000 ? "Rp25,000–Rp35,000" : budget <= 45000 ? "Rp35,001–Rp45,000" : "More than Rp45,000",
    q7: !profile.age || !Number.isFinite(age) ? "Prefer not to say" : age < 21 ? "Under 21"
      : age <= 27 ? "21–27" : age <= 33 ? "28–33" : age <= 48 ? "34–48" : "49 or older",
  };
}

export function validateOnboardingProfile(profile: OnboardingProfile, allergyStatus: AllergyStatus): string | null {
  const range = (value: string, min: number, max: number) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
  if (!range(profile.age, 18, 100) || !Number.isInteger(Number(profile.age))) return "Enter an age between 18 and 100 years.";
  if (!profile.gender) return "Select sex for the energy calculation.";
  if (!range(profile.heightCm, 120, 230)) return "Enter a height between 120 and 230 cm.";
  if (!range(profile.weightKg, 30, 250)) return "Enter a weight between 30 and 250 kg.";
  if (!range(profile.mealBudget, 5000, Number.MAX_SAFE_INTEGER) || !Number.isInteger(Number(profile.mealBudget))) return "Enter a budget in rupiah, at least Rp5,000.";
  if (profile.occupation.length > 100) return "Enter an occupation using no more than 100 characters.";
  if (!allergyStatus) return "Enter your allergy information, or choose not to answer.";
  if (allergyStatus === "reported" && profile.allergies.length === 0) return "Select at least one known food allergy.";
  return null;
}

export function activityFromAnswer(answer: string, existing?: string): string {
  if (answer === "Mostly sitting; little planned exercise") return "SEDENTARY";
  if (answer === "Light activity or occasional exercise") return "LIGHT";
  if (answer === "Moderate activity or regular exercise") return "MODERATE";
  if (answer === "Very active or frequent intense exercise") return "ACTIVE";
  return existing || "LIGHT";
}

export function healthProfilePayload(profile: OnboardingProfile, allergyStatus: AllergyStatus, activity: string, existing: AccountProfile | null) {
  return {
    age: Number(profile.age), sex: profile.gender === "perempuan" ? "F" : "M",
    height_cm: Number(profile.heightCm), weight_kg: Number(profile.weightKg), occupation: profile.occupation,
    activity_level: activityFromAnswer(activity, existing?.activity_level),
    goal: profile.goal === "otot" ? "GAIN_MUSCLE" : profile.goal === "turun-berat-badan" ? "LOSE_WEIGHT" : "MAINTAIN",
    allergies: allergyStatus === "undisclosed" ? [...(existing?.allergies || [])] : allergyStatus === "none" ? [] : [...profile.allergies],
    meal_budget_idr: Number(profile.mealBudget),
    // A questionnaire preference is not a diagnosis; preserve any existing medical flag.
    ...(existing ? { has_medical_condition: existing.has_medical_condition, max_dinner_cut_pct: existing.max_dinner_cut_pct } : {}),
  };
}

export function profileSignature(profile: Partial<AccountProfile> | null): string {
  if (!profile) return "null";
  return JSON.stringify([profile.age, profile.sex, profile.height_cm, profile.weight_kg, profile.occupation ?? "",
    profile.activity_level, profile.goal, [...(profile.allergies || [])].sort(), profile.meal_budget_idr,
    profile.has_medical_condition, profile.max_dinner_cut_pct]);
}
