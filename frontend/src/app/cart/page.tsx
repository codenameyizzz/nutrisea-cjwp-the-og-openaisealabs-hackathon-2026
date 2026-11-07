"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Wallet,
  Tag,
  CheckCircle2,
  Clock,
  Bike,
  ShieldCheck,
  ChevronRight,
  Store
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, ApiError, responseJson } from "@/lib/api";
import { useAccountSession } from "@/context/AccountSessionContext";

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
      showToast("Voucher berhasil diterapkan! Hemat hingga Rp 10.000");
    } else {
      showToast("Kode voucher tidak valid.");
    }
  };

  const handleCheckout = async () => {
    if (!isLoaded || isCheckingOut || !cartItems.length) return;
    if (!isSignedIn || !userId) {
      router.push("/sign-in?redirect_url=%2Fcart");
      return;
    }
    if (!account?.onboarding_complete) {
      router.push("/onboarding/personas");
      return;
    }
    setIsCheckingOut(true);
    try {
      const token = await getToken();
      if (!token) {
        router.push("/sign-in?redirect_url=%2Fcart");
        return;
      }
      await responseJson(await fetch(`${API_BASE_URL}/api/users/${userId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          merchant_id: "MTR-WBM-01",
          total_idr: finalTotal,
          items: cartItems.map((item) => ({
            item_id: item.dish.id,
            qty: item.qty,
            price_idr: item.dish.discountedPrice
          })),
          kitchen_notes: "Nasi setengah porsi, kuah santan dipisah, minim garam",
          is_healthy_pick: true
        })
      }));
      setOrderSuccess(true);
      clearCart();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/sign-in?redirect_url=%2Fcart");
      else if (err instanceof ApiError && err.status === 409) router.push("/onboarding/personas");
      else showToast(err instanceof Error ? err.message : "Pesanan gagal dibuat. Silakan coba lagi.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (orderSuccess) {
    return (
      <div style={{ maxWidth: 560, margin: "20px auto", backgroundColor: "#FFFFFF", padding: "28px 24px", borderRadius: 8, border: "1px solid #E5E5E5", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, backgroundColor: "#EAF9EE", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <CheckCircle2 size={32} color="#00B14F" />
          </div>
          <h2 style={{ fontSize: "19px", fontWeight: 600, color: "#222" }}>
            Pesanan ShopeeFood Dikonfirmasi!
          </h2>
          <p style={{ fontSize: "12.5px", color: "#666", marginTop: 4, lineHeight: 1.5 }}>
            Instruksi dapur rendah minyak & sodium telah diteruskan otomatis ke mitra warteg SCBD.
          </p>
        </div>

        {/* Delivery Tracker Card */}
        <div style={{ backgroundColor: "#F9FBF9", border: "1px solid #D7EEDD", borderRadius: 8, padding: "14px 16px", margin: "20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12.5px", fontWeight: 600, color: "#00B14F" }}>
              <Bike size={16} />
              <span>Mitra Driver Sedang Menuju Warung</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#333", backgroundColor: "#FFFFFF", padding: "2px 8px", borderRadius: 10, border: "1px solid #E0E0E0" }}>
              Tiba 12:15 WIB
            </span>
          </div>

          {/* Timeline steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "11.5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#00B14F" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#00B14F" }} />
              <strong>Pesanan Diterima Warteg Mitra Higienis</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#CCC" }} />
              <span>Dapur sedang memasak sesuai instruksi NutriSea</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#CCC" }} />
              <span>Pengantaran ke Gedung Equity Tower, SCBD</span>
            </div>
          </div>
        </div>

        {/* SeaBank Rewards Notification */}
        <div style={{ backgroundColor: "#F0F5FA", border: "1px solid #CCE0F5", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#003B7A", display: "flex", alignItems: "center", gap: 6 }}>
            <Wallet size={14} /> SeaBank Wellness Cashback Dikreditkan!
          </div>
          <div style={{ fontSize: "11.5px", color: "#555", marginTop: 3 }}>
            Cashback <strong>Rp 10.000</strong> dan status streak gizi sehat Anda hari ini telah dicatat ke akun SeaBank.
          </div>
        </div>

        <button
          className="btn-shopee-primary"
          style={{ width: "100%", height: 42, fontSize: "13px" }}
          onClick={() => {
            setOrderSuccess(false);
            router.push("/");
          }}
        >
          Kembali ke Beranda Menu Sehat
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toast Notification */}
      {toast && <div className="app-toast">{toast}</div>}

      {/* Back button */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: "12.5px",
            color: "#666",
            padding: 0
          }}
        >
          <ArrowLeft size={14} /> Kembali ke Menu
        </button>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: "19px", fontWeight: 600, color: "#222" }}>
          Keranjang ShopeeFood NutriSea ({cartCount} Menu)
        </h1>
      </div>

      {cartItems.length === 0 ? (
        <div style={{ backgroundColor: "#FFFFFF", padding: "48px 20px", borderRadius: 8, textAlign: "center", border: "1px solid #E5E5E5" }}>
          <ShoppingBag size={46} color="#DDD" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#333" }}>Keranjang Belanja Masih Kosong</div>
          <p style={{ fontSize: "12px", color: "#777", marginTop: 4 }}>
            Pilih menu makanan sehat terverifikasi higienis dari katalog NutriSea.
          </p>
          <button
            className="btn-shopee-primary"
            style={{ marginTop: 18, height: 38, padding: "0 20px" }}
            onClick={() => router.push("/")}
          >
            Eksplorasi Menu Sehat
          </button>
        </div>
      ) : (
        <div className="cart-grid">
          {/* Left Column: Items List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: "16px 18px", boxShadow: "var(--shadow-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: "1px solid #F0F0F0", paddingBottom: 10 }}>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#222" }}>
                  Daftar Pesanan Menu Sehat
                </span>
                <span style={{ fontSize: "11px", color: "#00B14F", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  <ShieldCheck size={13} /> Standar Higienis Terjamin
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {cartItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 12,
                      paddingBottom: 14,
                      borderBottom: idx < cartItems.length - 1 ? "1px solid #F4F4F4" : "none"
                    }}
                  >
                    <img
                      src={item.dish.imageUrl}
                      alt={item.dish.name}
                      style={{ width: 68, height: 68, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#222" }}>
                        {item.dish.name}
                      </div>

                      <div style={{ fontSize: "12px", color: "#666", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <Store size={12} color="#EE4D2D" />
                        <span>{item.dish.merchantName}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#EE4D2D" }}>
                          Rp {(item.dish.discountedPrice * item.qty).toLocaleString("id-ID")}
                        </span>

                        {/* Quantity Counter */}
                        <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid #DDD", borderRadius: 4, height: 28 }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.qty > 1) {
                                addToCart(item.dish, -1);
                              } else {
                                removeFromCart(item.dish.id);
                              }
                            }}
                            style={{ background: "none", border: "none", padding: "0 8px", cursor: "pointer", color: "#666" }}
                          >
                            <Minus size={11} />
                          </button>
                          <span style={{ minWidth: 22, textAlign: "center", fontSize: "12px", fontWeight: 600 }}>
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => addToCart(item.dish, 1)}
                            style={{ background: "none", border: "none", padding: "0 8px", cursor: "pointer", color: "#666" }}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Custom Kitchen Notes Badge */}
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#C2410C",
                          backgroundColor: "#FFF7ED",
                          border: "1px solid #FFEDD5",
                          borderRadius: 4,
                          padding: "3px 8px",
                          marginTop: 8,
                          display: "inline-block"
                        }}
                      >
                        Instruksi Dapur: {item.dish.cookingNotes}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.dish.id)}
                      style={{ background: "none", border: "none", color: "#AAA", cursor: "pointer", padding: 4, alignSelf: "flex-start" }}
                      aria-label="Hapus"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Voucher Box */}
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
              <Tag size={18} color="#EE4D2D" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Masukkan Kode Voucher (e.g. SEABANKSEHAT)"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                style={{ flex: 1, border: "1px solid #DDD", borderRadius: 4, padding: "7px 10px", fontSize: "12px", outline: "none" }}
              />
              <button
                type="button"
                onClick={handleApplyVoucher}
                style={{ backgroundColor: "#FFF0EB", border: "1px solid #EE4D2D", color: "#EE4D2D", borderRadius: 4, padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                Gunakan
              </button>
            </div>
          </div>

          {/* Right Column: Address, Payment Method & Summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Delivery Destination */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E5E5",
                borderRadius: 8,
                padding: "14px 16px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start"
              }}
            >
              <MapPin size={18} color="#EE4D2D" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#222" }}>
                  Alamat Pengantaran
                </div>
                <div style={{ fontSize: "12px", color: "#555", marginTop: 2 }}>
                  Gedung Equity Tower, SCBD / Kuningan, Jakarta Selatan
                </div>
                <div style={{ fontSize: "11px", color: "#00B14F", marginTop: 3, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={12} /> Estimasi Tiba: 20-25 Menit
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#222", marginBottom: 10 }}>
                Metode Pembayaran
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* SeaBank Direct Option */}
                <button
                  type="button"
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
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#003B7A" }}>
                        SeaBank Direct Pay
                      </div>
                      <div style={{ fontSize: "10.5px", color: "#555" }}>
                        Ekstra Cashback Rp 10.000 + Bunga Spesial
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#00B14F", fontWeight: 600, backgroundColor: "#EAF9EE", padding: "2px 6px", borderRadius: 4 }}>
                    HEMAT TERBAIK
                  </span>
                </button>

                {/* ShopeePay Option */}
                <button
                  type="button"
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
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#EE4D2D" }}>
                        ShopeePay
                      </div>
                      <div style={{ fontSize: "10.5px", color: "#555" }}>
                        Saldo Tersedia: Rp 124.500
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#00B14F", fontWeight: 500 }}>
                    Saldo Cukup
                  </span>
                </button>
              </div>
            </div>

            {/* Price Breakdown */}
            <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 8, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#222" }}>
                Rincian Pembayaran
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666" }}>
                <span>Subtotal Menu ({cartCount} item)</span>
                <span>Rp {cartTotal.toLocaleString("id-ID")}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666" }}>
                <span>Ongkos Kirim ShopeeFood</span>
                <span>Rp {deliveryFee.toLocaleString("id-ID")}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#00B14F" }}>
                <span>Gratis Ongkir NutriSea</span>
                <span>- Rp {Math.abs(deliveryDiscount).toLocaleString("id-ID")}</span>
              </div>

              {seabankDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#003B7A", fontWeight: 500 }}>
                  <span>Diskon Promo {paymentMethod === "seabank" ? "SeaBank Direct" : "Voucher Sehat"}</span>
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
                <span>Total Pembayaran</span>
                <span style={{ color: "#EE4D2D" }}>
                  Rp {finalTotal.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              className="btn-shopee-primary"
              disabled={!isLoaded || isCheckingOut}
              style={{ width: "100%", height: 44, fontSize: "13.5px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={handleCheckout}
            >
              {isCheckingOut ? "Memproses Pesanan..." : isSignedIn ? "Pesan Sekarang (1-Klik Checkout)" : "Masuk untuk Memesan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
