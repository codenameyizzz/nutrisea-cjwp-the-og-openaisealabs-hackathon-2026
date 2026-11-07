"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, Trash2, Plus, Minus, CheckCircle2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, ApiError, responseJson } from "@/lib/api";
import { useAccountSession } from "@/context/AccountSessionContext";
import FoodImage from "@/components/FoodImage";
import { checkoutPayload, orderConfirmation } from "./checkout";
import styles from "./cart.module.css";

const rupiah = (value: number) => `Rp ${value.toLocaleString("en-US")}`;

export default function CartPage() {
  const router = useRouter();
  const { userId, isLoaded, isSignedIn, getToken } = useAuth();
  const { account } = useAccountSession();
  const { cartItems, removeFromCart, clearCart, cartTotal, cartCount, addToCart } = useApp();
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkingOut = useRef(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);

  // Keep the existing simulated-order defaults in backend/app/db/crud.py:create_order.
  const deliveryFee = 10000;
  const deliveryDiscount = 10000;
  const demoAdjustment = 10000;
  const appliedAdjustment = Math.min(demoAdjustment, Math.max(0, cartTotal + deliveryFee - deliveryDiscount));
  const finalTotal = Math.max(0, cartTotal + deliveryFee - deliveryDiscount - demoAdjustment);

  const handleCheckout = async () => {
    if (!isLoaded || checkingOut.current || !cartItems.length) return;
    if (!isSignedIn || !userId) {
      router.push("/sign-in?redirect_url=%2Fcart");
      return;
    }
    if (!account?.onboarding_complete) {
      router.push("/onboarding/personas");
      return;
    }
    checkingOut.current = true;
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const token = await getToken();
      if (!token) {
        router.push("/sign-in?redirect_url=%2Fcart");
        return;
      }
      const payload = checkoutPayload(cartItems, finalTotal);
      const result = orderConfirmation(await responseJson(await fetch(`${API_BASE_URL}/api/users/${userId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })));
      setOrderId(result.order_id);
      setOrderSuccess(true);
      clearCart();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/sign-in?redirect_url=%2Fcart");
      else if (err instanceof ApiError && err.status === 409) router.push("/onboarding/personas");
      else setCheckoutError(`${err instanceof Error ? err.message : "The order request failed."} Your cart is still available. If the connection was lost after confirmation, check your order history before trying again.`);
    } finally {
      checkingOut.current = false;
      setIsCheckingOut(false);
    }
  };

  if (orderSuccess) {
    return <section className={`${styles.page} ${styles.success}`} aria-labelledby="order-success-title">
      <CheckCircle2 size={40} color="#247243" />
      <h1 id="order-success-title">Simulated order saved</h1>
      <p>Order number: <strong>{orderId}</strong></p>
      <p>Your order is saved in NutriSea. No payment, ShopeeFood order, driver booking, or SeaBank transfer has been made.</p>
      <button className="btn-shopee-primary" onClick={() => router.push("/")}>Browse more meals</button>
    </section>;
  }

  return <div className={styles.page}>
    {checkoutError && <p className={styles.error} role="alert">{checkoutError}</p>}
    <button className={styles.back} onClick={() => router.push("/")}><ArrowLeft size={18} aria-hidden="true" /> Back to menu</button>
    <header className={styles.header}><h1>Your cart ({cartCount} {cartCount === 1 ? "item" : "items"})</h1></header>
    {cartItems.length === 0 ? <section className={styles.empty} aria-labelledby="empty-cart-title">
      <ShoppingBag size={44} strokeWidth={1.6} aria-hidden="true" />
      <h2 id="empty-cart-title">Your cart is empty</h2>
      <p>Add a meal to review its price and quantity here.</p>
      <button className="btn-shopee-primary" onClick={() => router.push("/")}>Browse meals</button>
    </section> : <div className={`cart-grid ${styles.grid}`}>
      <section className={styles.panel} aria-labelledby="cart-items-title">
        <h2 id="cart-items-title" className={styles.sectionTitle}>Selected meals</h2>
        <ul className={styles.items}>
          {cartItems.map(item => <li key={item.dish.id} className={styles.item}>
            <FoodImage src={item.dish.imageUrl} alt={item.dish.name} className={styles.thumbnail} width={72} height={72} />
            <div className={styles.itemInfo}>
              <h3>{item.dish.name}</h3>
              <p>{item.dish.merchantName}</p>
              <span>{rupiah(item.dish.discountedPrice)} each</span>
            </div>
            <button type="button" className={styles.remove} disabled={isCheckingOut} onClick={() => removeFromCart(item.dish.id)} aria-label={`Remove ${item.dish.name}`}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <div className={styles.itemControls}>
              <div className={styles.quantity} aria-label={`Quantity of ${item.dish.name}`}>
                <button type="button" aria-label={`Decrease quantity of ${item.dish.name}`} disabled={isCheckingOut} onClick={() => item.qty > 1 ? addToCart(item.dish, -1) : removeFromCart(item.dish.id)}><Minus size={16} aria-hidden="true" /></button>
                <span aria-live="polite">{item.qty}</span>
                <button type="button" aria-label={`Increase quantity of ${item.dish.name}`} disabled={isCheckingOut} onClick={() => addToCart(item.dish, 1)}><Plus size={16} aria-hidden="true" /></button>
              </div>
              <p className={styles.itemSubtotal}><span>Subtotal</span><strong>{rupiah(item.dish.discountedPrice * item.qty)}</strong></p>
            </div>
            {item.dish.cookingNotes && <details className={styles.preparation}>
              <summary>Catalog preparation notes</summary>
              <p>{item.dish.cookingNotes}</p>
            </details>}
          </li>)}
        </ul>
      </section>
      <section className={`${styles.panel} ${styles.summary}`} aria-labelledby="order-summary-title">
        <h2 id="order-summary-title">Order summary</h2>
        <div className={styles.priceRow}><span>Meals ({cartCount} {cartCount === 1 ? "item" : "items"})</span><span>{rupiah(cartTotal)}</span></div>
        <div className={styles.priceRow}><span>Delivery fee</span><span>{rupiah(deliveryFee)}</span></div>
        <div className={styles.priceRow}><span>Delivery credit</span><span>− {rupiah(deliveryDiscount)}</span></div>
        <div className={styles.priceRow}><span>Demo adjustment</span><span>− {rupiah(appliedAdjustment)}</span></div>
        <div className={styles.total}><span>Total</span><strong>{rupiah(finalTotal)}</strong></div>
        <p className={styles.disclaimer}>Simulated checkout. Fees and adjustments use demo settings. No payment, delivery, or order is sent to ShopeeFood or SeaBank.</p>
        <button type="button" className="btn-shopee-primary" disabled={!isLoaded || isCheckingOut} onClick={handleCheckout}>
          {isCheckingOut ? "Processing order..." : isSignedIn ? "Confirm simulated order" : "Sign in to order"}
        </button>
      </section>
    </div>}
  </div>;
}
