import assert from "node:assert/strict";
import test from "node:test";
import { initializeAccountSession } from "./account-session";

const jwt = (userId: string, role = "CONSUMER") => `header.${Buffer.from(JSON.stringify({ sub: userId, metadata: { role } })).toString("base64url")}.signature`;
const identity = (userId: string) => ({ user_id: userId, name: "Customer", email: null });
test("new login provisions Clerk, refreshes JWT then syncs the same account before choosing onboarding", async () => {
  const order: string[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    if (url === "/api/auth/bootstrap") {
      order.push("clerk");
      return Response.json({ role: "CONSUMER", initialized: true, account: identity("user-new") });
    }
    order.push("database");
    assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${jwt("user-new")}`);
    assert.deepEqual(JSON.parse(options?.body as string), identity("user-new"));
    return Response.json({ user: { id: "user-new", role: "CONSUMER" }, onboarding_complete: false, main_persona_id: null, profile: null });
  };
  const result = await initializeAccountSession("user-new", async options => {
    order.push("refresh"); assert.equal(options.skipCache, true); return jwt("user-new");
  }, fetcher);
  assert.equal(result.needsPersona, true);
  assert.deepEqual(order, ["clerk", "refresh", "database"]);
});

test("returning consumer trusts completed database onboarding even when Clerk has no persona fields", async () => {
  const result = await initializeAccountSession("user-old", async () => jwt("user-old"), async url =>
    Response.json(url === "/api/auth/bootstrap"
      ? { role: "CONSUMER", initialized: false, account: identity("user-old") }
      : { user: { id: "user-old", role: "CONSUMER" }, onboarding_complete: true }));
  assert.equal(result.needsPersona, false);
});

test("failed database sync and a different-account token cannot finish login", async () => {
  let databaseCalls = 0;
  const fetcher: typeof fetch = async url => {
    if (url === "/api/auth/bootstrap") return Response.json({ account: identity("user-new") });
    databaseCalls++;
    return Response.json({ detail: "Database unavailable" }, { status: 503 });
  };
  await assert.rejects(initializeAccountSession("user-new", async () => jwt("user-other"), fetcher));
  assert.equal(databaseCalls, 0);
  await assert.rejects(initializeAccountSession("user-new", async () => jwt("user-new"), fetcher), /Database unavailable/);
});

test("changing sessions during token refresh cancels the previous account sync", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const fetcher: typeof fetch = async url => {
    calls.push(String(url));
    return Response.json({ account: identity("user-old") });
  };
  await assert.rejects(initializeAccountSession("user-old", async () => {
    controller.abort(); return jwt("user-old");
  }, fetcher, controller.signal));
  assert.deepEqual(calls, ["/api/auth/bootstrap"]);
});
