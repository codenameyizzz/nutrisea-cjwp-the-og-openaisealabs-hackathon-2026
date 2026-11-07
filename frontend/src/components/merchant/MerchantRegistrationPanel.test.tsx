import "../../../tests/dom-setup";
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import MerchantRegistrationPanel from "./MerchantRegistrationPanel";
import type { MerchantApplication, MerchantApplicationInput } from "../../services/merchant-applications";

const data: MerchantApplicationInput = { business_name: "Warung Sehat", owner_name: "Pemilik Usaha", contact_email: "usaha@example.test",
  contact_phone: "081234567890", area: "Kuningan", address: "Jalan Uji nomor 12", cuisine_type: "Masakan rumahan" };
const application: MerchantApplication = { ...data, id: "application-1", status: "PENDING", merchant_id: null,
  review_reason: null, created_at: "2026-11-06T00:00:00Z", updated_at: "2026-11-06T00:00:00Z", reviewed_at: null };
let root: Root | null = null;
let host: HTMLDivElement;
let submitted: MerchantApplicationInput | undefined;
async function mount(overrides: Partial<React.ComponentProps<typeof MerchantRegistrationPanel>> = {}) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host); submitted = undefined;
  await act(async () => { root!.render(<MerchantRegistrationPanel application={null} hasAccess={false} busy={false} error=""
    onSubmit={async value => { submitted = value; }} onReload={() => {}} {...overrides} />); });
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; host?.remove(); });

test("customer sees merchant registration form with required business fields", async () => {
  await mount();
  assert.match(host.textContent!, /Daftar sebagai Merchant/);
  for (const key of Object.keys(data)) assert.equal(host.querySelector<HTMLInputElement>(`input[name=${key}]`)?.required, true);
  assert.equal(host.querySelector<HTMLInputElement>('input[type=checkbox]')?.required, true);
  assert.match(host.querySelector('button[type=submit]')!.textContent!, /Kirim Pengajuan Merchant/);
});

test("form submits applicant business data without role or user identity fields", async () => {
  await mount({ application: { ...application, status: "REJECTED", review_reason: "Perbaiki alamat" } });
  assert.equal(host.querySelector<HTMLInputElement>('input[name=business_name]')?.value, data.business_name);
  await act(async () => { host.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.deepEqual(submitted, data);
  assert.equal("role" in submitted!, false);
  assert.equal("user_id" in submitted!, false);
});

test("pending applicant sees status and can keep shopping without duplicate form", async () => {
  await mount({ application });
  assert.match(host.textContent!, /Menunggu verifikasi/);
  assert.equal(host.querySelector("form"), null);
  assert.equal(host.querySelector('a[href="/"]')?.textContent, "Lanjut berbelanja");
});

test("approved applicant sees merchant dashboard while retaining customer messaging", async () => {
  await mount({ application: { ...application, status: "APPROVED", merchant_id: "MTR-approved" } });
  assert.equal(host.querySelector('a[href="/merchant"]')?.textContent, "Buka Dashboard Merchant");
  assert.match(host.textContent!, /tetap dapat berbelanja/);
  assert.equal(host.querySelector("form"), null);
});

test("rejected application shows review reason and populated resubmission form", async () => {
  await mount({ application: { ...application, status: "REJECTED", review_reason: "Alamat belum lengkap" } });
  assert.match(host.textContent!, /Alamat belum lengkap/);
  assert.match(host.querySelector('button[type=submit]')!.textContent!, /Kirim Ulang Pengajuan/);
});

test("submission errors remain visible and busy state prevents another submission", async () => {
  await mount({ error: "Pengajuan gagal dikirim", busy: true });
  assert.match(host.querySelector('[role=alert]')!.textContent!, /Pengajuan gagal dikirim/);
  assert.equal(host.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled, true);
  await act(async () => { host.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(submitted, undefined);
});
