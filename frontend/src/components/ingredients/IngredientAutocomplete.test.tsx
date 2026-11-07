import "../../../tests/dom-setup";
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import IngredientAutocomplete from "./IngredientAutocomplete";
import type { Ingredient, IngredientPage, IngredientSelection } from "../../services/ingredient-types";

const onion: Ingredient = { id: "11111111-1111-4111-8111-111111111111", name: "Bawang Merah", category: "Bumbu", default_unit: "pcs", is_active: true, aliases: [] };
const garlic: Ingredient = { ...onion, id: "22222222-2222-4222-8222-222222222222", name: "Bawang Putih" };
const page = (items: Ingredient[]): IngredientPage => ({ items, total: items.length, page: 1, limit: 8, has_more: false });
let root: Root | null = null;
let host: HTMLDivElement;
let selected: IngredientSelection[];

async function mount(search: (query: string, signal?: AbortSignal) => Promise<IngredientPage>, initial: IngredientSelection[] = []) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  function Harness() {
    const [value, setValue] = useState(initial);
    selected = value;
    return <form><IngredientAutocomplete value={value} onChange={setValue} search={search} /></form>;
  }
  await act(async () => { root!.render(<Harness />); });
}

function input() { return host.querySelector<HTMLInputElement>("[role=combobox]")!; }
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function waitForSearch() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 310)); }); }
async function key(value: string) { await act(async () => { input().dispatchEvent(new window.KeyboardEvent("keydown", { key: value, bubbles: true })); }); }
async function click(element: Element) { await act(async () => { element.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); }
afterEach(async () => { if (root) await act(async () => { root!.unmount(); }); host?.remove(); root = null; });

test("renders accessible combobox and debounces one-character search", async () => {
  const calls: string[] = [];
  await mount(async q => { calls.push(q); return page([onion]); });
  assert.equal(input().getAttribute("aria-expanded"), "false");
  await type("b");
  assert.match(host.textContent!, /Mencari bahan/);
  assert.equal(calls.length, 0);
  await waitForSearch();
  assert.deepEqual(calls, ["b"]);
  assert.equal(host.querySelectorAll("[role=option]").length, 1);
  assert.equal(input().getAttribute("aria-expanded"), "true");
});

test("rapid typing issues only the final debounced request", async () => {
  const calls: string[] = [];
  await mount(async q => { calls.push(q); return page([]); });
  await type("b"); await type("ba"); await type("baw"); await waitForSearch();
  assert.deepEqual(calls, ["baw"]);
});

test("keyboard arrows and enter select ingredient with default quantity/unit", async () => {
  await mount(async () => page([onion, garlic]));
  await type("ba"); await waitForSearch(); await key("ArrowDown");
  assert.ok(input().getAttribute("aria-activedescendant"));
  await key("Enter");
  assert.equal(selected[0].ingredient_id, onion.id);
  assert.equal(selected[0].quantity, "1"); assert.equal(selected[0].unit, "pcs");
  assert.equal(input().value, "");
});

test("selected IDs are excluded and cannot be duplicated", async () => {
  await mount(async () => page([onion, onion, garlic]), [{ ingredient_id: onion.id, name: onion.name, quantity: "1", unit: "pcs", is_active: true }]);
  await type("ba"); await waitForSearch();
  assert.equal(host.querySelectorAll("[role=option]").length, 1);
  await click(host.querySelector("[role=option]")!);
  assert.equal(selected.length, 2);
  assert.deepEqual(new Set(selected.map(v => v.ingredient_id)).size, 2);
});

test("quantity editing, validation, unit editing and removal", async () => {
  await mount(async () => page([onion])); await type("b"); await waitForSearch();
  await click(host.querySelector("[role=option]")!);
  const quantity = host.querySelector<HTMLInputElement>('input[type="number"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(quantity, "0");
    quantity.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  assert.equal(quantity.getAttribute("aria-invalid"), "true");
  assert.match(host.querySelector('[role="alert"]')!.textContent!, /positif/);
  const unit = host.querySelector("select")!;
  await act(async () => { unit.value = "gram"; unit.dispatchEvent(new window.Event("change", { bubbles: true })); });
  assert.equal(selected[0].unit, "gram");
  await click(host.querySelector(`[aria-label="Hapus ${onion.name}"]`)!);
  assert.equal(selected.length, 0);
});

test("empty and API errors are shown without fabricated suggestions", async () => {
  await mount(async q => { if (q === "error") throw new Error("API tidak tersedia"); return page([]); });
  await type("unknown"); await waitForSearch(); assert.match(host.textContent!, /Tidak ada bahan/);
  await type("error"); await waitForSearch(); assert.equal(host.querySelector('[role="alert"]')?.textContent, "API tidak tersedia");
  assert.equal(host.querySelectorAll("[role=option]").length, 0);
});

test("late response cannot replace a newer query", async () => {
  const pending = new Map<string, (value: IngredientPage) => void>();
  await mount(q => new Promise(resolve => pending.set(q, resolve)));
  await type("old"); await waitForSearch(); await type("new"); await waitForSearch();
  await act(async () => { pending.get("new")!(page([garlic])); });
  await act(async () => { pending.get("old")!(page([onion])); });
  assert.equal(host.querySelector("[role=option] strong")?.textContent, garlic.name);
});

test("escape and click outside close popup; clear cancels pending suggestions", async () => {
  await mount(async () => page([onion])); await type("ba"); await waitForSearch();
  await key("Escape"); assert.equal(input().getAttribute("aria-expanded"), "false");
  await type("baw"); await waitForSearch();
  await act(async () => { document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true })); });
  assert.equal(input().getAttribute("aria-expanded"), "false");
  await click(host.querySelector('[aria-label="Bersihkan pencarian bahan"]')!);
  assert.equal(input().value, "");
  assert.equal(host.querySelectorAll("[role=option]").length, 0);
});
