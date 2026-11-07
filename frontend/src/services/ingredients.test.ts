import test from "node:test";
import assert from "node:assert/strict";
import { quantityIsValid, recipePayload, EMPTY_RECIPE_VERSION } from "./ingredient-types";
import type { IngredientSelection } from "./ingredient-types";
import { responseJson, ApiError } from "../lib/api";

test("quantity validation matches backend numeric precision and range", () => {
  for (const value of ["0.001", "1", "3.125", "999999.999"]) assert.equal(quantityIsValid(value), true, value);
  for (const value of ["", "0", "-1", "NaN", "Infinity", "1e3", "0.0001", "1000000", "1.0001"]) assert.equal(quantityIsValid(value), false, value);
});
test("recipe payload persists IDs, validates duplicates and strips display-only fields", () => {
  const item: IngredientSelection = { ingredient_id: "test-id", name: "Bawang", quantity: "1", unit: "pcs", is_active: true };
  assert.deepEqual(recipePayload([item], EMPTY_RECIPE_VERSION).items, [{ ingredient_id: "test-id", quantity: "1", unit: "pcs" }]);
  assert.throws(() => recipePayload([item, item], EMPTY_RECIPE_VERSION), /duplikat/);
  assert.throws(() => recipePayload([{ ...item, quantity: "0" }], EMPTY_RECIPE_VERSION), /takaran/);
  assert.deepEqual(recipePayload([], EMPTY_RECIPE_VERSION).items, []);
});
test("API errors preserve backend validation and migration messages", async () => {
  await assert.rejects(responseJson(new Response(JSON.stringify({ detail: "Migrasi menunggu persetujuan" }), { status: 503 })), (err: unknown) => err instanceof ApiError && err.status === 503 && err.message.includes("Migrasi"));
  await assert.rejects(responseJson(new Response(JSON.stringify({ detail: [{ msg: "Quantity must be positive" }] }), { status: 422 })), /Quantity must be positive/);
  assert.deepEqual(await responseJson(new Response('{"items":[]}')), { items: [] });
});
