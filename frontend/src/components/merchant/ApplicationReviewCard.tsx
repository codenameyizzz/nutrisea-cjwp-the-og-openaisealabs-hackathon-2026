"use client";

import { useState } from "react";
import type { MerchantApplication } from "../../services/merchant-applications";
import IngredientDialog from "../ingredients/IngredientDialog";
import styles from "../ingredients/ingredients.module.css";

export default function ApplicationReviewCard({ application, busy, error, onReview }: {
  application: MerchantApplication; busy: boolean; error: string;
  onReview: (application: MerchantApplication, decision: "APPROVED" | "REJECTED", reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const resync = application.status === "APPROVED";
  async function submit() {
    if (!decision || busy || (decision === "APPROVED" && !resync && !confirmed) || (decision === "REJECTED" && !reason.trim())) return;
    if (await onReview(application, decision, resync ? application.review_reason || "" : reason)) setDecision(null);
  }
  return <article className={styles.editor} style={{ marginBottom: 20 }}>
    <h2>{application.business_name}</h2>
    <p>{application.cuisine_type} · {application.area}</p>
    <p><strong>Owner:</strong> {application.owner_name}</p>
    <p><strong>Contact:</strong> {application.contact_email} · {application.contact_phone}</p>
    <p><strong>Address:</strong> {application.address}</p>
    <p className={styles.muted}>Submitted: {new Date(application.updated_at).toLocaleString("en-GB")}</p>
    {application.status === "PENDING" ? <>
      <label htmlFor={`reason-${application.id}`}>Review notes / reason for rejection
        <textarea id={`reason-${application.id}`} maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} style={{ width: "100%", minHeight: 70 }} />
      </label>
      <label style={{ display: "flex", alignItems: "start" }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} style={{ width: "auto", marginTop: 4 }} />I have verified the business details and the applicant&apos;s authority.</label>
      <div className={styles.actions}><button className={styles.primary} disabled={busy || !confirmed} onClick={() => setDecision("APPROVED")}>Approve and activate merchant</button>
        <button disabled={busy || !reason.trim()} onClick={() => setDecision("REJECTED")}>Reject application</button></div>
    </> : <><p>{resync ? "Approved" : "Rejected"}{application.review_reason ? `: ${application.review_reason}` : ""}</p>
      {resync && <button disabled={busy} onClick={() => setDecision("APPROVED")}>Resync merchant access</button>}
    </>}
    {decision && <IngredientDialog title={resync ? "Resync merchant access?" : decision === "APPROVED" ? "Approve this merchant?" : "Reject this application?"} busy={busy} onClose={() => setDecision(null)}>
      <p><strong>{application.business_name}</strong></p>
      <p>{resync ? "Refresh this applicant's merchant permissions using the approved application." : decision === "APPROVED"
        ? "Approval creates the merchant and initial outlet, and grants the applicant merchant access. It does not certify hygiene or food safety."
        : "The applicant will see your reason and can update and resubmit the application."}</p>
      {reason.trim() && <p><strong>Review notes:</strong> {reason}</p>}
      {error && <p role="alert" className={styles.notice}>{error} Your review notes are still here.</p>}
      <div className={styles.actions} style={{ marginTop: 20 }}>
        <button disabled={busy} onClick={() => setDecision(null)}>Cancel</button>
        <button className={styles.primary} disabled={busy} onClick={() => void submit()}>{busy ? "Processing..." : resync ? "Confirm access resync" : decision === "APPROVED" ? "Confirm approval" : "Confirm rejection"}</button>
      </div>
    </IngredientDialog>}
  </article>;
}
