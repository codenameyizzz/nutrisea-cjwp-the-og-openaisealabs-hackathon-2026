export type Goal = "turun-berat-badan" | "maintain";
export type Allergy = "kacang" | "seafood";

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
