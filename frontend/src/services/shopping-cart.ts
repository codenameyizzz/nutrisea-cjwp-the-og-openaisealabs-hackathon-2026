import type { DishItem } from "../data/menu";

export const CART_STORAGE_KEY = "nutrisea_shopping_cart";
export const CART_OWNER_KEY = "nutrisea_cart_owner";
export interface StoredCartItem { dish: DishItem; qty: number }

export function restoreCart(raw: string | null): StoredCartItem[] {
  try {
    const value = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && Number.isInteger(item.qty) && item.qty > 0 &&
      item.dish && typeof item.dish.id === "string" && typeof item.dish.name === "string" &&
      Number.isFinite(item.dish.discountedPrice) && item.dish.discountedPrice >= 0);
  } catch { return []; }
}

export function restoreAccountCart(raw: string | null, previousOwner: string | null, currentOwner: string) {
  return previousOwner && previousOwner !== "guest" && previousOwner !== currentOwner ? [] : restoreCart(raw);
}
