"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { MerchantApplication, MerchantApplicationInput } from "../../services/merchant-applications";
import styles from "../ingredients/ingredients.module.css";

const fields: { key: keyof MerchantApplicationInput; label: string; max: number; min: number; type?: string; placeholder: string }[] = [
  { key: "business_name", label: "Nama usaha", min: 2, max: 100, placeholder: "Warteg Sehat Bersama" },
  { key: "owner_name", label: "Nama pemilik / penanggung jawab", min: 2, max: 100, placeholder: "Nama lengkap" },
  { key: "contact_email", label: "Email usaha", min: 3, max: 150, type: "email", placeholder: "usaha@contoh.com" },
  { key: "contact_phone", label: "Nomor telepon usaha", min: 8, max: 30, type: "tel", placeholder: "081234567890" },
  { key: "area", label: "Wilayah / kecamatan", min: 2, max: 80, placeholder: "Kuningan, Jakarta Selatan" },
  { key: "address", label: "Alamat lengkap outlet", min: 8, max: 255, placeholder: "Jalan, nomor, kelurahan, kota" },
  { key: "cuisine_type", label: "Jenis masakan", min: 2, max: 80, placeholder: "Warteg & masakan rumahan" },
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
    <div className={styles.heading}><h1>Daftar sebagai Merchant</h1><Link href="/profile">Kembali ke profil</Link></div>
    <p className={styles.muted}>Satu akun untuk berbelanja dan mengelola usaha. Tim NutriSea memeriksa pengajuan sebelum akses Merchant diaktifkan.</p>
    {error && <div role="alert" className={styles.notice}>{error} <button onClick={onReload}>Coba muat status lagi</button></div>}
    {(hasAccess || application?.status === "APPROVED") ? <div className={styles.notice}>
      <h2>Pendaftaran disetujui</h2><p>Akses Merchant sudah aktif. Anda tetap dapat berbelanja sebagai Customer.</p>
      <Link href="/merchant" className="btn-shopee-primary">Buka Dashboard Merchant</Link>
    </div> : application?.status === "PENDING" ? <div className={styles.notice} role="status">
      <h2>Menunggu verifikasi</h2><p>Pengajuan <strong>{application.business_name}</strong> sudah diterima. Anda tetap bisa berbelanja selama pengajuan diperiksa.</p>
      <p>Status diperbarui otomatis. Akses Merchant aktif setelah disetujui admin.</p>
      <button onClick={onReload}>Periksa status</button> <Link href="/">Lanjut berbelanja</Link>
    </div> : <>
      {application?.status === "REJECTED" && <div className={styles.notice} role="status"><h2>Pengajuan perlu diperbaiki</h2><p>{application.review_reason}</p><p>Perbaiki data di bawah dan kirim kembali.</p></div>}
      <form onSubmit={event => { event.preventDefault(); if (!busy) void onSubmit(form); }} className={styles.form}>
        {fields.map(field => <label key={field.key} htmlFor={`merchant-${field.key}`}>{field.label}
          <input id={`merchant-${field.key}`} name={field.key} required type={field.type || "text"} minLength={field.min} maxLength={field.max}
            placeholder={field.placeholder} value={form[field.key]} disabled={busy}
            onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} />
        </label>)}
        <label style={{ display: "flex", alignItems: "start" }}><input type="checkbox" required disabled={busy} style={{ width: "auto", marginTop: 4 }} />Saya pemilik atau penanggung jawab usaha dan menyatakan data yang diberikan benar.</label>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Mengirim pengajuan..." : application ? "Kirim Ulang Pengajuan" : "Kirim Pengajuan Merchant"}</button>
      </form>
    </>}
  </section>;
}
