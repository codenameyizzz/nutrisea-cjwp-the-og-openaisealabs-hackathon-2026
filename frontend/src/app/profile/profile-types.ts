export type Goal = "turun-berat-badan" | "maintain" | "otot";
export type Allergy = string;
import type { AccountProfile } from "../../services/account-session";
import { healthProfilePayload, validateOnboardingProfile } from "../../services/onboarding-contract";

export const ALLERGY_LABELS: Record<string, string> = {
  kacang: "Peanuts", seafood: "Seafood", dairy: "Dairy", egg: "Eggs", soy: "Soy", wheat: "Wheat",
};

export function profilePayload(profile: NutriSeaProfile, existing: AccountProfile | null) {
  if (!profile.goal) throw new Error("Select a goal.");
  const draft = { ...profile, goal: profile.goal };
  const error = validateOnboardingProfile(draft, "undisclosed");
  if (error) throw new Error(error);
  return healthProfilePayload(draft, "reported", "", existing);
}

export function profileFormValue(profile: AccountProfile): NutriSeaProfile {
  return { age: String(profile.age), gender: profile.sex === "M" ? "laki-laki" : "perempuan",
    heightCm: String(profile.height_cm), weightKg: String(profile.weight_kg), occupation: profile.occupation || "",
    goal: profile.goal === "GAIN_MUSCLE" ? "otot" : profile.goal === "LOSE_WEIGHT" ? "turun-berat-badan" : "maintain",
    allergies: [...profile.allergies],
    mealBudget: String(profile.meal_budget_idr) };
}

export interface NutriSeaProfile {
  age: string;
  gender: "" | "laki-laki" | "perempuan";
  heightCm: string;
  weightKg: string;
  occupation: string;
  goal: "" | Goal;
  allergies: Allergy[];
  mealBudget: string;
}

export function isNutriSeaProfile(value: unknown): value is NutriSeaProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<NutriSeaProfile>;
  return (
    typeof profile.age === "string" &&
    (profile.gender === "" ||
      profile.gender === "laki-laki" ||
      profile.gender === "perempuan") &&
    typeof profile.heightCm === "string" &&
    typeof profile.weightKg === "string" &&
    typeof profile.occupation === "string" &&
    (profile.goal === "" ||
      profile.goal === "turun-berat-badan" ||
      profile.goal === "otot" ||
      profile.goal === "maintain") &&
    Array.isArray(profile.allergies) &&
    profile.allergies.every(
      (allergy) => typeof allergy === "string",
    ) &&
    typeof profile.mealBudget === "string"
  );
}
