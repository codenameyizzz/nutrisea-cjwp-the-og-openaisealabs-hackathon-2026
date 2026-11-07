import type { DishItem } from "@/data/menu";

export function checkoutPayload(items: { dish: DishItem; qty: number }[], total: number) {
  if (!items.length) throw new Error("Your cart is empty.");
  const merchant = items[0].dish.merchantId;
  if (!merchant || items.some(item => !item.dish.merchantId)) {
    throw new Error("Merchant information for this meal is unavailable. Reload the catalog before ordering.");
  }
  if (items.some(item => item.dish.merchantId !== merchant)) {
    throw new Error("This simulation supports one merchant per order. Choose meals from the same merchant.");
  }
  if (!Number.isFinite(total) || total < 0 || items.some(item => !Number.isInteger(item.qty) || item.qty < 1 || !Number.isFinite(item.dish.discountedPrice) || item.dish.discountedPrice < 0)) {
    throw new Error("A meal quantity or price is invalid. Please review your cart.");
  }
  return { merchant_id: merchant, total_idr: total,
    items: items.map(item => ({ item_id: item.dish.id, qty: item.qty, price_idr: item.dish.discountedPrice })),
    kitchen_notes: items.map(item => `${item.dish.name}: ${item.dish.cookingNotes || "No additional notes"}`).join("\n"),
    is_healthy_pick: false };
}

export function orderConfirmation(value: unknown): { order_id: number } {
  const order = value as { status?: unknown; order_id?: unknown } | null;
  if (order?.status !== "CONFIRMED" || typeof order.order_id !== "number" || !Number.isInteger(order.order_id) || order.order_id <= 0) {
    throw new Error("The server has not confirmed an order number. Check your order history before trying again.");
  }
  return { order_id: order.order_id };
}
