import assert from "node:assert/strict";
import test from "node:test";
import { sessionAccess } from "./session-access";

test("session metadata defines consumer, owned merchant and admin capabilities", () => {
  assert.equal(sessionAccess({ metadata: {} }).can_edit_menus, false);
  assert.equal(sessionAccess({ metadata: { role: "MERCHANT_ADMIN", merchant_ids: [] } }).can_edit_menus, false);
  assert.deepEqual(sessionAccess({ metadata: { role: "MERCHANT_ADMIN", merchant_ids: ["MTR-1"] } }),
    { role: "MERCHANT_ADMIN", is_admin: false, can_edit_menus: true, merchant_ids: ["MTR-1"] });
  assert.equal(sessionAccess({ metadata: { role: "SHOPEE_ADMIN" } }).is_admin, true);
});

test("missing or malformed session claims cannot grant access", () => {
  for (const claims of [null, {}, { metadata: null }, { metadata: [] },
    { metadata: { role: "MERCHANT" } }, { metadata: { role: null } },
    { metadata: { merchant_ids: "all" } }, { metadata: { merchant_ids: [null] } },
    { metadata: { merchant_ids: [" "] } }, { metadata: { merchant_ids: ["x".repeat(33)] } }]) {
    assert.throws(() => sessionAccess(claims));
  }
  assert.equal(sessionAccess({ metadata: {}, unsafeMetadata: { role: "SHOPEE_ADMIN" }, role: "SHOPEE_ADMIN" }).is_admin, false);
});
