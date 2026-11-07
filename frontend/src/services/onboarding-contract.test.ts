import assert from "node:assert/strict";
import test from "node:test";
import { activityFromAnswer, healthProfilePayload, needsDietaryFollowUp, NO_RESTRICTIONS, profileAnswers,
  profileSignature, toggleDietaryNeed, UNDISCLOSED, validateOnboardingProfile, type OnboardingProfile } from "./onboarding-contract";
import { ONBOARDING_QUESTIONS } from "./onboarding-questions";
import type { AccountProfile } from "./account-session";
const draft: OnboardingProfile = { age: "26", gender: "perempuan", heightCm: "160", weightKg: "52", occupation: "Engineer", goal: "maintain", allergies: ["egg", "soy"], mealBudget: "35000" };
const saved: AccountProfile = { age: 26, sex: "F", height_cm: 160, weight_kg: 52, occupation: "Engineer", goal: "MAINTAIN", allergies: ["egg", "soy"], meal_budget_idr: 35000, activity_level: "ACTIVE", has_medical_condition: true, max_dinner_cut_pct: 10, kcal_target: 1900 };
test("age and budget boundaries derive exactly the matcher vocabulary", () => {
  for (const [age,expected] of [[18,"Under 21"],[21,"21–27"],[27,"21–27"],[28,"28–33"],[33,"28–33"],[34,"34–48"],[48,"34–48"],[49,"49 or older"]] as const) {
    assert.equal(profileAnswers({...draft, age:String(age)}).q7,expected);
    assert(ONBOARDING_QUESTIONS[6].options.some(option=>option.value===expected));
  }
  for (const [budget,expected] of [[24999,"Under Rp25,000"],[25000,"Rp25,000–Rp35,000"],[35000,"Rp25,000–Rp35,000"],[35001,"Rp35,001–Rp45,000"],[45000,"Rp35,001–Rp45,000"],[45001,"More than Rp45,000"]] as const) {
    assert.equal(profileAnswers({...draft,mealBudget:String(budget)}).q5,expected);
    assert(ONBOARDING_QUESTIONS[4].options.some(option=>option.value===expected));
  }
});
test("unanswered profile data does not become a fabricated demographic answer", () => {
  assert.deepEqual(profileAnswers({...draft,age:"",mealBudget:""}),{q5:"",q7:"Prefer not to say"});
  assert(validateOnboardingProfile({...draft,age:""},"reported"));
  assert(validateOnboardingProfile({...draft,age:"17"},"reported"));
  assert(validateOnboardingProfile({...draft,gender:""},"reported"));
  assert(validateOnboardingProfile({...draft,mealBudget:"1000"},"reported"));
  assert(validateOnboardingProfile({...draft,weightKg:"NaN"},"reported"));
  assert(validateOnboardingProfile(draft,""));
  assert.equal(validateOnboardingProfile(draft,"undisclosed"),null);
});
test("multiple dietary needs remain distinct and exclusive answers clear incompatible selections", () => {
  let selected=toggleDietaryNeed([],"I need to limit salt.");
  selected=toggleDietaryNeed(selected,"I need food that is gentle on my stomach.");
  assert.equal(selected.length,2); assert(needsDietaryFollowUp(selected));
  assert.deepEqual(toggleDietaryNeed(selected,UNDISCLOSED),[UNDISCLOSED]);
  assert(!needsDietaryFollowUp([UNDISCLOSED])); assert(!needsDietaryFollowUp([]));
  assert.deepEqual(toggleDietaryNeed([NO_RESTRICTIONS],"I need to limit salt."),["I need to limit salt."]);
});
test("declining allergies preserves saved restrictions and cannot invent a negative medical flag", () => {
  const payload=healthProfilePayload({...draft,allergies:[]},"undisclosed","Not sure",saved);
  assert.deepEqual(payload.allergies,["egg","soy"]); assert.equal(payload.has_medical_condition,true);
  assert.equal(payload.max_dinner_cut_pct,10); assert.equal(payload.activity_level,"ACTIVE");
  assert(!('has_medical_condition' in healthProfilePayload(draft,"reported","Not sure",null)));
  assert.deepEqual(healthProfilePayload(draft,"none","Not sure",saved).allergies,[]);
  assert.deepEqual(healthProfilePayload(draft,"reported","Not sure",null).allergies,["egg","soy"]);
});
test("known activity and muscle goal persist rather than reverting to defaults", () => {
  assert.equal(activityFromAnswer("Mostly sitting; little planned exercise","ACTIVE"),"SEDENTARY");
  assert.equal(healthProfilePayload({...draft,goal:"otot"},"reported","Very active or frequent intense exercise",saved).goal,"GAIN_MUSCLE");
});
test("stale profile detection observes user facts while ignoring recalculated calories and allergy order", () => {
  assert.equal(profileSignature(saved),profileSignature({...saved,kcal_target:2200,allergies:["soy","egg"]}));
  assert.notEqual(profileSignature(saved),profileSignature({...saved,allergies:["egg"]}));
  assert.notEqual(profileSignature(saved),profileSignature({...saved,occupation:"New job"}));
  assert.notEqual(profileSignature(saved),profileSignature({...saved,meal_budget_idr:50000}));
  assert.notEqual(profileSignature(saved),profileSignature(null));
});
