import "../../../tests/dom-setup";
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import AccountSessionController, { type AccountSessionProps } from "../AccountSessionController";
import { useAccountSession } from "../../context/AccountSessionContext";
import { ACCOUNT_UPDATED, type AccountSnapshot } from "../../services/account-session";

let root: Root | null = null;
let host: HTMLDivElement;
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; host?.remove(); });
const account = (id: string, complete: boolean): AccountSnapshot => ({
  user: { id, name: id, role: "CONSUMER" }, onboarding_complete: complete,
  main_persona_id: complete ? "PERSONA-1" : null, main_persona: null, side_persona_ids: [], profile: null,
});
function AccountPage() {
  const { account } = useAccountSession();
  return <h1>{account ? `Account ${account.user.id}` : "Customer landing"}</h1>;
}
async function render(props: Omit<AccountSessionProps, "children">) {
  if (!root) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); }
  await act(async () => root!.render(<AccountSessionController {...props}><AccountPage /></AccountSessionController>));
}
function setup() {
  const redirects: string[] = [];
  const props: Omit<AccountSessionProps, "children"> = {
    isLoaded: true, isSignedIn: true, userId: "user-new", sessionId: "sess-new", pathname: "/dashboard",
    getToken: async () => "token", router: { replace: path => { redirects.push(path); }, refresh: () => {} },
    initialize: async id => ({ account: account(id, false), needsPersona: true }),
  };
  return { props, redirects };
}

test("guest landing remains public without seeding a Clerk or database account", async () => {
  const { props, redirects } = setup();
  await render({ ...props, isSignedIn: false, userId: null, sessionId: null, pathname: "/",
    initialize: async () => { assert.fail("Guest must not initialize an account"); } });
  assert.match(host.textContent!, /Customer landing/);
  assert.deepEqual(redirects, []);
});

test("new authenticated account goes to the existing persona form", async () => {
  const { props, redirects } = setup();
  await render(props);
  assert.deepEqual(redirects, ["/onboarding/personas"]);
  assert.match(host.textContent!, /Account user-new/);
});

test("switching accounts clears the previous snapshot while the new session initializes", async () => {
  const { props, redirects } = setup();
  await render({ ...props, initialize: async id => ({ account: account(id, true), needsPersona: false }) });
  let finish!: (value: Awaited<ReturnType<NonNullable<AccountSessionProps["initialize"]>>>) => void;
  const pending = new Promise<Awaited<ReturnType<NonNullable<AccountSessionProps["initialize"]>>>>(resolve => { finish = resolve; });
  await render({ ...props, userId: "user-other", sessionId: "sess-other", pathname: "/", initialize: () => pending });
  assert.doesNotMatch(host.textContent!, /Account user-new/);
  await act(async () => { finish({ account: account("user-other", false), needsPersona: true }); });
  assert.deepEqual(redirects, ["/onboarding/personas"]);
  assert.match(host.textContent!, /Account user-other/);
});

test("saved onboarding is re-read from the server rather than a stale Clerk marker", async () => {
  const { props, redirects } = setup();
  let complete = false;
  await render({ ...props, initialize: async id => ({ account: account(id, complete), needsPersona: !complete }) });
  complete = true;
  await act(async () => { window.dispatchEvent(new window.Event(ACCOUNT_UPDATED)); });
  assert.deepEqual(redirects, ["/onboarding/personas"]);
  assert.match(host.textContent!, /Account user-new/);
});

test("sync failure is visible and does not advance to persona or a ready account", async () => {
  const { props, redirects } = setup();
  await render({ ...props, initialize: async () => { throw new Error("Database unavailable"); } });
  assert.match(host.querySelector('[role="alert"]')!.textContent!, /Database unavailable/);
  assert.doesNotMatch(host.textContent!, /Account user-new/);
  assert.deepEqual(redirects, []);
});
