export type Goal = "turun-berat-badan" | "maintain";
export type Allergy = "kacang" | "seafood";
import type { AccountProfile } from "../../services/account-session";

export function profileFormValue(profile: AccountProfile): NutriSeaProfile {
  return { age: String(profile.age), gender: profile.sex === "M" ? "laki-laki" : "perempuan",
    heightCm: String(profile.height_cm), weightKg: String(profile.weight_kg), occupation: profile.occupation || "",
    goal: profile.goal === "LOSE_WEIGHT" ? "turun-berat-badan" : "maintain",
    allergies: profile.allergies.filter((value): value is Allergy => value === "kacang" || value === "seafood"),
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
      profile.goal === "maintain") &&
    Array.isArray(profile.allergies) &&
    profile.allergies.every(
      (allergy) => allergy === "kacang" || allergy === "seafood",
    ) &&
    typeof profile.mealBudget === "string"
  );
}
