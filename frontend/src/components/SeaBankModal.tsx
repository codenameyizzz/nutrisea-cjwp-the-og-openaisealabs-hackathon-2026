"use client";

import React, { useEffect, useRef, useState } from "react";
import { Wallet, X, RefreshCw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useUser, useAuth } from "@clerk/nextjs";
import { API_BASE_URL, responseJson } from "@/lib/api";

export default function SeaBankModal() {
  const { isSeaBankOpen } = useApp();
  const { user } = useUser();
  return isSeaBankOpen ? <SeaBankContent key={user?.id || "signed-out"} /> : null;
}

function SeaBankContent() {
  const { isSeaBankOpen, setIsSeaBankOpen } = useApp();
  const { user } = useUser();
  const { getToken } = useAuth();
  const [rewards, setRewards] = useState<{ amount: number; count: number } | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSeaBankOpen) return;
    const controller = new AbortController();
    if (!user) return;
    const load = async () => {
      try {
        const token = await getToken();
        if (controller.signal.aborted) return;
        if (!token) throw new Error("No session");
        const data = await responseJson<{ total_reward_idr: number; history: unknown[] }>(await fetch(
          `${API_BASE_URL}/api/users/${user.id}/rewards`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        ));
        if (!Number.isFinite(data.total_reward_idr) || data.total_reward_idr < 0 || !Array.isArray(data.history)) {
          throw new Error("Invalid rewards response");
        }
        if (!controller.signal.aborted) setRewards({ amount: data.total_reward_idr, count: data.history.length });
      } catch {
        if (!controller.signal.aborted) setError("Rewards could not be loaded. No transaction was made. Please try again.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [isSeaBankOpen, user, getToken, attempt]);

  useEffect(() => {
    if (!isSeaBankOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSeaBankOpen(false);
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [isSeaBankOpen, setIsSeaBankOpen]);

  if (!isSeaBankOpen) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={() => setIsSeaBankOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seabank-title"
        tabIndex={-1}
        className="seabank-dialog"
        style={{ width: "100%", maxWidth: 520, backgroundColor: "#FFFFFF", borderRadius: 12, overflowY: "auto", boxShadow: "0 12px 36px rgba(0,0,0,0.25)" }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ backgroundColor: "#003B7A", color: "#FFFFFF", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Wallet size={24} aria-hidden="true" />
            <div>
              <h2 id="seabank-title" style={{ fontSize: 18 }}>SeaBank rewards simulation</h2>
              <p style={{ fontSize: 13 }}>NutriSea demo feature</p>
            </div>
          </div>
          <button type="button" aria-label="Close rewards simulation" onClick={() => setIsSeaBankOpen(false)} style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}><X size={22} /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18, fontSize: 14, lineHeight: 1.6 }}>
          <p>These rewards are records in the prototype. They are not a SeaBank account balance and do not transfer money to a bank.</p>
          {!user && <p role="status">Sign in to view your simulated reward records.</p>}
          {isLoading && <p role="status"><RefreshCw size={16} className="spin-slow" /> Loading reward records...</p>}
          {error && <div><p role="alert">{error}</p><button type="button" className="btn-shopee-primary" onClick={() => { setError(null); setIsLoading(true); setAttempt(value => value + 1); }}>Try again</button></div>}
          {rewards && (
            <div style={{ backgroundColor: "#F0F5FA", border: "1px solid #CCE0F5", borderRadius: 10, padding: 16 }}>
              <p>Total simulated rewards recorded</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: "#003B7A" }}>Rp {rewards.amount.toLocaleString("id-ID")}</p>
              <p>{rewards.count} reward records</p>
              {rewards.count === 0 && <p>No rewards have been recorded for this account.</p>}
            </div>
          )}
          <button type="button" className="btn-shopee-primary" onClick={() => setIsSeaBankOpen(false)}>Close and continue</button>
        </div>
      </div>
    </div>
  );
}
