"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  X,
  TrendingUp,
  Award,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Flame
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useUser } from "@clerk/nextjs";

export default function SeaBankModal() {
  const { isSeaBankOpen, setIsSeaBankOpen } = useApp();
  const { user } = useUser();
  const [cashbackAmount, setCashbackAmount] = useState<number>(45000);
  const [orderCount, setOrderCount] = useState<number>(9);

  useEffect(() => {
    if (!isSeaBankOpen) return;
    const userId = user?.id || "CORP_LILY_SCBD";
    fetch(`http://127.0.0.1:8000/api/users/${userId}/rewards`)
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.total_reward_idr === "number") {
          // If user has orders in DB, show base + earned rewards
          const earned = data.total_reward_idr;
          setCashbackAmount(45000 + earned);
          const historyCount = Array.isArray(data.history) ? data.history.length : 0;
          setOrderCount(9 + historyCount);
        }
      })
      .catch((err) => console.warn("Failed to fetch SeaBank rewards from PostgreSQL:", err));
  }, [isSeaBankOpen, user?.id]);

  if (!isSeaBankOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease"
      }}
      onClick={() => setIsSeaBankOpen(false)}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          backgroundColor: "#FFFFFF",
          borderRadius: "12px",
          overflowY: "auto",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header SeaBank Navy Gradient */}
        <div
          style={{
            background: "linear-gradient(135deg, #003B7A 0%, #0056B3 100%)",
            color: "#FFFFFF",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                padding: "8px",
                borderRadius: "8px",
                display: "flex"
              }}
            >
              <Wallet size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "0.5px" }}>
                SeaBank Wellness Saver
              </div>
              <div style={{ fontSize: "11.5px", color: "rgba(255, 255, 255, 0.85)" }}>
                Tabungan Mikro Sehat & Reward Mitra Higienis
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsSeaBankOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              padding: 4
            }}
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card 1: Balance & Tier Stats */}
          <div
            style={{
              backgroundColor: "#F0F5FA",
              border: "1px solid #CCE0F5",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Saldo Tabungan SeaBank Sehat:
                </span>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#003B7A", marginTop: 2 }}>
                  Rp 2.495.000
                </div>
              </div>

              <span
                style={{
                  backgroundColor: "#EAF9EE",
                  color: "#00B14F",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <ShieldCheck size={13} /> Tier Gold Sehat
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 10, borderTop: "1px dashed #B8D4EF" }}>
              <div>
                <div style={{ fontSize: "10.5px", color: "#666" }}>Suku Bunga Tabungan:</div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#003B7A" }}>
                  4.5% p.a. <span style={{ fontSize: "10.5px", color: "#00B14F", fontWeight: 600 }}>(+0.5% Bonus Gizi)</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "10.5px", color: "#666" }}>Akumulasi Cashback:</div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#EE4D2D" }}>
                  Rp {cashbackAmount.toLocaleString("id-ID")}{" "}
                  <span style={{ fontSize: "10.5px", color: "#888", fontWeight: 400 }}>
                    ({orderCount}x Pesan)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Habit Streak Tracker (Gamification) */}
          <div
            style={{
              backgroundColor: "#FFF9F6",
              border: "1px solid #FFE4DB",
              borderRadius: "10px",
              padding: "16px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Flame size={18} color="#EE4D2D" />
                <span style={{ fontSize: "13.5px", fontWeight: 700, color: "#222" }}>
                  Streak Konsistensi Gizi: 5 Hari
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#EE4D2D", fontWeight: 600 }}>
                Senin - Jumat
              </span>
            </div>

            {/* Days row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, textAlign: "center" }}>
              {[
                { day: "Sen", ok: true },
                { day: "Sel", ok: true },
                { day: "Rab", ok: true },
                { day: "Kam", ok: true },
                { day: "Jum", ok: true }
              ].map((d, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #00B14F",
                    borderRadius: "6px",
                    padding: "6px 2px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3
                  }}
                >
                  <span style={{ fontSize: "10px", color: "#666" }}>{d.day}</span>
                  <CheckCircle2 size={15} color="#00B14F" />
                </div>
              ))}
            </div>

            <div style={{ fontSize: "11.5px", color: "#666", marginTop: 10, lineHeight: 1.4 }}>
              Konsisten 2 hari lagi untuk membuka <strong>Bonus Spesial Rp 25.000</strong> ke saldo SeaBank Anda!
            </div>
          </div>

          {/* Card 3: The 3-Step FinTech Flywheel */}
          <div>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#222", marginBottom: 8 }}>
              Bagaimana NutriSea & SeaBank Menguntungkan Anda?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "11.5px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", backgroundColor: "#FAFAFA", padding: "8px 12px", borderRadius: 6, border: "1px solid #EEEEEE" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#EE4D2D", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>
                  1
                </div>
                <div style={{ flex: 1, color: "#333" }}>
                  <strong>Pesan Menu Sehat NutriSea di ShopeeFood:</strong> Menu terverifikasi rendah santan & minyak baru.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", backgroundColor: "#FAFAFA", padding: "8px 12px", borderRadius: 6, border: "1px solid #EEEEEE" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#003B7A", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>
                  2
                </div>
                <div style={{ flex: 1, color: "#333" }}>
                  <strong>Cashback Rp 5.000 Masuk Otomatis ke SeaBank:</strong> Setiap kali pesanan sukses diantar.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", backgroundColor: "#FAFAFA", padding: "8px 12px", borderRadius: 6, border: "1px solid #EEEEEE" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#00B14F", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>
                  3
                </div>
                <div style={{ flex: 1, color: "#333" }}>
                  <strong>Bunga Tabungan Bertingkat Naik +0.5% p.a.:</strong> Mengubah kebiasaan makan menjadi tabungan masa depan.
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Recent Healthy Transactions */}
          <div>
            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#222", marginBottom: 8 }}>
              Riwayat Cashback Gizi Terbaru:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "11.5px" }}>
              {[
                { date: "24 Okt", place: "Warteg Berkah Mandiri", dish: "Paket Ayam Bakar Dada", reward: "+Rp 5.000" },
                { date: "23 Okt", place: "Dapur Sehat SCBD", dish: "Gado-Gado Quinoa", reward: "+Rp 5.000" },
                { date: "22 Okt", place: "Soto Kudus Higienis", dish: "Soto Ayam Bening Kuah Kaldu", reward: "+Rp 5.000" }
              ].map((tx, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderBottom: idx < 2 ? "1px solid #F0F0F0" : "none"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "#222" }}>{tx.place}</div>
                    <div style={{ fontSize: "10.5px", color: "#777" }}>{tx.dish} &bull; {tx.date}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: "#00B14F", fontSize: "12px" }}>
                    {tx.reward}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Close / Action Button */}
          <button
            onClick={() => setIsSeaBankOpen(false)}
            className="btn-shopee-primary"
            style={{ width: "100%", height: 42, fontSize: "13px", fontWeight: 600 }}
          >
            Lanjut Pesan Menu Sehat NutriSea
          </button>
        </div>
      </div>
    </div>
  );
}
