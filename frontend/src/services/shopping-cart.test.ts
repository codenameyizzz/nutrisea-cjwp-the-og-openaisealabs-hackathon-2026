import assert from "node:assert/strict";
import test from "node:test";
import { restoreCart, restoreAccountCart } from "./shopping-cart";

test("guest cart survives serialization during the login round trip", () => {
  const items = [{ dish: { id: "DISH-1", name: "Menu sehat", discountedPrice: 25000 }, qty: 2 }];
  assert.deepEqual(restoreCart(JSON.stringify(items)), items);
  assert.deepEqual(restoreCart("[]"), []);
});

test("guest selections survive login but an authenticated cart does not cross to another account", () => {
  const raw = JSON.stringify([{ dish: { id: "x", name: "Menu", discountedPrice: 10000 }, qty: 1 }]);
  assert.equal(restoreAccountCart(raw, "guest", "user-a").length, 1);
  assert.equal(restoreAccountCart(raw, "user-a", "user-a").length, 1);
  assert.deepEqual(restoreAccountCart(raw, "user-a", "user-b"), []);
  assert.deepEqual(restoreAccountCart(raw, "user-a", "guest"), []);
});

test("unusable browser cart data does not break the landing page", () => {
  for (const raw of [null, "invalid", "{}", "null"]) assert.deepEqual(restoreCart(raw), []);
  assert.deepEqual(restoreCart(JSON.stringify([null, { qty: -1 }, { qty: 1, dish: {} },
    { qty: 1, dish: { id: "x", name: "x", discountedPrice: -1 } }])), []);
});
