import assert from "node:assert/strict";
import test from "node:test";
import { ensureCustomerRole, refreshedSessionAccess } from "./account-bootstrap";

test("first login writes only CONSUMER into the authenticated Clerk account", async () => {
  for (const role of [undefined, null, ""]) {
    const writes: unknown[] = [];
    const users = {
      getUser: async (id: string) => {
        assert.equal(id, "user-self");
        return { publicMetadata: { role, preference: "keep", merchant_ids: ["MTR-existing"] } };
      },
      updateUserMetadata: async (...args: unknown[]) => { writes.push(args); },
    };
    assert.deepEqual(await ensureCustomerRole(users, "user-self"), { role: "CONSUMER", initialized: true, account: { user_id: "user-self", name: "Pengguna NutriSea", email: null } });
    assert.deepEqual(writes, [["user-self", { publicMetadata: { role: "CONSUMER" } }]]);
  }
});

test("existing roles and merchant assignments are preserved on repeated logins", async () => {
  for (const role of ["CONSUMER", "MERCHANT_ADMIN", "SHOPEE_ADMIN"]) {
    let writes = 0;
    const users = {
      getUser: async () => ({ publicMetadata: { role, merchant_ids: ["MTR-existing"] } }),
      updateUserMetadata: async () => { writes++; },
    };
    assert.deepEqual(await ensureCustomerRole(users, "user-self"), { role, initialized: false, account: { user_id: "user-self", name: "Pengguna NutriSea", email: null } });
    assert.equal(writes, 0);
  }
});

test("legacy Clerk persona metadata does not decide database onboarding status", async () => {
  const users = {
    getUser: async () => ({ publicMetadata: { role: "CONSUMER" }, unsafeMetadata: { main_persona_id: "PERSONA-1" } }),
    updateUserMetadata: async () => { assert.fail("Existing role must be preserved"); },
  };
  assert.deepEqual(await ensureCustomerRole(users, "user-self"), { role: "CONSUMER", initialized: false, account: { user_id: "user-self", name: "Pengguna NutriSea", email: null } });
});

test("invalid roles are rejected and Clerk write failures are not hidden", async () => {
  let writes = 0;
  await assert.rejects(ensureCustomerRole({
    getUser: async () => ({ publicMetadata: { role: "ADMIN" } }),
    updateUserMetadata: async () => { writes++; },
  }, "user-self"));
  assert.equal(writes, 0);
  await assert.rejects(ensureCustomerRole({
    getUser: async () => ({ publicMetadata: {} }),
    updateUserMetadata: async () => { throw new Error("Clerk unavailable"); },
  }, "user-self"), /Clerk unavailable/);
});

const token = (claims: unknown) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
test("bootstrap requires refreshed session metadata for the same account", () => {
  assert.equal(refreshedSessionAccess(token({ sub: "user-self", metadata: { role: "CONSUMER" } }), "user-self").role, "CONSUMER");
  for (const value of [null, "invalid", token({ sub: "other", metadata: { role: "SHOPEE_ADMIN" } }),
    token({ sub: "user-self" }), token({ sub: "user-self", metadata: {} })]) {
    assert.throws(() => refreshedSessionAccess(value, "user-self"));
  }
});
