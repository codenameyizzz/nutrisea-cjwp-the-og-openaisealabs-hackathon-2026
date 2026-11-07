"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Scale,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  TrendingDown,
  Activity,
  Award,
  Wallet
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@clerk/nextjs";
import { useAccountSession } from "@/context/AccountSessionContext";
import { ACCOUNT_UPDATED } from "@/services/account-session";
import { API_BASE_URL, responseJson } from "@/lib/api";

export default function BmiPage() {
  const router = useRouter();
  const { heightCm, weightKg, activityGoal, updateBmi, bmiStats } = useApp();
  const { userId, getToken } = useAuth();
  const { account } = useAccountSession();

  const [localHeight, setLocalHeight] = useState(heightCm);
  const [localWeight, setLocalWeight] = useState(weightKg);
  const [localAge, setLocalAge] = useState<number>(26);
  const [localGender, setLocalGender] = useState<"wanita" | "pria">("wanita");
  const [localActivity, setLocalActivity] = useState<"sedentary" | "light" | "active">("sedentary");
  const [localGoal, setLocalGoal] = useState<"turun" | "ideal" | "otot">(activityGoal);
  const [toast, setToast] = useState<string | null>(null);

  // Quick preset loader for Lily
  const loadLilyPreset = () => {
    setLocalHeight(160);
    setLocalWeight(52);
    setLocalAge(26);
    setLocalGender("wanita");
    setLocalActivity("sedentary");
    setLocalGoal("ideal");
    showToast("Profil Persona Lily (SCBD Office Worker) dimuat!");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const data = account?.profile;
    if (!data) return;
    setLocalHeight(data.height_cm); setLocalWeight(data.weight_kg); setLocalAge(data.age);
    setLocalGender(data.sex === "M" ? "pria" : "wanita");
    setLocalGoal(data.goal === "LOSE_WEIGHT" ? "turun" : data.goal === "GAIN_MUSCLE" ? "otot" : "ideal");
  }, [account]);

  const handleSave = async () => {
    if (!userId) { router.push("/sign-in?redirect_url=%2Fbmi"); return; }
    try {
      const token = await getToken();
      if (!token) throw new Error("Silakan masuk kembali.");
      await responseJson(await fetch(`${API_BASE_URL}/api/users/${userId}/health-profile`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ age: localAge, sex: localGender === "pria" ? "M" : "F", height_cm: localHeight,
          weight_kg: localWeight, activity_level: localActivity.toUpperCase(),
          goal: localGoal === "turun" ? "LOSE_WEIGHT" : localGoal === "otot" ? "GAIN_MUSCLE" : "MAINTAIN",
          allergies: account?.profile?.allergies || [], meal_budget_idr: account?.profile?.meal_budget_idr || 35000,
          has_medical_condition: account?.profile?.has_medical_condition || false, max_dinner_cut_pct: 25 })
      }));
      updateBmi(localHeight, localWeight, localGoal);
      window.dispatchEvent(new Event(ACCOUNT_UPDATED));
      showToast("Target gizi dan kalori berhasil diperbarui!");
      router.push("/");
    } catch (error) { showToast(error instanceof Error ? error.message : "Profil gagal disimpan."); }
  };

  // Calculate live preview metrics
  const hMeter = localHeight / 100;
  const liveScore = localHeight > 0 ? Number((localWeight / (hMeter * hMeter)).toFixed(1)) : 20.3;
  
  let liveCategory = "Ideal (Normal)";
  let liveBadgeClass = "ideal";
  let spectrumPercent = 40; // Default center normal

  if (liveScore < 18.5) {
    liveCategory = "Kurus (Underweight)";
    liveBadgeClass = "warning";
    spectrumPercent = Math.min(22, Math.max(5, (liveScore / 18.5) * 22));
  } else if (liveScore >= 18.5 && liveScore < 23) {
    liveCategory = "Normal / Berat Ideal";
    liveBadgeClass = "ideal";
    spectrumPercent = 25 + ((liveScore - 18.5) / 4.5) * 25;
  } else if (liveScore >= 23 && liveScore < 25) {
    liveCategory = "Berisiko (Overweight)";
    liveBadgeClass = "warning";
    spectrumPercent = 53 + ((liveScore - 23) / 2) * 22;
  } else {
    liveCategory = "Obesitas";
    liveBadgeClass = "warning";
    spectrumPercent = Math.min(95, 78 + ((liveScore - 25) / 10) * 17);
  }

  // Estimated BMR using Mifflin-St Jeor
  const bmr = Math.round(
    localGender === "wanita"
      ? 10 * localWeight + 6.25 * localHeight - 5 * localAge - 161
      : 10 * localWeight + 6.25 * localHeight - 5 * localAge + 5
  );

  const activityMultiplier = localActivity === "sedentary" ? 1.2 : localActivity === "light" ? 1.375 : 1.55;
  let tdee = Math.round(bmr * activityMultiplier);
  if (localGoal === "turun") tdee = Math.max(1400, tdee - 300);
  if (localGoal === "otot") tdee += 300;

  return (
    <div>
      {/* Toast Notification */}
      {toast && <div className="app-toast">{toast}</div>}

      {/* Top Header & Navigation */}
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
          <ArrowLeft size={14} /> Kembali ke Menu Utama
        </button>
      </div>

      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: "19px", fontWeight: 600, color: "#222" }}>
            Kalkulator Kebutuhan Gizi & Standar BMI
          </h1>
          <p style={{ fontSize: "12px", color: "#666", marginTop: 3 }}>
            Perhitungan ilmiah standar Kemenkes RI & WHO Asia-Pasifik untuk rekomendasi menu ShopeeFood harian.
          </p>
        </div>

        <button
          onClick={loadLilyPreset}
          style={{
            backgroundColor: "#FFF5F1",
            border: "1px solid #EE4D2D",
            color: "#EE4D2D",
            borderRadius: "4px",
            padding: "5px 12px",
            fontSize: "11.5px",
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5
          }}
        >
          <Sparkles size={13} /> Muat Profil Lily (SCBD)
        </button>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="bmi-grid">
        {/* Left Column: Input Form */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            padding: "18px 20px",
            borderRadius: "8px",
            border: "1px solid var(--border-card)",
            boxShadow: "var(--shadow-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0F0F0", paddingBottom: 10 }}>
            <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#222" }}>
              Parameter Profil Fisik
            </div>
            <span style={{ fontSize: "11px", color: "#00B14F", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <ShieldCheck size={13} /> Terverifikasi Kemenkes
            </span>
          </div>

          {/* Gender & Age */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="bmi-input-group">
              <label className="bmi-input-label">Jenis Kelamin</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setLocalGender("wanita")}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 4,
                    border: localGender === "wanita" ? "1px solid #EE4D2D" : "1px solid #E0E0E0",
                    backgroundColor: localGender === "wanita" ? "#FFF5F1" : "#FAFAFA",
                    color: localGender === "wanita" ? "#EE4D2D" : "#555",
                    fontSize: "12px",
                    fontWeight: localGender === "wanita" ? 600 : 400,
                    cursor: "pointer"
                  }}
                >
                  Wanita
                </button>
                <button
                  type="button"
                  onClick={() => setLocalGender("pria")}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 4,
                    border: localGender === "pria" ? "1px solid #EE4D2D" : "1px solid #E0E0E0",
                    backgroundColor: localGender === "pria" ? "#FFF5F1" : "#FAFAFA",
                    color: localGender === "pria" ? "#EE4D2D" : "#555",
                    fontSize: "12px",
                    fontWeight: localGender === "pria" ? 600 : 400,
                    cursor: "pointer"
                  }}
                >
                  Pria
                </button>
              </div>
            </div>

            <div className="bmi-input-group">
              <label className="bmi-input-label">Usia</label>
              <div className="bmi-input-control">
                <input
                  type="number"
                  min="15"
                  max="80"
                  value={localAge}
                  onChange={(e) => setLocalAge(Number(e.target.value) || 26)}
                />
                <span className="bmi-input-unit">tahun</span>
              </div>
            </div>
          </div>

          {/* Height and Weight */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="bmi-input-group">
              <label className="bmi-input-label">Tinggi Badan</label>
              <div className="bmi-input-control">
                <input
                  type="number"
                  min="120"
                  max="220"
                  value={localHeight}
                  onChange={(e) => setLocalHeight(Number(e.target.value) || 0)}
                />
                <span className="bmi-input-unit">cm</span>
              </div>
            </div>

            <div className="bmi-input-group">
              <label className="bmi-input-label">Berat Badan</label>
              <div className="bmi-input-control">
                <input
                  type="number"
                  min="30"
                  max="180"
                  value={localWeight}
                  onChange={(e) => setLocalWeight(Number(e.target.value) || 0)}
                />
                <span className="bmi-input-unit">kg</span>
              </div>
            </div>
          </div>

          {/* Daily Activity Level */}
          <div className="bmi-input-group">
            <label className="bmi-input-label">Intensitas Aktivitas Harian</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { id: "sedentary", title: "Duduk Seharian (Kantoran/SCBD Desk)", sub: "Jarang berolahraga, duduk >7 jam/hari" },
                { id: "light", title: "Aktivitas Ringan (1-3x Jalan Santai/Gym)", sub: "Banyak berdiri atau jalan kaki sedang" },
                { id: "active", title: "Sangat Aktif (Latihan Intensif 4-5x)", sub: "Pekerja lapangan atau olahraga rutin" }
              ].map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setLocalActivity(act.id as any)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 4,
                    border: localActivity === act.id ? "1px solid #EE4D2D" : "1px solid #E5E5E5",
                    backgroundColor: localActivity === act.id ? "#FFF9F6" : "#FAFAFA",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: localActivity === act.id ? 600 : 500, color: localActivity === act.id ? "#EE4D2D" : "#333" }}>
                    {act.title}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#777", marginTop: 2 }}>
                    {act.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Goal Selector */}
          <div className="bmi-input-group">
            <label className="bmi-input-label">Target Kesehatan Anda</label>
            <div className="bmi-goals-grid">
              {[
                { key: "turun", label: "Defisit Kalori" },
                { key: "ideal", label: "Jaga Ideal" },
                { key: "otot", label: "Massa Otot" }
              ].map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`bmi-goal-btn ${localGoal === g.key ? "active" : ""}`}
                  onClick={() => setLocalGoal(g.key as any)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            className="btn-shopee-primary"
            style={{ width: "100%", marginTop: 4, height: 42, fontSize: "13px" }}
            onClick={handleSave}
          >
            Simpan & Sinkronkan ke Menu Sehat
          </button>
        </div>

        {/* Right Column: Calculated Results & Guides */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Result Summary Card */}
          <div className="bmi-result-summary">
            <div className="bmi-score-row">
              <div>
                <span style={{ fontSize: "11.5px", color: "#666", fontWeight: 500 }}>
                  Skor Indeks Massa Tubuh (BMI)
                </span>
                <div className="bmi-score-number">{liveScore}</div>
              </div>
              <span className={`bmi-category-badge ${liveBadgeClass}`} style={{ fontSize: "12px", padding: "4px 10px" }}>
                {liveCategory}
              </span>
            </div>

            {/* Visual Spectrum Gauge */}
            <div className="bmi-spectrum-container">
              <div className="bmi-spectrum-bar">
                <div className="spectrum-seg under" title="Kurus (<18.5)" />
                <div className="spectrum-seg normal" title="Ideal (18.5 - 22.9)" />
                <div className="spectrum-seg over" title="Berlebih (23.0 - 24.9)" />
                <div className="spectrum-seg obese" title="Obesitas (>=25.0)" />

                {/* Needle pointer */}
                <div
                  style={{
                    position: "absolute",
                    top: -3,
                    bottom: -3,
                    left: `${spectrumPercent}%`,
                    width: 4,
                    backgroundColor: "#111",
                    borderRadius: 2,
                    boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                    transform: "translateX(-50%)",
                    transition: "left 0.3s ease"
                  }}
                />
              </div>

              <div className="bmi-spectrum-labels">
                <span>&lt; 18.5 Kurus</span>
                <span style={{ color: "#00B14F", fontWeight: 600 }}>18.5 - 22.9 Ideal</span>
                <span>23 - 24.9 Berlebih</span>
                <span>&gt; 25 Obesitas</span>
              </div>
            </div>

            {/* Nutrients Grid */}
            <div className="bmi-nutrients-grid">
              <div className="bmi-nutrient-item">
                <span className="bmi-nutrient-val" style={{ color: "#EE4D2D" }}>{tdee} kcal</span>
                <span className="bmi-nutrient-lbl">Target Kalori / Hari</span>
              </div>
              <div className="bmi-nutrient-item">
                <span className="bmi-nutrient-val" style={{ color: "#00B14F" }}>
                  {Math.round(localWeight * (localGoal === "otot" ? 1.6 : 1.2))}g
                </span>
                <span className="bmi-nutrient-lbl">Target Protein</span>
              </div>
              <div className="bmi-nutrient-item">
                <span className="bmi-nutrient-val" style={{ color: "#0048A0" }}>&lt; 2.000 mg</span>
                <span className="bmi-nutrient-lbl">Batas Garam</span>
              </div>
            </div>

            {/* Meal Distribution Guide */}
            <div style={{ backgroundColor: "#FAFAFA", borderRadius: 6, padding: "10px 12px", border: "1px solid #ECECEC" }}>
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#333", marginBottom: 6 }}>
                Alokasi Porsi Kalori Sekali Makan:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, textAlign: "center" }}>
                <div style={{ background: "#FFFFFF", padding: "6px 4px", borderRadius: 4, border: "1px solid #EFEFEF" }}>
                  <div style={{ fontSize: "10px", color: "#777" }}>Sarapan</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginTop: 2 }}>
                    ~{Math.round(tdee * 0.25)} kcal
                  </div>
                </div>
                <div style={{ background: "#FFF5F1", padding: "6px 4px", borderRadius: 4, border: "1px solid #FFD8CC" }}>
                  <div style={{ fontSize: "10px", color: "#EE4D2D", fontWeight: 500 }}>Makan Siang</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#EE4D2D", marginTop: 2 }}>
                    ~{Math.round(tdee * 0.40)} kcal
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "6px 4px", borderRadius: 4, border: "1px solid #EFEFEF" }}>
                  <div style={{ fontSize: "10px", color: "#777" }}>Makan Malam</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginTop: 2 }}>
                    ~{Math.round(tdee * 0.35)} kcal
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Isi Piringku Guidelines */}
          <div className="balance-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#222" }}>
                Panduan Porsi "Isi Piringku" (Kemenkes RI)
              </div>
              <span style={{ fontSize: "10px", color: "#666" }}>Per Sekali Makan</span>
            </div>

            <div className="balance-item-row">
              <div className="balance-label-row">
                <span style={{ color: "#D97706" }}>Karbohidrat Kompleks (Nasi Merah/Jagung/Ubi)</span>
                <span>35% (1/3 Piring)</span>
              </div>
              <div className="balance-track">
                <div className="balance-fill carb" style={{ width: "35%" }} />
              </div>
            </div>

            <div className="balance-item-row">
              <div className="balance-label-row">
                <span style={{ color: "#00B14F" }}>Lauk Protein Sehat (Ikan/Dada Ayam/Tempe)</span>
                <span>35% (1/3 Piring)</span>
              </div>
              <div className="balance-track">
                <div className="balance-fill protein" style={{ width: "35%" }} />
              </div>
            </div>

            <div className="balance-item-row">
              <div className="balance-label-row">
                <span style={{ color: "#00A699" }}>Sayuran & Serat Hijau (Bayam/Brokoli/Capcay)</span>
                <span>30% (1/3 Piring)</span>
              </div>
              <div className="balance-track">
                <div className="balance-fill fiber" style={{ width: "30%" }} />
              </div>
            </div>
          </div>

          {/* SeaBank Wellness Saver Card Integration */}
          <div className="seabank-card">
            <div className="seabank-card-header">
              <div className="seabank-brand">
                <Wallet size={16} />
                <span>SeaBank Wellness Saver</span>
              </div>
              <span className="seabank-badge">Mitra Finansial Sehat</span>
            </div>

            <p className="seabank-desc">
              Menjaga target gizi NutriSea setiap hari membuka fasilitas suku bunga tabungan spesial + cashback 25% langsung di ShopeeFood.
            </p>

            <div className="seabank-rewards-row">
              <div className="seabank-reward-chip">
                Bunga Khusus: <strong>+0.5% p.a.</strong>
              </div>
              <div className="seabank-reward-chip">
                Cashback Menu: <strong>25% Tiap Hari</strong>
              </div>
              <div className="seabank-reward-chip">
                Bebas Biaya: <strong>Transfer Rp 0</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
