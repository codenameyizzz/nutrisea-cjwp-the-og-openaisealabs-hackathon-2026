import assert from "node:assert/strict";
import test from "node:test";
import type { AccountProfile } from "../../services/account-session";
import { isNutriSeaProfile, profileFormValue, profilePayload } from "./profile-types";

const saved: AccountProfile = { age: 29, sex: "F", height_cm: 162.5, weight_kg: 58.2, occupation: null,
  goal: "GAIN_MUSCLE", allergies: ["egg", "dairy", "soy", "wheat", "kacang", "seafood", "legacy-allergen"],
  meal_budget_idr: 35001, activity_level: "ACTIVE", has_medical_condition: true, max_dinner_cut_pct: 10, kcal_target: 2100 };

test("editing a profile round-trips muscle goal and every known or legacy allergy", () => {
  const draft = profileFormValue(saved);
  assert(isNutriSeaProfile(draft));
  const payload = profilePayload(draft, saved);
  assert.equal(payload.goal, "GAIN_MUSCLE");
  assert.deepEqual(payload.allergies, saved.allergies);
  assert.notEqual(draft.allergies, saved.allergies);
  assert.equal(payload.activity_level, "ACTIVE");
  assert.equal(payload.has_medical_condition, true);
  assert.equal(payload.max_dinner_cut_pct, 10);
});

test("editing one allergy preserves unrelated tokens and valid decimal measurements", () => {
  const draft = profileFormValue(saved);
  draft.allergies = draft.allergies.filter(item => item !== "egg");
  const payload = profilePayload(draft, saved);
  assert.deepEqual(payload.allergies, saved.allergies.filter(item => item !== "egg"));
  assert.equal(payload.height_cm, 162.5);
  assert.equal(payload.weight_kg, 58.2);
  assert.equal(payload.meal_budget_idr, 35001);
  assert.equal(saved.allergies.length, 7);
});

test("profile edits reject backend-invalid fields before saving", () => {
  const draft = profileFormValue(saved);
  for (const invalid of [{ age: "17" }, { age: "29.5" }, { heightCm: "119" }, { weightKg: "NaN" }, { mealBudget: "4999" }, { mealBudget: "5000.5" }, { goal: "" as const }]) {
    assert.throws(() => profilePayload({ ...draft, ...invalid }, saved));
  }
  assert.doesNotThrow(() => profilePayload({ ...draft, occupation: "", allergies: [] }, saved));
});
