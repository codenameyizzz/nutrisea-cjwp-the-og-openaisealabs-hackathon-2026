import "../../tests/dom-setup";
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { publishMerchantApplication, useMerchantNavigation } from "./merchant-navigation";
import type { MerchantApplication } from "./merchant-applications";

type Session = Parameters<typeof useMerchantNavigation>[0];
const session: Session = { userId: "user-a", sessionId: "session-a", getToken: async () => "test-token", hasAccess: false };
const pending: MerchantApplication = { id: "application-a", status: "PENDING", merchant_id: null,
  business_name: "Warung Uji", owner_name: "Pemilik Uji", contact_email: "usaha@example.test", contact_phone: "081234567890",
  area: "Kuningan", address: "Jalan Uji nomor 12", cuisine_type: "Masakan rumahan", review_reason: null,
  created_at: "2026-11-07T00:00:00Z", updated_at: "2026-11-07T00:00:00Z", reviewed_at: null };
const originalFetch = globalThis.fetch;
let root: Root | null;
let host: HTMLDivElement;
let requests: { url: string; init?: RequestInit; resolve: (response: Response) => void; reject: (error: Error) => void }[];

function Navigation(props: Session) {
  const navigation = useMerchantNavigation(props);
  return React.createElement("a", { href: navigation.href }, navigation.label);
}
async function render(props: Session = session) {
  if (!root) {
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  }
  await act(async () => root!.render(React.createElement(Navigation, props)));
}
function expectLink(label: string, href = "/merchant/register") {
  assert.equal(host.querySelector("a")?.textContent, label);
  assert.equal(host.querySelector("a")?.getAttribute("href"), href);
}
async function respond(index: number, body: unknown, status = 200) {
  await act(async () => requests[index].resolve(Response.json(body, { status })));
}
async function focus() { await act(async () => { window.dispatchEvent(new window.Event("focus")); }); }

beforeEach(() => {
  root = null; requests = [];
  globalThis.fetch = (url, init) => new Promise<Response>((resolve, reject) => {
    requests.push({ url: String(url), init, resolve, reject });
  });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null; host?.remove(); globalThis.fetch = originalFetch;
});

test("guests can register without an application request", async () => {
  await render({ ...session, userId: null, sessionId: null });
  expectLink("Daftar Merchant");
  assert.equal(requests.length, 0);
});

test("signed-in navigation waits for a confirmed application result and fetches once per session", async () => {
  await render();
  expectLink("Merchant");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/api\/merchant-applications\/me$/);
  assert.equal(requests[0].init?.method ?? "GET", "GET");
  assert.equal(new Headers(requests[0].init?.headers).get("Authorization"), "Bearer test-token");
  await respond(0, { application: null });
  expectLink("Daftar Merchant");
  await render({ ...session, getToken: async () => "new-token" });
  assert.equal(requests.length, 1);
  await focus();
  assert.equal(requests.length, 2);
  assert.equal(new Headers(requests[1].init?.headers).get("Authorization"), "Bearer new-token");
});

test("pending, rejected and approved applications use management without granting dashboard permission", async () => {
  await render();
  for (const status of ["PENDING", "REJECTED", "APPROVED"] as const) {
    if (status !== "PENDING") await focus();
    await respond(requests.length - 1, { application: { ...pending, status } });
    expectLink("Manage Merchant");
  }
  await render({ ...session, hasAccess: true });
  expectLink("Manage Merchant", "/merchant");
  assert.equal(requests.length, 3);
});

test("session permission enables the dashboard immediately and revocation restores the registration route", async () => {
  await render({ ...session, hasAccess: true });
  expectLink("Manage Merchant", "/merchant");
  assert.equal(requests.length, 0);
  await render();
  expectLink("Merchant");
  assert.equal(requests.length, 1);
  await respond(0, { application: { ...pending, status: "APPROVED" } });
  expectLink("Manage Merchant");
});

test("successful registration updates navigation immediately and defeats an older in-flight GET", async () => {
  await render();
  await act(async () => publishMerchantApplication(session.userId, pending));
  expectLink("Manage Merchant");
  assert.equal(requests[0].init?.signal?.aborted, true);
  await respond(0, { application: null });
  expectLink("Manage Merchant");
  await act(async () => publishMerchantApplication("user-other", null));
  expectLink("Manage Merchant");
  assert.equal(requests.length, 1);
});

test("account and session switches hide prior results and ignore stale requests and other-user updates", async () => {
  await render();
  await respond(0, { application: pending });
  expectLink("Manage Merchant");
  await focus();
  await render({ ...session, userId: "user-b", sessionId: "session-b" });
  expectLink("Merchant");
  assert.equal(requests[1].init?.signal?.aborted, true);
  await respond(1, { application: pending });
  await act(async () => publishMerchantApplication("user-a", pending));
  expectLink("Merchant");
  await respond(2, { application: null });
  expectLink("Daftar Merchant");
  await render({ ...session, userId: "user-b", sessionId: "session-b-new" });
  expectLink("Merchant");
  await respond(3, { application: pending });
  expectLink("Manage Merchant");
  await render({ ...session, userId: null, sessionId: null });
  expectLink("Daftar Merchant");
  assert.equal(requests.length, 4);
});

test("network errors and malformed responses keep status unknown and focus retries", async () => {
  await render();
  await act(async () => requests[0].reject(new Error("Network unavailable")));
  expectLink("Merchant");
  await focus();
  await respond(1, { detail: "Service unavailable" }, 503);
  expectLink("Merchant");
  for (const body of [null, {}, { application: {} }, { application: { status: "UNKNOWN" } }, { application: { status: ["PENDING"] } }]) {
    await focus();
    await respond(requests.length - 1, body);
    expectLink("Merchant");
  }
  await focus();
  await respond(requests.length - 1, { application: null });
  expectLink("Daftar Merchant");
});

test("a missing session token sends no unauthenticated application request", async () => {
  await render({ ...session, getToken: async () => null });
  expectLink("Merchant");
  assert.equal(requests.length, 0);
});
