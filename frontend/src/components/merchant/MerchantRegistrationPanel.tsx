"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { MerchantApplication, MerchantApplicationInput } from "../../services/merchant-applications";
import styles from "../ingredients/ingredients.module.css";

const fields: { key: keyof MerchantApplicationInput; label: string; max: number; min: number; type?: string; placeholder: string }[] = [
  { key: "business_name", label: "Business name", min: 2, max: 100, placeholder: "Example Food Stall" },
  { key: "owner_name", label: "Owner / responsible person", min: 2, max: 100, placeholder: "Full name" },
  { key: "contact_email", label: "Business email", min: 3, max: 150, type: "email", placeholder: "business@example.com" },
  { key: "contact_phone", label: "Business phone number", min: 8, max: 30, type: "tel", placeholder: "081234567890" },
  { key: "area", label: "Area / district", min: 2, max: 80, placeholder: "Kuningan, South Jakarta" },
  { key: "address", label: "Full outlet address", min: 8, max: 255, placeholder: "Street, building number, neighborhood, city" },
  { key: "cuisine_type", label: "Cuisine type", min: 2, max: 80, placeholder: "Food stall and home-style cooking" },
];
const empty: MerchantApplicationInput = { business_name: "", owner_name: "", contact_email: "", contact_phone: "", area: "", address: "", cuisine_type: "" };

export default function MerchantRegistrationPanel({ application, hasAccess, busy, error, onSubmit, onReload }: {
  application: MerchantApplication | null; hasAccess: boolean; busy: boolean; error: string;
  onSubmit: (data: MerchantApplicationInput) => Promise<void>; onReload: () => void;
}) {
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (application?.status !== "REJECTED") return;
    setForm({ business_name: application.business_name, owner_name: application.owner_name,
      contact_email: application.contact_email, contact_phone: application.contact_phone,
      area: application.area, address: application.address, cuisine_type: application.cuisine_type });
  }, [application]);
  return <section className={styles.page} style={{ maxWidth: 700 }}>
    <div className={styles.heading}><h1>Register as a merchant</h1><Link href="/profile">Back to profile</Link></div>
    <p className={styles.muted}>Use one account to shop and manage your business. NutriSea reviews applications before enabling merchant access.</p>
    {error && <div role="alert" className={styles.notice}>{error} <button onClick={onReload}>Try loading the status again</button></div>}
    {(hasAccess || application?.status === "APPROVED") ? <div className={styles.notice}>
      <h2>Application approved</h2>
      {hasAccess ? <><p>Merchant access is active. You can still shop as a customer.</p>
        <Link href="/merchant" className="btn-shopee-primary">Open merchant dashboard</Link></> : <>
        <p>Merchant access is not available in this session yet. Refresh your session; if access is still unavailable, contact an administrator.</p>
        <button onClick={onReload}>Refresh session and access</button></>}
    </div> : application?.status === "PENDING" ? <div className={styles.notice} role="status">
      <h2>Awaiting review</h2><p>Your application for <strong>{application.business_name}</strong> has been received. You can keep shopping while it is reviewed.</p>
      <p>Status updates automatically. Merchant access becomes available after administrator approval.</p>
      <button onClick={onReload}>Check status</button> <Link href="/">Continue shopping</Link>
    </div> : <>
      {application?.status === "REJECTED" && <div className={styles.notice} role="status"><h2>Application needs changes</h2><p>{application.review_reason}</p><p>Update the details below and resubmit.</p></div>}
      <form onSubmit={event => { event.preventDefault(); if (!busy) void onSubmit(form); }} className={styles.form}>
        {fields.map(field => <label key={field.key} htmlFor={`merchant-${field.key}`}>{field.label}
          <input id={`merchant-${field.key}`} name={field.key} required type={field.type || "text"} minLength={field.min} maxLength={field.max}
            placeholder={field.placeholder} value={form[field.key]} disabled={busy}
            onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} />
        </label>)}
        <label style={{ display: "flex", alignItems: "start" }}><input type="checkbox" required disabled={busy} style={{ width: "auto", marginTop: 4 }} />I own or am responsible for this business and confirm that the information provided is accurate.</label>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Submitting application..." : application ? "Resubmit application" : "Submit merchant application"}</button>
      </form>
    </>}
  </section>;
}
