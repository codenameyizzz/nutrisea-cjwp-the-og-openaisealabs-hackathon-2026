import type { AccountProfile } from "@/services/account-session";
interface BmiInputs { age: number; gender: "wanita" | "pria"; height: number; weight: number; activity: "sedentary" | "light" | "active"; goal: "turun" | "ideal" | "otot" }
export function bmiProfileUpdate(input: BmiInputs, latest: AccountProfile, original: AccountProfile | null) {
  if (original && (["age", "sex", "height_cm", "weight_kg", "activity_level", "goal"] as const).some(key => latest[key] !== original[key])) {
    throw new Error("Your profile changed in another session. These changes have not been saved. Reload the page to review the latest data.");
  }
  const originalActivity = original?.activity_level === "SEDENTARY" ? "sedentary" : original?.activity_level === "LIGHT" ? "light" : "active";
  return { age: input.age, sex: input.gender === "pria" ? "M" : "F", height_cm: input.height, weight_kg: input.weight,
    activity_level: original && input.activity === originalActivity ? latest.activity_level : input.activity.toUpperCase(),
    goal: input.goal === "turun" ? "LOSE_WEIGHT" : input.goal === "otot" ? "GAIN_MUSCLE" : "MAINTAIN",
    allergies: latest.allergies, meal_budget_idr: latest.meal_budget_idr,
    has_medical_condition: latest.has_medical_condition, max_dinner_cut_pct: latest.max_dinner_cut_pct };
}
