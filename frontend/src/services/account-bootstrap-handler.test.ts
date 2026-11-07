import assert from "node:assert/strict";
import test from "node:test";
import { accountBootstrapResponse } from "./account-bootstrap-handler";

const request = (origin = "http://localhost:3000") => new Request("http://0.0.0.0:3000/api/auth/bootstrap", {
  method: "POST", headers: { host: "localhost:3000", origin, "sec-fetch-site": "same-origin" },
  body: JSON.stringify({ userId: "user-other", role: "SHOPEE_ADMIN" }),
});

test("authenticated localhost bootstrap initializes the correct account and requests persona onboarding", async () => {
  let metadata: Record<string, unknown> = {};
  const writes: unknown[] = [];
  const dependencies = {
    authenticatedUserId: async () => "user-signed-in",
    users: async () => ({
      getUser: async (userId: string) => { assert.equal(userId, "user-signed-in"); return { publicMetadata: metadata }; },
      updateUserMetadata: async (userId: string, data: { publicMetadata: { role: "CONSUMER" } }) => {
        writes.push([userId, data]); metadata = { ...metadata, ...data.publicMetadata };
      },
    }),
  };
  const result = await accountBootstrapResponse(request(), dependencies);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { role: "CONSUMER", initialized: true, account: { user_id: "user-signed-in", name: "Pengguna NutriSea", email: null } });
  assert.deepEqual(writes, [["user-signed-in", { publicMetadata: { role: "CONSUMER" } }]]);
  // Retry after a failed token refresh must still lead to persona selection.
  const retried = await accountBootstrapResponse(request(), dependencies);
  assert.deepEqual(await retried.json(), { role: "CONSUMER", initialized: false, account: { user_id: "user-signed-in", name: "Pengguna NutriSea", email: null } });
  assert.equal(writes.length, 1);
});

test("foreign origins and logged-out callers cannot change Clerk metadata", async () => {
  const dependencies = {
    authenticatedUserId: async () => null,
    users: async () => { assert.fail("Clerk must not be accessed"); },
  };
  assert.equal((await accountBootstrapResponse(request("https://evil.example"), dependencies)).status, 403);
  assert.equal((await accountBootstrapResponse(request(), dependencies)).status, 401);
});
