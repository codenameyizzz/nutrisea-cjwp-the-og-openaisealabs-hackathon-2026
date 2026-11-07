"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Wallet
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@clerk/nextjs";
import { useAccountSession } from "@/context/AccountSessionContext";
import { ACCOUNT_UPDATED, type AccountProfile } from "@/services/account-session";
import { API_BASE_URL, responseJson } from "@/lib/api";
import styles from "./bmi.module.css";
import { bmiProfileUpdate } from "./profile";

export default function BmiPage() {
  const router = useRouter();
  const { heightCm, weightKg, activityGoal, updateBmi } = useApp();
  const { userId, getToken } = useAuth();
  const { account } = useAccountSession();

  const [localHeight, setLocalHeight] = useState(heightCm);
  const [localWeight, setLocalWeight] = useState(weightKg);
  const [localAge, setLocalAge] = useState<number>(26);
  const [localGender, setLocalGender] = useState<"wanita" | "pria">("wanita");
  const [localActivity, setLocalActivity] = useState<"sedentary" | "light" | "active">("sedentary");
  const [localGoal, setLocalGoal] = useState<"turun" | "ideal" | "otot">(activityGoal);
  const dirty = useRef(false);
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const baseline = useRef<AccountProfile | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Quick preset loader for Lily
  const loadLilyPreset = () => {
    dirty.current = true;
    setLocalHeight(160);
    setLocalWeight(52);
    setLocalAge(26);
    setLocalGender("wanita");
    setLocalActivity("sedentary");
    setLocalGoal("ideal");
    showToast("Demo data loaded. It has not been saved to your account.");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const data = account?.profile;
    if (!data || dirty.current) return;
    baseline.current = data;
    setLocalHeight(data.height_cm); setLocalWeight(data.weight_kg); setLocalAge(data.age);
    setLocalActivity(data.activity_level === "SEDENTARY" ? "sedentary" : data.activity_level === "LIGHT" ? "light" : "active");
    setLocalGender(data.sex === "M" ? "pria" : "wanita");
    setLocalGoal(data.goal === "LOSE_WEIGHT" ? "turun" : data.goal === "GAIN_MUSCLE" ? "otot" : "ideal");
  }, [account]);

  const isInputValid = Number.isInteger(localAge) && localAge >= 18 && localAge <= 100
    && Number.isFinite(localHeight) && localHeight >= 120 && localHeight <= 230
    && Number.isFinite(localWeight) && localWeight >= 30 && localWeight <= 250;
  const handleSave = async () => {
    if (saving.current || !isInputValid) return;
    if (!userId) { router.push("/sign-in?redirect_url=%2Fbmi"); return; }
    if (!account?.profile) { router.push("/onboarding/personas"); return; }
    saving.current = true; setIsSaving(true); setSaveError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again. Your changes have not been saved.");
      const latest = await responseJson<AccountProfile>(await fetch(`${API_BASE_URL}/api/users/${userId}/health-profile`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      }));
      const payload = bmiProfileUpdate({ age: localAge, gender: localGender, height: localHeight,
        weight: localWeight, activity: localActivity, goal: localGoal }, latest, baseline.current);
      const result = await responseJson<{ status: string }>(await fetch(`${API_BASE_URL}/api/users/${userId}/health-profile`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      }));
      if (result.status !== "saved") throw new Error("The server has not confirmed the save. Check your profile before trying again.");
      dirty.current = false;
      baseline.current = null;
      updateBmi(localHeight, localWeight, localGoal);
      window.dispatchEvent(new Event(ACCOUNT_UPDATED));
      showToast("Profile saved. Calculations on this page remain estimates.");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Your profile could not be saved. Your inputs are still available; please try again."); }
    finally { saving.current = false; setIsSaving(false); }
  };

  // Calculate live preview metrics
  const hMeter = localHeight / 100;
  const liveScore = localHeight > 0 ? Number((localWeight / (hMeter * hMeter)).toFixed(1)) : 20.3;
  
  let liveCategory = "Normal range";
  let liveBadgeClass = "ideal";
  let spectrumPercent = 40; // Default center normal

  if (liveScore < 18.5) {
    liveCategory = "Underweight range";
    liveBadgeClass = "warning";
    spectrumPercent = Math.min(22, Math.max(5, (liveScore / 18.5) * 22));
  } else if (liveScore >= 18.5 && liveScore < 23) {
    liveCategory = "Normal range";
    liveBadgeClass = "ideal";
    spectrumPercent = 25 + ((liveScore - 18.5) / 4.5) * 25;
  } else if (liveScore >= 23 && liveScore < 25) {
    liveCategory = "Overweight range";
    liveBadgeClass = "warning";
    spectrumPercent = 53 + ((liveScore - 23) / 2) * 22;
  } else {
    liveCategory = "Obesity range";
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
    <div className={styles.page} onChangeCapture={() => { dirty.current = true; }} onClickCapture={(event) => { if ((event.target as HTMLElement).closest("button")) dirty.current = true; }}>
      {/* Toast Notification */}
      {toast && <p role="status" className={styles.notice}>{toast}</p>}
      {saveError && <p role="alert" className={styles.error}>{saveError}</p>}

      {/* Top Header & Navigation */}
      <button className={styles.back} onClick={() => router.back()}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to menu
      </button>

      <header className={styles.header}>
        <div>
          <h1>
            Energy needs and BMI estimates
          </h1>
          <p>
            Estimates based on nutrition formulas and references. BMI and energy needs are not a diagnosis or a complete health assessment.
          </p>
        </div>

        <button
          className={styles.demo}
          disabled={isSaving}
          onClick={loadLilyPreset}
        >
          Load demo data
        </button>
      </header>

      {/* Main 2-Column Responsive Layout */}
      <div className={`bmi-grid ${styles.grid}`}>
        {/* Left Column: Input Form */}
        <div className={styles.formCard}>
          <div className={styles.sectionHeader}>
            <h2>Physical profile</h2>
            <span>Estimated calculation</span>
          </div>

          {/* Gender & Age */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="bmi-input-group">
              <label className="bmi-input-label">Sex used for calculation</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  disabled={isSaving}
                  aria-pressed={localGender === "wanita"}
                  onClick={() => setLocalGender("wanita")}
                  className={styles.choice}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 4,
                    border: localGender === "wanita" ? "1px solid #EE4D2D" : "1px solid #E0E0E0",
                    backgroundColor: localGender === "wanita" ? "#FFF5F1" : "#FAFAFA",
                    color: localGender === "wanita" ? "#EE4D2D" : "#555",
                    fontSize: "14px",
                    fontWeight: localGender === "wanita" ? 600 : 400,
                    cursor: "pointer"
                  }}
                >
                  Female
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  aria-pressed={localGender === "pria"}
                  onClick={() => setLocalGender("pria")}
                  className={styles.choice}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 4,
                    border: localGender === "pria" ? "1px solid #EE4D2D" : "1px solid #E0E0E0",
                    backgroundColor: localGender === "pria" ? "#FFF5F1" : "#FAFAFA",
                    color: localGender === "pria" ? "#EE4D2D" : "#555",
                    fontSize: "14px",
                    fontWeight: localGender === "pria" ? 600 : 400,
                    cursor: "pointer"
                  }}
                >
                  Male
                </button>
              </div>
            </div>

            <div className="bmi-input-group">
              <label htmlFor="bmi-age" className="bmi-input-label">Age</label>
              <div className="bmi-input-control">
                <input
                  type="number"
                  disabled={isSaving}
                  min="18"
                  max="100"
                  id="bmi-age"
                  value={localAge}
                  onChange={(e) => setLocalAge(Number(e.target.value))}
                />
                <span className="bmi-input-unit">years</span>
              </div>
            </div>
          </div>

          {/* Height and Weight */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="bmi-input-group">
              <label htmlFor="bmi-height" className="bmi-input-label">Height</label>
              <div className="bmi-input-control">
                <input
                  type="number"
                  disabled={isSaving}
                  min="120"
                  max="230"
                  id="bmi-height"
                  value={localHeight}
                  onChange={(e) => setLocalHeight(Number(e.target.value) || 0)}
                />
                <span className="bmi-input-unit">cm</span>
              </div>
            </div>

            <div className="bmi-input-group">
              <label htmlFor="bmi-weight" className="bmi-input-label">Weight</label>
              <div className="bmi-input-control">
                <input
                  type="number"
                  disabled={isSaving}
                  min="30"
                  max="250"
                  id="bmi-weight"
                  value={localWeight}
                  onChange={(e) => setLocalWeight(Number(e.target.value) || 0)}
                />
                <span className="bmi-input-unit">kg</span>
              </div>
            </div>
          </div>

          {/* Daily Activity Level */}
          <div className="bmi-input-group">
            <label className="bmi-input-label">Daily activity level</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { id: "sedentary", title: "Mostly sitting", sub: "Little exercise; sitting more than 7 hours a day" },
                { id: "light", title: "Light activity", sub: "Frequent standing or walking; exercise 1–3 times a week" },
                { id: "active", title: "High activity", sub: "Physical work or intensive exercise 4–5 times a week" }
              ].map((act) => (
                <button
                  key={act.id}
                  type="button"
                  disabled={isSaving}
                  aria-pressed={localActivity === act.id}
                  className={styles.activityChoice}
                  onClick={() => setLocalActivity(act.id as typeof localActivity)}
                >
                  <strong>{act.title}</strong>
                  <span>{act.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Goal Selector */}
          <div className="bmi-input-group">
            <label className="bmi-input-label">Energy goal</label>
            <div className="bmi-goals-grid">
              {[
                { key: "turun", label: "Calorie deficit" },
                { key: "ideal", label: "Maintain" },
                { key: "otot", label: "Build muscle" }
              ].map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`bmi-goal-btn ${localGoal === g.key ? "active" : ""}`}
                  disabled={isSaving}
                  aria-pressed={localGoal === g.key}
                  onClick={() => setLocalGoal(g.key as typeof localGoal)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {!isInputValid && <p role="status" className={styles.error}>Enter an age from 18 to 100 years, height from 120 to 230 cm, and weight from 30 to 250 kg to view estimates and save your profile.</p>}

        </div>

        {/* Right Column: Calculated Results & Guides */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Result Summary Card */}
          {isInputValid && <div className="bmi-result-summary">
            <div className="bmi-score-row">
              <div>
                <span style={{ fontSize: "14px", color: "#555", fontWeight: 500 }}>
                  Body mass index (BMI)
                </span>
                <div className="bmi-score-number">{liveScore}</div>
              </div>
              <span className={`bmi-category-badge ${liveBadgeClass}`} style={{ fontSize: "13px", padding: "6px 10px" }}>
                {liveCategory}
              </span>
            </div>

            {/* Visual Spectrum Gauge */}
            <div className="bmi-spectrum-container">
              <div className="bmi-spectrum-bar">
                <div className="spectrum-seg under" title="Underweight (<18.5)" />
                <div className="spectrum-seg normal" title="Normal range (18.5 - 22.9)" />
                <div className="spectrum-seg over" title="Overweight (23.0 - 24.9)" />
                <div className="spectrum-seg obese" title="Obesity (>=25.0)" />

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
                <span>&lt; 18.5 Underweight</span>
                <span style={{ color: "#247243", fontWeight: 600 }}>18.5 - 22.9 Normal</span>
                <span>23 - 24.9 Overweight</span>
                <span>&gt; 25 Obesity</span>
              </div>
            </div>

            {/* Nutrients Grid */}
            <div className="bmi-nutrients-grid">
              <div className="bmi-nutrient-item">
                <span className="bmi-nutrient-val" style={{ color: "#b43519" }}>{tdee} kcal</span>
                <span className="bmi-nutrient-lbl">Estimated daily energy</span>
              </div>
              <div className="bmi-nutrient-item">
                <span className="bmi-nutrient-val" style={{ color: "#263238" }}>
                  {Math.round(localWeight * (localGoal === "otot" ? 1.6 : 1.2))}g
                </span>
                <span className="bmi-nutrient-lbl">Estimated protein</span>
              </div>
              <div className="bmi-nutrient-item">
                <span className="bmi-nutrient-val" style={{ color: "#263238" }}>&lt; 2,000 mg</span>
                <span className="bmi-nutrient-lbl">App sodium reference</span>
              </div>
            </div>

            {/* Meal Distribution Guide */}
            <div className={styles.mealGuide}>
              <h3>Example energy allocation</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, textAlign: "center" }}>
                <div style={{ background: "#FFFFFF", padding: "6px 4px", borderRadius: 4, border: "1px solid #EFEFEF" }}>
                  <div style={{ fontSize: "10px", color: "#777" }}>Breakfast</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginTop: 2 }}>
                    ~{Math.round(tdee * 0.25)} kcal
                  </div>
                </div>
                <div style={{ background: "#FFF5F1", padding: "6px 4px", borderRadius: 4, border: "1px solid #FFD8CC" }}>
                  <div style={{ fontSize: "10px", color: "#EE4D2D", fontWeight: 500 }}>Lunch</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#EE4D2D", marginTop: 2 }}>
                    ~{Math.round(tdee * 0.40)} kcal
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "6px 4px", borderRadius: 4, border: "1px solid #EFEFEF" }}>
                  <div style={{ fontSize: "10px", color: "#777" }}>Dinner</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#333", marginTop: 2 }}>
                    ~{Math.round(tdee * 0.35)} kcal
                  </div>
                </div>
              </div>
            </div>
          </div>}

          <p className={styles.notice}>Energy estimates use the Mifflin-St Jeor equation, an activity factor, and the app&apos;s goal adjustments. Portions and protein are estimates based on these settings; your needs may differ. Demo data has not been saved as your profile.</p>
          <button className="btn-shopee-primary" disabled={!isInputValid || isSaving} onClick={handleSave}>{isSaving ? "Saving..." : "Save profile"}</button>
          <details className={styles.secondary}><summary>Additional guidance and simulated features</summary>
          {/* Isi Piringku Guidelines */}
          <div className="balance-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#222" }}>
                Example portion breakdown in the app
              </div>
              <span style={{ fontSize: "10px", color: "#666" }}>Per meal</span>
            </div>

            <div className="balance-item-row">
              <div className="balance-label-row">
                <span style={{ color: "#D97706" }}>Complex carbohydrates (brown rice/corn/sweet potato)</span>
                <span>35% (1/3 plate)</span>
              </div>
              <div className="balance-track">
                <div className="balance-fill carb" style={{ width: "35%" }} />
              </div>
            </div>

            <div className="balance-item-row">
              <div className="balance-label-row">
                <span style={{ color: "#00B14F" }}>Protein foods (fish/chicken breast/tempe)</span>
                <span>35% (1/3 plate)</span>
              </div>
              <div className="balance-track">
                <div className="balance-fill protein" style={{ width: "35%" }} />
              </div>
            </div>

            <div className="balance-item-row">
              <div className="balance-label-row">
                <span style={{ color: "#00A699" }}>Vegetables and fiber (spinach/broccoli/capcay)</span>
                <span>30% (1/3 plate)</span>
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
              <span className="seabank-badge">Feature simulation</span>
            </div>

            <p className="seabank-desc">
              These promotions are examples for demonstration only. No interest rates are changed and no payments or funds are sent to SeaBank.
            </p>

            <div className="seabank-rewards-row">
              <div className="seabank-reward-chip">
                Example interest: <strong>+0.5% p.a.</strong>
              </div>
              <div className="seabank-reward-chip">
                Example meal cashback: <strong>25% daily</strong>
              </div>
              <div className="seabank-reward-chip">
                Example transfer fee: <strong>Rp 0</strong>
              </div>
            </div>
          </div>
          </details>
        </div>
      </div>
    </div>
  );
}
