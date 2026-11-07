"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import IngredientGuard from "@/components/ingredients/IngredientGuard";
import { useMerchantApplications, type MerchantApplication, type ApplicationList, type ApplicationStatus } from "@/services/merchant-applications";
import styles from "@/components/ingredients/ingredients.module.css";

export default function MerchantApplicationsPage() {
  return <IngredientGuard mode="admin"><ApplicationReview /></IngredientGuard>;
}

function ApplicationReview() {
  const api = useMerchantApplications();
  const [status, setStatus] = useState<ApplicationStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApplicationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const result = await api.list(status, page, signal);
      if (!signal?.aborted) { setData(result); setError(""); }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Daftar gagal dimuat.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [api, status, page]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const review = async (application: MerchantApplication, decision: "APPROVED" | "REJECTED", reason: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.review(application, decision, reason);
      setNotice(decision === "APPROVED" ? "Pengajuan disetujui. Merchant, outlet awal, dan akses pemohon sudah dibuat." : "Pengajuan ditolak. Pemohon dapat memperbaiki dan mengirim ulang.");
      // Returning to page 1 also handles approving the last item on a later page.
      if (page !== 1) setPage(1); else await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Pengajuan gagal diproses."); }
    finally { setBusy(false); }
  };
  return <section className={styles.page}>
    <div className={styles.heading}><h1>Pengajuan Merchant</h1><Link href="/admin">Kembali ke dashboard admin</Link></div>
    <p className={styles.muted}>Periksa informasi usaha dan konfirmasi kepemilikan melalui kontak pemohon sebelum menyetujui. Persetujuan ini tidak memberikan sertifikasi higienis.</p>
    <div className={styles.toolbar}><label>Status<select value={status} disabled={busy} onChange={event => { setStatus(event.target.value as ApplicationStatus); setPage(1); setData(null); }}>
      <option value="PENDING">Menunggu verifikasi</option><option value="APPROVED">Disetujui</option><option value="REJECTED">Ditolak</option>
    </select></label><button disabled={busy || loading} onClick={() => void load()}>Muat ulang</button></div>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {loading ? <p role="status">Memuat pengajuan...</p> : <>
      {!data?.items.length && <p>Belum ada pengajuan pada status ini.</p>}
      {data?.items.map(application => <ApplicationCard key={application.id + application.updated_at} application={application} busy={busy} onReview={review} />)}
      <div className={styles.actions}><button disabled={busy || page <= 1} onClick={() => setPage(current => current - 1)}>Sebelumnya</button>
        <span>Halaman {page} · {data?.total || 0} pengajuan</span>
        <button disabled={busy || page * 20 >= (data?.total || 0)} onClick={() => setPage(current => current + 1)}>Berikutnya</button></div>
    </>}
  </section>;
}

function ApplicationCard({ application, busy, onReview }: { application: MerchantApplication; busy: boolean;
  onReview: (application: MerchantApplication, decision: "APPROVED" | "REJECTED", reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return <article className={styles.editor} style={{ marginBottom: 20 }}>
    <h2>{application.business_name}</h2>
    <p>{application.cuisine_type} · {application.area}</p>
    <p><strong>Penanggung jawab:</strong> {application.owner_name}</p>
    <p><strong>Kontak:</strong> {application.contact_email} · {application.contact_phone}</p>
    <p><strong>Alamat:</strong> {application.address}</p>
    <p className={styles.muted}>Diajukan: {new Date(application.updated_at).toLocaleString("id-ID")}</p>
    {application.status === "PENDING" ? <>
      <label htmlFor={`reason-${application.id}`}>Catatan verifikasi / alasan penolakan
        <textarea id={`reason-${application.id}`} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} style={{ width: "100%", minHeight: 70 }} />
      </label>
      <label style={{ display: "flex", alignItems: "start" }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} style={{ width: "auto", marginTop: 4 }} />Saya sudah memverifikasi data usaha dan kewenangan pemohon.</label>
      <div className={styles.actions}><button className={styles.primary} disabled={busy || !confirmed} onClick={() => void onReview(application, "APPROVED", reason)}>Setujui & Aktifkan Merchant</button>
        <button disabled={busy || !reason.trim()} onClick={() => void onReview(application, "REJECTED", reason)}>Tolak Pengajuan</button></div>
    </> : <p>{application.status === "APPROVED" ? "Disetujui" : "Ditolak"}{application.review_reason ? ` — ${application.review_reason}` : ""}</p>}
  </article>;
}
