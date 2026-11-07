import "../../tests/dom-setup";
import assert from "node:assert/strict";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import FoodImage from "./FoodImage";

test("a failed catalog image becomes a stable accessible placeholder and a new source can load", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<FoodImage src="/missing-photo.jpg" alt="Catalog meal" width={80} height={80} />));
    await act(async () => host.querySelector("img")!.dispatchEvent(new window.Event("error")));
    assert.equal(host.querySelector("img"), null);
    assert.equal(host.querySelector('[role="img"]')?.getAttribute("aria-label"), "Photo unavailable: Catalog meal");
    assert.equal((host.querySelector('[role="img"]') as HTMLElement).style.height, "80px");
    await act(async () => root.render(<FoodImage src="/available-photo.jpg" alt="Catalog meal" width={80} height={80} />));
    assert.equal(host.querySelector("img")?.getAttribute("src"), "/available-photo.jpg");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test("missing catalog photo does not request a substitute food image", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<FoodImage src="" alt="Meal without photo" />));
    assert.equal(host.querySelector("img"), null);
    assert.match(host.textContent!, /Photo unavailable/);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
