"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import IngredientGuard from "@/components/ingredients/IngredientGuard";
import ApplicationReviewCard from "@/components/merchant/ApplicationReviewCard";
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
      if (!signal?.aborted) setError(err instanceof Error ? err.message : "Applications could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [api, status, page]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const review = async (application: MerchantApplication, decision: "APPROVED" | "REJECTED", reason: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api.review(application, decision, reason);
      setNotice(decision === "APPROVED" ? "Application approved. The merchant, initial outlet, and applicant access have been created." : "Application rejected. The applicant can update and resubmit it.");
      // Returning to page 1 also handles approving the last item on a later page.
      if (page !== 1) setPage(1); else await load();
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "The application could not be processed."); return false; }
    finally { setBusy(false); }
  };
  return <section className={styles.page}>
    <div className={styles.heading}><h1>Merchant applications</h1><Link href="/admin">Back to admin dashboard</Link></div>
    <p className={styles.muted}>Review the business information and confirm ownership with the applicant before approving. Approval does not provide hygiene certification.</p>
    <div className={styles.toolbar}><label>Status<select value={status} disabled={busy} onChange={event => { setStatus(event.target.value as ApplicationStatus); setPage(1); setData(null); }}>
      <option value="PENDING">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
    </select></label><button disabled={busy || loading} onClick={() => void load()}>Reload</button></div>
    {error && <p role="alert" className={styles.notice}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {loading ? <p role="status">Loading applications...</p> : <>
      {!data?.items.length && <p>No applications with this status.</p>}
      {data?.items.map(application => <ApplicationReviewCard key={application.id + application.updated_at} application={application} busy={busy} error={error} onReview={review} />)}
      <div className={styles.actions}><button disabled={busy || page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button>
        <span>Page {page} · {data?.total || 0} applications</span>
        <button disabled={busy || page * 20 >= (data?.total || 0)} onClick={() => setPage(current => current + 1)}>Next</button></div>
    </>}
  </section>;
}
