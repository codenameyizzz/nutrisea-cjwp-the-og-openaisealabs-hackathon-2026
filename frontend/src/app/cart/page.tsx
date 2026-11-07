"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Tag,
  CheckCircle2,
  Clock,
  Store
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import FoodImage from "@/components/FoodImage";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, ApiError, responseJson } from "@/lib/api";
import { useAccountSession } from "@/context/AccountSessionContext";
import { checkoutPayload, orderConfirmation } from "./checkout";
import styles from "./cart.module.css";

export default function CartPage() {
  const router = useRouter();
  const { userId, isLoaded, isSignedIn, getToken } = useAuth();
  const { account } = useAccountSession();
  const { cartItems, removeFromCart, clearCart, cartTotal, cartCount, addToCart } = useApp();

  const [paymentMethod, setPaymentMethod] = useState<"shopeepay" | "seabank">("seabank");
  const [voucherCode, setVoucherCode] = useState<string>("SEABANKSEHAT");
  const [voucherApplied, setVoucherApplied] = useState<boolean>(true);
  const [orderSuccess, setOrderSuccess] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const checkingOut = useRef(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const deliveryFee = 10000;
  const deliveryDiscount = -10000; // Free delivery promo
  const seabankDiscount = voucherApplied ? (paymentMethod === "seabank" ? 10000 : 5000) : 0;
  const finalTotal = Math.max(0, cartTotal + deliveryFee + deliveryDiscount - seabankDiscount);

  const handleApplyVoucher = () => {
    if (voucherCode.toUpperCase() === "SEABANKSEHAT" || voucherCode.toUpperCase() === "NUTRISEA35") {
      setVoucherApplied(true);
      showToast("Demo voucher applied. Example discount: up to Rp 10,000.");
    } else {
      showToast("Invalid voucher code.");
    }
  };

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

  return (
    <div className={styles.page}>
      {/* Toast Notification */}
      {toast && <p className={styles.notice} role="status">{toast}</p>}
      {checkoutError && <p className={styles.error} role="alert">{checkoutError}</p>}

      {/* Back button */}
      <button className={styles.back} onClick={() => router.back()}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to menu
      </button>

      <header className={styles.header}>
        <h1>NutriSea cart ({cartCount} items)</h1>
      </header>

      {cartItems.length === 0 ? (
        <section className={styles.empty} aria-labelledby="empty-cart-title">
          <ShoppingBag size={44} strokeWidth={1.6} aria-hidden="true" />
          <h2 id="empty-cart-title">Your cart is empty</h2>
          <p>
            Choose meals with nutrition information from the NutriSea catalog. No order has been placed.
          </p>
          <button
            className="btn-shopee-primary"
            onClick={() => router.push("/")}
          >
            Browse meals
          </button>
        </section>
      ) : (
        <div className={`cart-grid ${styles.grid}`}>
          {/* Left Column: Items List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className={styles.panel}>
              <div className={styles.sectionHeader}>
                <h2>Your selected meals</h2>
                <p>Menu information from the catalog</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {cartItems.map((item, idx) => (
                  <div
                    key={item.dish.id}
                    className={styles.item}
                    style={{
                      display: "flex",
                      gap: 12,
                      paddingBottom: 14,
                      borderBottom: idx < cartItems.length - 1 ? "1px solid #F4F4F4" : "none"
                    }}
                  >
                    <FoodImage
                      src={item.dish.imageUrl}
                      alt={item.dish.name}
                      style={{ width: 68, height: 68, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#222", lineHeight: 1.4 }}>
                        {item.dish.name}
                      </div>

                      <div style={{ fontSize: "12px", color: "#555", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <Store size={12} color="#EE4D2D" />
                        <span>{item.dish.merchantName}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#b43519" }}>
                          Rp {(item.dish.discountedPrice * item.qty).toLocaleString("id-ID")}
                        </span>

                        {/* Quantity Counter */}
                        <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid #767676", borderRadius: 8, minHeight: 44 }}>
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${item.dish.name}`}
                            disabled={isCheckingOut}
                            onClick={() => {
                              if (item.qty > 1) {
                                addToCart(item.dish, -1);
                              } else {
                                removeFromCart(item.dish.id);
                              }
                            }}
                            style={{ background: "none", border: "none", padding: "0 8px", cursor: "pointer", color: "#666" }}
                          >
                            <Minus size={16} />
                          </button>
                          <span style={{ minWidth: 26, textAlign: "center", fontSize: "15px", fontWeight: 600 }}>
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${item.dish.name}`}
                            disabled={isCheckingOut}
                            onClick={() => addToCart(item.dish, 1)}
                            style={{ background: "none", border: "none", padding: "0 8px", cursor: "pointer", color: "#666" }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Custom Kitchen Notes Badge */}
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#C2410C",
                          backgroundColor: "#FFF7ED",
                          border: "1px solid #FFEDD5",
                          borderRadius: 4,
                          padding: "3px 8px",
                          marginTop: 8,
                          display: "inline-block"
                        }}
                      >
                        Kitchen notes: {item.dish.cookingNotes}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isCheckingOut}
                      onClick={() => removeFromCart(item.dish.id)}
                      style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4, alignSelf: "flex-start" }}
                      aria-label={`Remove ${item.dish.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Voucher demo */}
            <div className={`${styles.panel} ${styles.voucher}`}>
              <Tag size={18} color="#EE4D2D" style={{ flexShrink: 0 }} />
              <input
                type="text"
                aria-label="Simulated voucher code"
                disabled={isCheckingOut}
                placeholder="Demo voucher code"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                style={{ flex: 1, border: "1px solid #767676", borderRadius: 8, padding: "10px 12px", fontSize: "16px" }}
              />
              <button
                type="button"
                disabled={isCheckingOut}
                onClick={handleApplyVoucher}
                style={{ backgroundColor: "#FFF0EB", border: "1px solid #b43519", color: "#a93219", borderRadius: 8, padding: "10px 14px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
              >
                Apply
              </button>
            </div>
          </div>

          {/* Right Column: Address, Payment Method & Summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Delivery Destination */}
            <div
              className={styles.panel}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start"
              }}
            >
              <MapPin size={18} color="#EE4D2D" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#222" }}>
                  Sample address (simulation)
                </div>
                <div style={{ fontSize: "14px", color: "#555", marginTop: 8 }}>
                  Equity Tower, SCBD / Kuningan, South Jakarta
                </div>
                <div style={{ fontSize: "13px", color: "#247243", marginTop: 8, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={12} /> No actual delivery
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className={styles.panel}>
              <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#222", marginBottom: 10 }}>
                Payment options (simulation)
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* SeaBank Direct Option */}
                <button
                  type="button"
                  disabled={isCheckingOut}
                  aria-pressed={paymentMethod === "seabank"}
                  className={styles.paymentChoice}
                  onClick={() => setPaymentMethod("seabank")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: paymentMethod === "seabank" ? "1px solid #003B7A" : "1px solid #E5E5E5",
                    backgroundColor: paymentMethod === "seabank" ? "#F0F5FA" : "#FAFAFA",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: paymentMethod === "seabank" ? "4px solid #003B7A" : "1px solid #CCC", backgroundColor: "#FFF" }} />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#003B7A" }}>
                        SeaBank (demo)
                      </div>
                      <div style={{ fontSize: "13px", color: "#555", marginTop: 4 }}>
                        Example Rp 10,000 discount; not an official offer
                      </div>
                    </div>
                  </div>
                </button>

                {/* ShopeePay Option */}
                <button
                  type="button"
                  disabled={isCheckingOut}
                  aria-pressed={paymentMethod === "shopeepay"}
                  className={styles.paymentChoice}
                  onClick={() => setPaymentMethod("shopeepay")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: paymentMethod === "shopeepay" ? "1px solid #EE4D2D" : "1px solid #E5E5E5",
                    backgroundColor: paymentMethod === "shopeepay" ? "#FFF5F1" : "#FAFAFA",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", border: paymentMethod === "shopeepay" ? "4px solid #EE4D2D" : "1px solid #CCC", backgroundColor: "#FFF" }} />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#a93219" }}>
                        ShopeePay
                      </div>
                      <div style={{ fontSize: "13px", color: "#555", marginTop: 4 }}>
                        Example balance: Rp 124,500
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className={`${styles.panel} ${styles.summary}`}>
              <h2>
                Simulated cost breakdown
              </h2>

              <div className={styles.priceRow}>
                <span>Meal subtotal ({cartCount} items)</span>
                <span>Rp {cartTotal.toLocaleString("id-ID")}</span>
              </div>

              <div className={styles.priceRow}>
                <span>Example delivery fee</span>
                <span>Rp {deliveryFee.toLocaleString("id-ID")}</span>
              </div>

              <div className={styles.priceRow} style={{ color: "#247243" }}>
                <span>Example delivery discount</span>
                <span>- Rp {Math.abs(deliveryDiscount).toLocaleString("id-ID")}</span>
              </div>

              {seabankDiscount > 0 && (
                <div className={styles.priceRow} style={{ color: "#003B7A" }}>
                  <span>Example discount: {paymentMethod === "seabank" ? "SeaBank Direct" : "meal voucher"}</span>
                  <span>- Rp {seabankDiscount.toLocaleString("id-ID")}</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#222",
                  borderTop: "1px dashed #DDD",
                  paddingTop: 10,
                  marginTop: 4
                }}
              >
                <span>Simulated total</span>
                <span style={{ color: "#b43519" }}>
                  Rp {finalTotal.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            <p className={styles.notice}>This is a checkout simulation. No payment or order is sent to ShopeeFood or SeaBank.</p>
            {/* Checkout Button */}
            <button
              type="button"
              className="btn-shopee-primary"
              disabled={!isLoaded || isCheckingOut}
              style={{ width: "100%", minHeight: 48, fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={handleCheckout}
            >
              {isCheckingOut ? "Processing order..." : isSignedIn ? "Confirm simulated order" : "Sign in to order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
