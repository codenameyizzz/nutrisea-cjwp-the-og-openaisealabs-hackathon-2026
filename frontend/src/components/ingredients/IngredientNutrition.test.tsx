import "../../../tests/dom-setup";
import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import IngredientNutrition from "./IngredientNutrition";
import type { IngredientNutritionData } from "../../services/ingredient-nutrition";

Object.defineProperty(window.HTMLDialogElement.prototype, "showModal", {
  configurable: true, value() { this.setAttribute("open", ""); },
});

let root: Root | null = null;
let host: HTMLDivElement;
const data: IngredientNutritionData = {
  ingredient: { id: "tempe", name: "Tempe", is_active: true },
  status: "source_reference", basis: "per_source_serving", note: "Belum memverifikasi total nutrisi menu.",
  sources: [{ source_key: "fatsecret:10", source_name: "Tempeh",
    source_url: "https://foods.fatsecret.com/calories-nutrition/generic/tempeh", servings: [
      { source_key: "fatsecret:100", description: "100 g", metric_amount: 100, metric_unit: "g",
        nutrients: { calories: 175, protein: 21.41, sugar: null, sodium: 0 },
        nutrient_units: { calories: "kcal", protein: "g", sugar: "g", sodium: "mg" }, unit_unverified_fields: [] },
      { source_key: "fatsecret:101", description: "1 oz", metric_amount: 28.35, metric_unit: "g",
        nutrients: { calories: 50, protein: 6.07, sugar: null },
        nutrient_units: { calories: "kcal", protein: "g", sugar: "g" }, unit_unverified_fields: ["calcium"] },
    ] }],
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

async function render(id = "tempe") {
  if (!root) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  }
  await act(async () => { root!.render(<IngredientNutrition ingredientId={id} name={id} onClose={() => {}} />); });
}

afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  host?.remove(); root = null; mock.restoreAll();
});

test("portion selection changes nutrition and preserves missing values versus zero", async () => {
  mock.method(globalThis, "fetch", async () => response(data));
  await render();
  assert.match(host.textContent!, /175 kcal/);
  const rows = [...host.querySelectorAll("tbody tr")];
  assert.equal(rows.find(row => row.textContent?.startsWith("Sugars"))?.querySelector("td")?.textContent, "Not available");
  assert.equal(rows.find(row => row.textContent?.startsWith("Sodium"))?.querySelector("td")?.textContent, "0 mg");
  const select = host.querySelector("select")!;
  await act(async () => {
    select.value = "fatsecret:10/fatsecret:101";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  assert.match(host.textContent!, /50 kcal/);
  assert.doesNotMatch(host.textContent!, /175 kcal/);
  assert.match(host.textContent!, /without verified units/);
  assert.equal(host.querySelector("a")?.getAttribute("rel"), "noopener noreferrer");
});

test("missing source and API error remain explicit without nutrition fallback", async () => {
  mock.method(globalThis, "fetch", async (url: string) => url.includes("missing")
    ? response({ ...data, sources: [], status: "no_source" })
    : response({ detail: "Nutrition references are not available yet." }, 503));
  await render("missing");
  assert.match(host.textContent!, /No nutrition reference is available/);
  await render("error");
  assert.equal(host.querySelector('[role="alert"]')?.textContent, "Nutrition references are not available yet.");
  assert.equal(host.querySelector("table"), null);
});

test("late response for another ingredient cannot replace the current nutrition", async () => {
  const pending = new Map<string, (value: Response) => void>();
  mock.method(globalThis, "fetch", (url: string) => new Promise<Response>(resolve => {
    pending.set(url.includes("old") ? "old" : "new", resolve);
  }));
  await render("old");
  await render("new");
  await act(async () => { pending.get("new")!(response({ ...data, sources: [] })); });
  await act(async () => { pending.get("old")!(response(data)); });
  assert.match(host.textContent!, /No nutrition reference is available/);
  assert.equal(host.querySelector("table"), null);
});
