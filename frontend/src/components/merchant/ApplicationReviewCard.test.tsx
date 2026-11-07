import "../../../tests/dom-setup";
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ApplicationReviewCard from "./ApplicationReviewCard";
import type { MerchantApplication } from "../../services/merchant-applications";

Object.defineProperty(window.HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
const application: MerchantApplication = { id: "application-test", business_name: "Test kitchen", owner_name: "Test owner",
  contact_email: "test@example.test", contact_phone: "080000000", area: "Test area", address: "Test address", cuisine_type: "Test food",
  status: "PENDING", merchant_id: null, review_reason: null, created_at: "2026-11-06T00:00:00Z", updated_at: "2026-11-06T00:00:00Z", reviewed_at: null };
let root: Root | null = null;
let host: HTMLDivElement;
let calls: unknown[][];
async function mount(overrides: Partial<React.ComponentProps<typeof ApplicationReviewCard>> = {}) {
  calls = []; host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<ApplicationReviewCard application={application} busy={false} error="" onReview={async (...args) => { calls.push(args); return true; }} {...overrides} />));
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find(item => item.textContent === text);
  assert(button, `Missing button: ${text}`);
  await act(async () => button.click());
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; host?.remove(); });

test("approval requires ownership confirmation and final confirmation; cancel makes no request", async () => {
  await mount();
  await click("Approve and activate merchant");
  assert.equal(host.querySelector("dialog"), null);
  await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await click("Approve and activate merchant");
  assert.match(host.querySelector("dialog")!.textContent!, /does not certify/);
  assert.equal(calls.length, 0);
  await click("Cancel");
  assert.equal(calls.length, 0);
  await click("Approve and activate merchant");
  await click("Confirm approval");
  assert.deepEqual(calls, [[application, "APPROVED", ""]]);
  assert.equal(host.querySelector("dialog"), null);
});

test("rejection requires a reason and failed review preserves notes and confirmation", async () => {
  await mount({ onReview: async (...args) => { calls.push(args); return false; }, error: "Review failed" });
  await click("Reject application");
  assert.equal(host.querySelector("dialog"), null);
  const field = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!.call(field, "Please provide the full address.");
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("Reject application");
  await click("Confirm rejection");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "REJECTED");
  assert.equal(calls[0][2], "Please provide the full address.");
  assert(host.querySelector("dialog"));
  assert.equal(field.value, "Please provide the full address.");
});

test("approved application access resync remains explicit and preserves existing review reason", async () => {
  const approved = { ...application, status: "APPROVED" as const, review_reason: "Reviewed" };
  await mount({ application: approved });
  await click("Resync merchant access");
  assert.equal(calls.length, 0);
  await click("Confirm access resync");
  assert.deepEqual(calls, [[approved, "APPROVED", "Reviewed"]]);
});
