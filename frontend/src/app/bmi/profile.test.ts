import assert from "node:assert/strict";
import test from "node:test";
import type { AccountProfile } from "@/services/account-session";
import { bmiProfileUpdate } from "./profile";
const original: AccountProfile = { age:26,sex:"F",height_cm:160,weight_kg:52,occupation:null,activity_level:"MODERATE",goal:"MAINTAIN",allergies:["peanut"],meal_budget_idr:35000,has_medical_condition:true,max_dinner_cut_pct:10,kcal_target:1800 };
const input = {age:26,gender:"wanita" as const,height:160,weight:53,activity:"active" as const,goal:"ideal" as const};
test("BMI saves preserve latest allergies, budget and condition settings outside this form",()=>{
  const latest={...original,allergies:["peanut","egg"],meal_budget_idr:45000,max_dinner_cut_pct:0};
  const result=bmiProfileUpdate(input,latest,original);
  assert.deepEqual(result.allergies,["peanut","egg"]);assert.equal(result.meal_budget_idr,45000);
  assert.equal(result.has_medical_condition,true);assert.equal(result.max_dinner_cut_pct,0);assert.equal(result.weight_kg,53);
});
test("BMI will not overwrite measurements updated in another session",()=>{
  assert.throws(()=>bmiProfileUpdate(input,{...original,weight_kg:54},original),/changed in another session/);
});
test("unchanged activity retains the original backend value",()=>{
  assert.equal(bmiProfileUpdate(input,original,original).activity_level,"MODERATE");
});
