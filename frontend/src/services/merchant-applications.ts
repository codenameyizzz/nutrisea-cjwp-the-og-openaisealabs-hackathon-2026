"use client";

import { useCallback, useMemo } from "react";
import { useIngredientApi } from "./ingredient-api";
import { responseJson } from "@/lib/api";
import { publishMerchantApplication } from "./merchant-navigation";

export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";
export interface MerchantApplicationInput {
  business_name: string; owner_name: string; contact_email: string; contact_phone: string;
  area: string; address: string; cuisine_type: string;
}
export interface MerchantApplication extends MerchantApplicationInput {
  id: string; status: ApplicationStatus; merchant_id: string | null;
  review_reason: string | null; created_at: string; updated_at: string; reviewed_at: string | null;
}
export interface ApplicationResult { application: MerchantApplication | null }
export interface ApplicationList { items: MerchantApplication[]; total: number; page: number }

export function useMerchantApplications() {
  const { authenticatedFetch, isLoaded, isSignedIn, userId } = useIngredientApi();
  const request = useCallback(async <T,>(path: string, init: RequestInit = {}) =>
    responseJson<T>(await authenticatedFetch(path, init)), [authenticatedFetch]);
  return useMemo(() => ({
    isLoaded, isSignedIn, userId,
    own: async (signal?: AbortSignal) => {
      const result = await request<ApplicationResult>("/api/merchant-applications/me", { signal });
      if (!signal?.aborted) publishMerchantApplication(userId, result.application);
      return result;
    },
    submit: async (data: MerchantApplicationInput) => {
      const result = await request<ApplicationResult>("/api/merchant-applications/me", {
        method: "POST", body: JSON.stringify(data),
      });
      publishMerchantApplication(userId, result.application);
      return result;
    },
    list: (status: ApplicationStatus, page: number, signal?: AbortSignal) => request<ApplicationList>(
      `/api/admin/merchant-applications?${new URLSearchParams({ status, page: String(page) })}`, { signal }),
    review: (application: MerchantApplication, decision: "APPROVED" | "REJECTED", reason: string) => request<ApplicationResult>(
      `/api/admin/merchant-applications/${encodeURIComponent(application.id)}/review`, {
        method: "POST", body: JSON.stringify({ decision, reason, expected_updated_at: application.updated_at }),
      }),
  }), [isLoaded, isSignedIn, userId, request]);
}
