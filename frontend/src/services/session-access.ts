import type { IngredientAccess } from "./ingredient-types";

export type ClerkRole = "CONSUMER" | "MERCHANT_ADMIN" | "SHOPEE_ADMIN";

// UI checks use Clerk's session claims. The API independently verifies the JWT.
export function sessionAccess(claims: unknown): IngredientAccess {
  const metadata = (claims as { metadata?: unknown } | null)?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Access metadata is missing from your Clerk session. Check the custom session claims and sign in again.");
  }
  const value = metadata as Record<string, unknown>;
  const role = value.role === undefined ? "CONSUMER" : value.role;
  const ids = value.merchant_ids === undefined ? [] : value.merchant_ids;
  if (!["CONSUMER", "MERCHANT_ADMIN", "SHOPEE_ADMIN"].includes(role as string) ||
      !Array.isArray(ids) || ids.some(id => typeof id !== "string" || !id.trim() || id.length > 32)) {
    throw new Error("Clerk session access metadata is invalid");
  }
  return { role: role as ClerkRole, is_admin: role === "SHOPEE_ADMIN",
    can_edit_menus: role === "SHOPEE_ADMIN" || (role === "MERCHANT_ADMIN" && ids.length > 0), merchant_ids: ids };
}
