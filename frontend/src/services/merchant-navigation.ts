"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, responseJson } from "../lib/api";
import type { MerchantApplication } from "./merchant-applications";

export const MERCHANT_APPLICATION_UPDATED = "nutrisea:merchant-application-updated";
export interface MerchantNavigation {
  label: "Daftar Merchant" | "Manage Merchant" | "Merchant";
  href: "/merchant" | "/merchant/register";
}
interface ApplicationUpdate { userId: string; application: MerchantApplication | null }
interface NavigationSession {
  userId: string | null; sessionId: string | null;
  getToken: () => Promise<string | null>; hasAccess: boolean;
}
interface Snapshot { userId: string; sessionId: string; registered: boolean }

function validApplication(application: unknown): application is MerchantApplication | null {
  return application === null || (typeof application === "object" && application !== null &&
    "status" in application && typeof application.status === "string" && ["PENDING", "APPROVED", "REJECTED"].includes(application.status));
}

export function publishMerchantApplication(userId: string | null | undefined, application: MerchantApplication | null) {
  if (!userId || typeof window === "undefined" || !validApplication(application)) return;
  window.dispatchEvent(new window.CustomEvent<ApplicationUpdate>(MERCHANT_APPLICATION_UPDATED, {
    detail: { userId, application },
  }));
}

export function useMerchantNavigation({ userId, sessionId, getToken, hasAccess }: NavigationSession): MerchantNavigation {
  const tokenGetter = useRef(getToken);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  if (snapshot && (snapshot.userId !== userId || snapshot.sessionId !== sessionId)) setSnapshot(null);
  useEffect(() => { tokenGetter.current = getToken; }, [getToken]);

  useEffect(() => {
    if (!userId || !sessionId || hasAccess) return;
    let request: AbortController | undefined;
    const refresh = async () => {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const token = await tokenGetter.current();
        if (controller.signal.aborted) return;
        if (!token) throw new Error("A session token is required.");
        const result = await responseJson<{ application: unknown }>(await fetch(`${API_BASE_URL}/api/merchant-applications/me`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        }));
        if (controller.signal.aborted) return;
        if (!result || !validApplication(result.application)) throw new Error("Invalid application status.");
        setSnapshot({ userId, sessionId, registered: result.application !== null });
      } catch {
        if (!controller.signal.aborted) setSnapshot(null);
      }
    };
    const updated = (event: Event) => {
      const detail = (event as CustomEvent<ApplicationUpdate>).detail;
      if (detail?.userId !== userId || !validApplication(detail.application)) return;
      request?.abort();
      setSnapshot({ userId, sessionId, registered: detail.application !== null });
    };
    window.addEventListener(MERCHANT_APPLICATION_UPDATED, updated);
    window.addEventListener("focus", refresh);
    void refresh();
    return () => {
      request?.abort();
      window.removeEventListener(MERCHANT_APPLICATION_UPDATED, updated);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, sessionId, hasAccess]);

  if (!userId) return { label: "Daftar Merchant", href: "/merchant/register" };
  if (hasAccess) return { label: "Manage Merchant", href: "/merchant" };
  const known = snapshot?.userId === userId && snapshot?.sessionId === sessionId;
  return { label: known ? (snapshot.registered ? "Manage Merchant" : "Daftar Merchant") : "Merchant", href: "/merchant/register" };
}
