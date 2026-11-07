import { API_BASE_URL, responseJson } from "../lib/api";
import { refreshedSessionAccess } from "./account-bootstrap";

export const ACCOUNT_UPDATED = "nutrisea:account-updated";
export interface AccountProfile {
  age: number; sex: "M" | "F"; height_cm: number; weight_kg: number;
  occupation: string | null; activity_level: string; goal: string; allergies: string[];
  meal_budget_idr: number; has_medical_condition: boolean; max_dinner_cut_pct: number;
  kcal_target: number;
}
export interface AccountSnapshot {
  dietary_needs?: string[] | null;
  dietary_guidance?: "professional" | "personal" | "undisclosed" | null;
  allergy_status?: "reported" | "none" | "undisclosed" | null;
  user: { id: string; name: string; role: string };
  onboarding_complete: boolean;
  main_persona_id: string | null;
  main_persona: { id: string; full_name: string; archetype_code: string; archetype_name: string;
    target_lunch_budget_idr: number; health_goal: string; target_lunch_kcal: number; preferred_tags: string;
    preferred_cuisines: string; allergens: string; medical_conditions: string; side_persona_ids?: string[] } | null;
  side_persona_ids: string[];
  profile: AccountProfile | null;
}

export async function initializeAccountSession(userId: string,
  getToken: (options: { skipCache: boolean }) => Promise<string | null>, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const provision = await responseJson<{ role: string; initialized: boolean; account: { user_id: string; name: string; email: string | null } }>(
    await fetcher("/api/auth/bootstrap", { method: "POST", cache: "no-store", signal }));
  signal?.throwIfAborted();
  if (provision.account.user_id !== userId) throw new Error("Your account identity changed. Please reload the page.");
  const token = await getToken({ skipCache: true });
  signal?.throwIfAborted();
  const access = refreshedSessionAccess(token, userId);
  const account = await responseJson<AccountSnapshot>(await fetcher(`${API_BASE_URL}/api/users/sync`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(provision.account), cache: "no-store", signal,
  }));
  if (account.user.id !== userId) throw new Error("The synced account does not match your session.");
  return { account, needsPersona: access.role === "CONSUMER" && !account.onboarding_complete };
}
