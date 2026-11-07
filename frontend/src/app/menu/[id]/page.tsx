"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Store,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Check,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  ChefHat,
  RefreshCw,
  MessageCircleQuestion,
  Star,
  CheckCircle2,
  Tag,
  Utensils,
  Network,
  BookOpen,
  Activity
} from "lucide-react";
import NutriGraphVisualizer from "@/components/NutriGraphVisualizer";
// Hardcoded import commented out - now pulling single dish from Aiven Cloud PostgreSQL:
// import { getDishById } from "@/data/menu";
import { DishItem, fetchDishById } from "@/data/menu";
import { scoreMenuItem, UserRecommendationProfile, RecommendationScoreBreakdown } from "@/services/recommendationScorer";
import { useApp } from "@/context/AppContext";
import { useAccountSession } from "@/context/AccountSessionContext";

function MenuDetailContent() {
  const { account } = useAccountSession();
  const params = useParams();
  const router = useRouter();
  const { addToCart, bmiStats, activeUserId, logUserAction } = useApp();

  const id = typeof params?.id === "string" ? params.id : "";
  const [dish, setDish] = useState<DishItem | null>(null);
  const [isLoadingDish, setIsLoadingDish] = useState<boolean>(true);

  const [quantity, setQuantity] = useState(1);
  const [selectedNote, setSelectedNote] = useState<string>("Standar NutriSea (Minyak Baru)");
  const [customNote, setCustomNote] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [recommendationScore, setRecommendationScore] = useState<number | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<RecommendationScoreBreakdown | null>(null);

  // Log Short-Term Memory VIEW_DETAILS
  useEffect(() => {
    if (dish) {
      logUserAction("VIEW_DETAILS", {
        item_id: dish.id,
        item_name: dish.name,
        merchant_name: dish.merchantName,
        price: dish.discountedPrice,
        personas: dish.personas || dish.matchedPersonas || [],
        category: dish.category,
        macros: dish.macros
      });
    }
  }, [dish]);

  // Personalization always belongs to the current signed-in account.
  useEffect(() => {
    if (!dish || !account?.main_persona_id) { setRecommendationScore(null); setScoreBreakdown(null); return; }
    const breakdown = scoreMenuItem(dish, {
      primaryPersonaId: account.main_persona_id, secondaryPersonaIds: account.side_persona_ids,
      targetLunchKcal: Math.round((bmiStats?.targetCalories || 0) * 0.4),
    });
    setRecommendationScore(breakdown.finalScore); setScoreBreakdown(breakdown);
  }, [dish, account, bmiStats]);

  // AI Consultation State
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // NutriGraph Clinical Verification State
  const [graphVerification, setGraphVerification] = useState<any | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!dish) return;
    const effectivePersona = account?.main_persona_id;
    if (!effectivePersona) { setGraphVerification(null); return; }
    setIsLoadingGraph(true);
    fetch(`http://127.0.0.1:8000/api/graph/explain/${encodeURIComponent(effectivePersona)}/${encodeURIComponent(dish.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGraphVerification(data);
      })
      .catch((err) => console.warn("Could not fetch NutriGraph verification:", err))
      .finally(() => setIsLoadingGraph(false));
  }, [dish, account]);

  useEffect(() => {
    if (!id) return;
    setIsLoadingDish(true);
    fetchDishById(id)
      .then((data) => setDish(data))
      .catch((err) => console.warn("Failed to fetch dish from PostgreSQL:", err))
      .finally(() => setIsLoadingDish(false));
  }, [id]);

  if (isLoadingDish) {
    return (
      <div style={{ backgroundColor: "#FFFFFF", padding: 60, borderRadius: 8, textAlign: "center", border: "1px solid #E5E5E5" }}>
        <RefreshCw size={28} className="spin-slow" color="#EE4D2D" style={{ margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#333" }}>Memuat Detail Menu Sehat...</h2>
        <p style={{ fontSize: "12px", color: "#888", marginTop: 4 }}>Mengambil informasi nutrisi & standar higienis dari database...</p>
      </div>
    );
  }

  if (!dish) {
    return (
      <div style={{ backgroundColor: "#FFFFFF", padding: 40, borderRadius: 8, textAlign: "center", border: "1px solid #E5E5E5" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Menu Tidak Ditemukan</h2>
        <p style={{ fontSize: "12.5px", color: "#666", marginTop: 4 }}>
          Menu yang Anda cari mungkin sudah tidak tersedia di katalog saat ini.
        </p>
        <button
          className="btn-shopee-primary"
          style={{ marginTop: 16 }}
          onClick={() => router.push("/")}
        >
          Kembali ke Menu Utama
        </button>
      </div>
    );
  }

  const handleConsultAi = async (customPrompt?: string) => {
    const q = customPrompt || aiQuestion;
    if (!q) return;

    setIsLoadingAi(true);
    setAiAnswer(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          user_id: activeUserId,
          dish_context: `${dish.name} di ${dish.merchantName} (${dish.macros.kcal} kcal, ${dish.macros.proteinG}g protein)`,
          user_bmi_stats: bmiStats
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnswer(data.reply);
      } else {
        throw new Error("Chat API error");
      }
    } catch (err) {
      setAiAnswer(
        `Untuk menu ${dish.name}, saran modifikasi sehat dari NutriSea: mintalah sambal dipisah dan minta porsi nasi setengah. Kandungan ${dish.macros.proteinG}g protein di menu ini sangat baik untuk pemenuhan gizi Anda hari ini.`
      );
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleAdd = () => {
    const fullNotes = customNote ? `${selectedNote} - ${customNote}` : selectedNote;
    const modifiedDish = {
      ...dish,
      cookingNotes: fullNotes
    };
    addToCart(modifiedDish, quantity);
    setToastMessage(`Berhasil menambahkan ${quantity}x ${dish.name} ke keranjang!`);
    setTimeout(() => {
      setToastMessage(null);
      router.push("/cart");
    }, 800);
  };

  return (
    <>
      {toastMessage && (
        <div className="app-toast">
          {toastMessage}
        </div>
      )}

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

      {/* Responsive Detail Grid */}
      <div className="detail-grid">
        {/* Left Column: Image */}
        <div className="detail-img-wrap">
          {dish.imageUrl ? (
            <img
              src={dish.imageUrl}
              alt={dish.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                minHeight: 280,
                background: "linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#6C757D"
              }}
            >
              <Utensils size={44} color="#EE4D2D" style={{ opacity: 0.8 }} />
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#333", padding: "0 16px", textAlign: "center" }}>
                {dish.name}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#888",
                  backgroundColor: "#FFF",
                  padding: "3px 10px",
                  borderRadius: 12
                }}
              >
                Pilihan Sehat ({dish.category})
              </span>
            </div>
          )}

          <span
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              backgroundColor: "rgba(0,0,0,0.72)",
              color: "#FFF",
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: 4,
              backdropFilter: "blur(4px)"
            }}
          >
            {dish.district} | {dish.distanceKm} km
          </span>

          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              backgroundColor: "#EE4D2D",
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 4,
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
            }}
          >
            Mitra Higienis NutriSea
          </span>
        </div>

        {/* Right Column: Information */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            {/* Merchant info */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12px", color: "#666" }}>
              <Store size={13} color="#EE4D2D" />
              <span style={{ fontWeight: 600, color: "#333" }}>{dish.merchantName}</span>
              <span>|</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#FFA439", fontWeight: 600 }}>
                <Star size={12} fill="#FFA439" /> {dish.rating}
              </span>
              <span>({dish.soldCount} terjual)</span>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#222", marginTop: 6, lineHeight: 1.3 }}>
              {dish.name}
            </h1>

            {/* Tags row */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {(dish.healthyTags || []).map((t: string, idx: number) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: "#F4F4F4",
                    color: "#555",
                    fontSize: "10.5px",
                    fontWeight: 500,
                    padding: "2px 7px",
                    borderRadius: 3
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>

            {/* Price */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: "22px", fontWeight: 700, color: "#EE4D2D" }}>
                Rp {dish.discountedPrice.toLocaleString("id-ID")}
              </span>
              <span style={{ fontSize: "13px", color: "#9E9E9E", textDecoration: "line-through" }}>
                Rp {dish.basePrice.toLocaleString("id-ID")}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#EE4D2D", backgroundColor: "#FFF0EB", padding: "2px 8px", borderRadius: 4 }}>
                Hemat {Math.round(((dish.basePrice - dish.discountedPrice) / dish.basePrice) * 100)}%
              </span>
            </div>

            {/* Recommendation Score Info Banner */}
            {recommendationScore !== null && (
              <div
                style={{
                  backgroundColor: "#FFF9F5",
                  border: "1px solid #FFE4DB",
                  borderRadius: 6,
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginTop: 10
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      backgroundColor: "#EE4D2D",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 700,
                      padding: "2.5px 8px",
                      borderRadius: 4
                    }}
                  >
                    🎯 {Math.round(recommendationScore * 100)}% Cocok
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#666" }}>
                    Skor kesesuaian klinis untuk profil persona Anda (R: {recommendationScore.toFixed(3)})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Complete 5-Nutrient Macros Bar */}
          <div className="detail-macros-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <div className="detail-macro-box">
              <span className="detail-macro-val" style={{ color: "#EE4D2D" }}>{dish.macros.kcal}</span>
              <span className="detail-macro-lbl">Kalori</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val" style={{ color: "#00B14F" }}>{dish.macros.proteinG}g</span>
              <span className="detail-macro-lbl">Protein</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val">{dish.macros.carbsG}g</span>
              <span className="detail-macro-lbl">Karbo</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val">{dish.macros.fatG}g</span>
              <span className="detail-macro-lbl">Lemak</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val" style={{ color: "#0048A0" }}>{dish.macros.sodiumMg}mg</span>
              <span className="detail-macro-lbl">Garam</span>
            </div>
          </div>

          {/* NutriGraph Multi-Hop Clinical Verification Card */}
          <div
            style={{
              backgroundColor: graphVerification?.is_safe === false ? "#FFF5F5" : "#F6FCF7",
              border: graphVerification?.is_safe === false ? "1px solid #FED7D7" : "1px solid #C6F6D5",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              transition: "all 0.2s ease"
            }}
          >
            {/* Header & Status Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {graphVerification?.is_safe === false ? (
                  <ShieldAlert size={17} color="#E02424" />
                ) : (
                  <ShieldCheck size={17} color="#00B14F" />
                )}
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#222" }}>
                    Verifikasi Klinis NutriGraph
                  </span>
                  <span style={{ fontSize: "10.5px", color: "#666", marginLeft: 6 }}>
                    (Multi-Hop Medical Guardrails)
                  </span>
                </div>
              </div>

              {isLoadingGraph ? (
                <span style={{ fontSize: "11px", color: "#777", display: "flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={11} className="spin-slow" /> Menganalisis graf klinis...
                </span>
              ) : graphVerification ? (
                <span
                  style={{
                    backgroundColor: graphVerification.is_safe === false ? "#E02424" : "#00B14F",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2.5px 8px",
                    borderRadius: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  {graphVerification.is_safe === false ? (
                    <>
                      <AlertTriangle size={11} /> KONTRAINDIKASI ({graphVerification.severity})
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={11} /> AMAN DIKONSUMSI (SAFE)
                    </>
                  )}
                </span>
              ) : null}
            </div>

            {/* Proof-Chain Narrative */}
            {graphVerification && (
              <>
                <p style={{ fontSize: "11.5px", color: "#333", margin: "2px 0 0 0", lineHeight: 1.45 }}>
                  {graphVerification.explanation_narrative}
                </p>

                {/* Traversal Path Evidence Pills */}
                {graphVerification.path_evidence && graphVerification.path_evidence.length > 0 && (
                  <div style={{ backgroundColor: "rgba(255,255,255,0.7)", padding: "6px 8px", borderRadius: 5, border: "1px dashed rgba(0,0,0,0.1)" }}>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "#555", marginBottom: 4 }}>
                      Jalur Traversal Graf Medis:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, fontSize: "10.5px" }}>
                      {graphVerification.path_evidence[0].map((hop: string, hIdx: number) => (
                        <React.Fragment key={hIdx}>
                          {hIdx > 0 && <span style={{ color: "#999", fontWeight: 700 }}>➔</span>}
                          <span
                            style={{
                              backgroundColor: hIdx % 2 === 0 ? "#EDF2F7" : "#FFF",
                              color: hop.includes("CONTRA") ? "#E02424" : "#333",
                              padding: "1.5px 6px",
                              borderRadius: 3,
                              fontWeight: hop.includes("CONTRA") ? 700 : 500,
                              border: "1px solid #E2E8F0"
                            }}
                          >
                            {hop.replace(/^(PERSONA|COND|ING|METHOD|ALLERGEN|DISH):/, "")}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clinical Citations & Subgraph Trigger */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "10.5px", color: "#4A5568" }}>
                    <BookOpen size={12} color="#0052CC" />
                    <span>
                      <strong>Rujukan Klinis:</strong> {graphVerification.clinical_citations?.join(", ") || "Pedoman Gizi Seimbang Kemenkes RI"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsGraphModalOpen(true)}
                    style={{
                      background: "linear-gradient(135deg, #0052CC 0%, #0747A6 100%)",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "4px",
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      boxShadow: "0 1px 3px rgba(0,82,204,0.3)"
                    }}
                  >
                    <Network size={12} /> Buka Visualisasi Subgraf Jaringan
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Kitchen instructions & Hygiene note */}
          <div
            style={{
              backgroundColor: "#FFF9F5",
              border: "1px solid #FFE4DB",
              borderRadius: "6px",
              padding: "10px 12px",
              fontSize: "12px",
              color: "#C2410C",
              display: "flex",
              alignItems: "flex-start",
              gap: 8
            }}
          >
            <ChefHat size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.45 }}>
              <strong>Instruksi Dapur Standar NutriSea:</strong> {dish.cookingNotes}
            </div>
          </div>

          {/* Kitchen Customization Options */}
          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#222", marginBottom: 6 }}>
              Pilihan Khusus Dapur Mitra:
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                "Standar NutriSea (Minyak Baru)",
                "Nasi Porsi Setengah (Defisit Kalori)",
                "Pisahkan Sambal / Kuah",
                "Tanpa Kuah Santan Berlebih"
              ].map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedNote(opt)}
                  style={{
                    backgroundColor: selectedNote === opt ? "#FFF5F1" : "#FAFAFA",
                    border: selectedNote === opt ? "1px solid #EE4D2D" : "1px solid #E0E0E0",
                    color: selectedNote === opt ? "#EE4D2D" : "#555",
                    fontSize: "11px",
                    fontWeight: selectedNote === opt ? 600 : 400,
                    padding: "4px 8px",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive AI Consultation Section */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #FFD0C0",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "12.5px", fontWeight: 600, color: "#222" }}>
                <Sparkles size={14} color="#EE4D2D" />
                <span>Konsultasikan Menu Ini dengan AI</span>
              </div>
              <span style={{ fontSize: "10px", color: "#EE4D2D", backgroundColor: "#FFF0EB", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>
                AI Nutritionist Co-Pilot
              </span>
            </div>

            {/* Quick Consultation Chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleConsultAi("Apakah menu ini aman untuk penderita asam lambung / maag?")}
                disabled={isLoadingAi}
                style={{
                  backgroundColor: "#FAFAFA",
                  border: "1px solid #E0E0E0",
                  borderRadius: "14px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  color: "#444",
                  cursor: "pointer"
                }}
              >
                Aman untuk asam lambung?
              </button>

              <button
                type="button"
                onClick={() => handleConsultAi("Bagaimana tips modifikasi masak agar lebih rendah minyak & sodium?")}
                disabled={isLoadingAi}
                style={{
                  backgroundColor: "#FAFAFA",
                  border: "1px solid #E0E0E0",
                  borderRadius: "14px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  color: "#444",
                  cursor: "pointer"
                }}
              >
                Tips modifikasi lebih sehat?
              </button>
            </div>

            {/* AI Answer Box */}
            {isLoadingAi && (
              <div style={{ padding: "8px 0", fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} className="spin-icon" color="#EE4D2D" />
                AI sedang menganalisis profil gizi menu ini...
              </div>
            )}

            {aiAnswer && (
              <div
                style={{
                  backgroundColor: "#F8FBF8",
                  border: "1px solid #D2EED8",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  color: "#222",
                  lineHeight: 1.45,
                  whiteSpace: "pre-line"
                }}
              >
                <div style={{ fontWeight: 600, color: "#00B14F", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle2 size={13} /> Saran Ahli Gizi AI:
                </div>
                {aiAnswer}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid #D5D5D5", borderRadius: 4, height: 40, backgroundColor: "#FFF" }}>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                style={{ background: "transparent", border: "none", padding: "0 10px", cursor: "pointer", color: "#666" }}
                aria-label="Kurangi"
              >
                <Minus size={13} />
              </button>
              <span style={{ minWidth: 30, textAlign: "center", fontSize: "13.5px", fontWeight: 600 }}>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                style={{ background: "transparent", border: "none", padding: "0 10px", cursor: "pointer", color: "#666" }}
                aria-label="Tambah"
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              className="btn-shopee-primary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 40, fontSize: "13px" }}
            >
              <ShoppingBag size={15} />
              <span>Masukkan ke Keranjang (Rp {(dish.discountedPrice * quantity).toLocaleString("id-ID")})</span>
            </button>
          </div>
        </div>
      </div>

      {/* NutriGraph Subgraph Interactive Visualizer Modal */}
      {isGraphModalOpen && (
        <NutriGraphVisualizer
          personaId={activeUserId || "BUDG_FACHRI_MENTENG_115"}
          focusDishId={dish.id}
          focusDishName={dish.name}
          isOpen={isGraphModalOpen}
          onClose={() => setIsGraphModalOpen(false)}
        />
      )}
    </>
  );
}

export default function MenuDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: "#666" }}>Memuat detail menu...</div>}>
      <MenuDetailContent />
    </Suspense>
  );
}
