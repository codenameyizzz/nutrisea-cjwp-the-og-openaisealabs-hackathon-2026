import assert from "node:assert/strict";
import test from "node:test";
import { canLogAnalysis, parseAnalysis } from "./analysis";

const response = { analysis_source: "ai", analysis_status: "success", detected_dish: "Synthetic meal", qualitative_kcal_estimate: 0 };
test("scanner rejects fallback, unavailable and unmarked responses", () => {
  for (const data of [{...response, analysis_source: "unavailable"}, {...response, analysis_status: "unavailable"}, {detected_dish: "Fallback", qualitative_kcal_estimate: 280}, null]) assert.throws(() => parseAnalysis(data));
});
test("missing and invalid nutrients stay null; measured zero survives", () => {
  const result = parseAnalysis({...response, protein_g: -1, carbs_g: Infinity, fat_g: "10", sodium_mg: 0});
  assert.equal(result.qualitative_kcal_estimate,0); assert.equal(result.sodium_mg,0);
  assert.equal(result.protein_g,null); assert.equal(result.carbs_g,null); assert.equal(result.fat_g,null);
});
test("scanner cannot log incomplete measurements even if calories exist", () => {
  assert.equal(canLogAnalysis(parseAnalysis(response), "320"),false);
});
test("scanner accepts explicit zero quantities but rejects blank, negative or fractional calories", () => {
  const result = parseAnalysis({...response,protein_g:0,carbs_g:0,fat_g:0,sodium_mg:0});
  assert.equal(canLogAnalysis(result,"0"),true);
  for (const value of ["", " ", "-1", "NaN", "Infinity", "0.2"]) assert.equal(canLogAnalysis(result,value),false);
});
test("demo samples cannot be logged as real photo measurements", () => {
  const result = {...parseAnalysis({...response,protein_g:1,carbs_g:1,fat_g:1,sodium_mg:1}),source:"demo" as const};
  assert.equal(canLogAnalysis(result,"300"),false);
});
test("unrecognized food is an error, not an invented dish", () => {
  assert.throws(() => parseAnalysis({...response,detected_dish:" "}));
});
