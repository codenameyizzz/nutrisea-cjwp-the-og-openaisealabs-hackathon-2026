"use client";

import { useAuth } from "@clerk/nextjs";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Store,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  ChefHat,
  RefreshCw,
  Star,
  CheckCircle2,
  Utensils,
  Network,
  BookOpen,
} from "lucide-react";
import NutriGraphVisualizer from "@/components/NutriGraphVisualizer";
import FoodImage from "@/components/FoodImage";
// Hardcoded import commented out - now pulling single dish from Aiven Cloud PostgreSQL:
// import { getDishById } from "@/data/menu";
import { DishItem, fetchDishById } from "@/data/menu";
import { scoreMenuItem } from "@/services/recommendationScorer";
import { useApp } from "@/context/AppContext";
import { useAccountSession } from "@/context/AccountSessionContext";

function displayNutrient(value: unknown, unit: string) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString("en-US")} ${unit}`
    : "Not available";
}

function MenuDetailContent() {
  const { account } = useAccountSession();
  const params = useParams();
  const router = useRouter();
  const { addToCart, bmiStats, activeUserId, logUserAction } = useApp();
  const { getToken } = useAuth();

  const id = typeof params?.id === "string" ? params.id : "";
  const [dish, setDish] = useState<DishItem | null>(null);
  const [isLoadingDish, setIsLoadingDish] = useState<boolean>(true);

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


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

  const recommendationScore = useMemo(() => {
    if (!dish || !account?.main_persona_id) return null;
    return scoreMenuItem(dish, {
      primaryPersonaId: account.main_persona_id, secondaryPersonaIds: account.side_persona_ids,
      targetLunchKcal: Math.round((bmiStats?.targetCalories || 0) * 0.4),
    }).finalScore;
  }, [dish, account, bmiStats]);

  // AI Consultation State

  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState("Response source not provided");

  // NutriGraph Clinical Verification State
  const [graphVerification, setGraphVerification] = useState<{ is_safe: boolean; severity: string; clinical_citations?: string[]; path_evidence?: string[][] } | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    const effectivePersona = account?.main_persona_id;
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setGraphVerification(null);
      if (!dish || !effectivePersona) {
        setIsLoadingGraph(false);
        return;
      }
      setIsLoadingGraph(true);
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/graph/explain/${encodeURIComponent(effectivePersona)}/${encodeURIComponent(dish.id)}`, { signal: controller.signal });
        const data = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setGraphVerification(data);
      } catch {
        if (!controller.signal.aborted) setGraphVerification(null);
      } finally {
        if (!controller.signal.aborted) setIsLoadingGraph(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [dish, account]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsLoadingDish(true);
      try {
        const data = id ? await fetchDishById(id) : null;
        if (!cancelled) setDish(data);
      } catch {
        if (!cancelled) setDish(null);
      } finally {
        if (!cancelled) setIsLoadingDish(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [id]);

  if (isLoadingDish) {
    return (
      <div style={{ backgroundColor: "#FFFFFF", padding: 60, borderRadius: 8, textAlign: "center", border: "1px solid #E5E5E5" }}>
        <RefreshCw size={28} className="spin-slow" color="#EE4D2D" style={{ margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#333" }}>Loading menu details...</h2>
        <p style={{ fontSize: "12px", color: "#888", marginTop: 4 }}>Loading menu and nutrition information from the catalog...</p>
      </div>
    );
  }

  if (!dish) {
    return (
      <div style={{ backgroundColor: "#FFFFFF", padding: 40, borderRadius: 8, textAlign: "center", border: "1px solid #E5E5E5" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Menu item not found</h2>
        <p style={{ fontSize: "12.5px", color: "#666", marginTop: 4 }}>
          This item may no longer be available in the current catalog.
        </p>
        <button
          className="btn-shopee-primary"
          style={{ marginTop: 16 }}
          onClick={() => router.push("/")}
        >
          Back to all menus
        </button>
      </div>
    );
  }

  const handleConsultAi = async (customPrompt?: string) => {
    const q = customPrompt;
    if (!q) return;

    setIsLoadingAi(true);
    setAiAnswer(null);
    setAiError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in first.");
      const res = await fetch("http://127.0.0.1:8000/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: q,
          user_id: activeUserId,
          dish_context: `${dish.name} at ${dish.merchantName} (${displayNutrient(dish.macros.kcal, "kcal")}, ${displayNutrient(dish.macros.proteinG, "g")} protein)`,
          user_bmi_stats: bmiStats
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty reply");
        setAiAnswer(data.reply);
        setAiSource(data.model === "dynamic-context-synthesis" ? "Fallback response based on app rules" : data.model ? "AI model response" : "Response source not provided");
      } else {
        throw new Error("Chat API error");
      }
    } catch {
      setAiError("An answer is not available because the service did not respond. Try again; your menu choices remain on this page.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleAdd = () => {
    if (dish.isAvailable === false || isAdding) return;
    setIsAdding(true);
    addToCart(dish, quantity);
    setToastMessage(`Added ${quantity} × ${dish.name} to your cart!`);
    setTimeout(() => {
      setToastMessage(null);
      router.push("/cart");
    }, 800);
  };

  return (
    <div className="menu-detail">
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
          <ArrowLeft size={14} /> Back to menus
        </button>
      </div>

      {/* Responsive Detail Grid */}
      <div className="detail-grid">
        {/* Left Column: Image */}
        <div className="detail-img-wrap">
          {dish.imageUrl ? (
            <FoodImage
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
                Food choice ({dish.category})
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
            Item in the NutriSea catalog
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
              <span>({dish.soldCount} sold)</span>
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
                Rp {dish.discountedPrice.toLocaleString("en-US")}
              </span>
              <span style={{ fontSize: "13px", color: "#9E9E9E", textDecoration: "line-through" }}>
                Rp {dish.basePrice.toLocaleString("en-US")}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#EE4D2D", backgroundColor: "#FFF0EB", padding: "2px 8px", borderRadius: 4 }}>
                Save {Math.round(((dish.basePrice - dish.discountedPrice) / dish.basePrice) * 100)}%
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
                    Rule-based score: {Math.round(recommendationScore * 100)} / 100
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#666" }}>
                    Score based on preference-matching rules, not a probability of suitability (R: {recommendationScore.toFixed(3)})
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="menu-detail-notice">
            <strong>{dish.nutritionSource === "TKPI"
              ? "TKPI reference (catalog label; not a measurement of the restaurant serving)"
              : dish.nutritionSource === "ESTIMATE" ? "Catalog estimate" : "Source not available"}.</strong>{" "}
            Measurement methods and serving weights are not provided, so these figures should not be treated as measurements of your ordered portion.
            Unavailable data is marked separately.
          </p>
          {/* Complete 5-Nutrient Macros Bar */}
          <div className="detail-macros-grid">
            <div className="detail-macro-box">
              <span className="detail-macro-val" style={{ color: "#EE4D2D" }}>{displayNutrient(dish.macros.kcal, "kcal")}</span>
              <span className="detail-macro-lbl">Calories</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val" style={{ color: "#00B14F" }}>{displayNutrient(dish.macros.proteinG, "g")}</span>
              <span className="detail-macro-lbl">Protein</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val">{displayNutrient(dish.macros.carbsG, "g")}</span>
              <span className="detail-macro-lbl">Carbs</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val">{displayNutrient(dish.macros.fatG, "g")}</span>
              <span className="detail-macro-lbl">Fat</span>
            </div>
            <div className="detail-macro-box">
              <span className="detail-macro-val" style={{ color: "#0048A0" }}>{displayNutrient(dish.macros.sodiumMg, "mg")}</span>
              <span className="detail-macro-lbl">Sodium</span>
            </div>
          </div>

          {/* NutriGraph Multi-Hop Clinical Verification Card */}
          <div
            style={{
              backgroundColor: graphVerification?.is_safe === false ? "#FFF5F5" : "#F9FAFB",
              border: graphVerification?.is_safe === false ? "1px solid #FED7D7" : "1px solid #D1D5DB",
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
                  <BookOpen size={17} color="#555555" />
                )}
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#222" }}>
                    NutriGraph rule explanation
                  </span>
                  <span style={{ fontSize: "10.5px", color: "#666", marginLeft: 6 }}>
                    (based on a recommendation template)
                  </span>
                </div>
              </div>

              {isLoadingGraph ? (
                <span style={{ fontSize: "11px", color: "#777", display: "flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={11} className="spin-slow" /> Checking graph data...
                </span>
              ) : graphVerification ? (
                <span
                  style={{
                    backgroundColor: graphVerification.is_safe === false ? "#B91C1C" : "#555555",
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
                      <AlertTriangle size={11} /> RULES NEED REVIEW
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={11} /> {graphVerification.severity === "SAFE" ? "NO RULE CONFLICTS" : "INCOMPLETE DATA"}
                    </>
                  )}
                </span>
              ) : null}
            </div>

            {/* Proof-Chain Narrative */}
            {graphVerification && (
              <>
                <p style={{ fontSize: "11.5px", color: "#333", margin: "2px 0 0 0", lineHeight: 1.45 }}>
                  These rules come from a recommendation template, not a diagnosis or a food safety guarantee. Ingredient and portion data may be incomplete; confirm allergens and preparation with the seller.
                </p>

                {/* Traversal Path Evidence Pills */}
                {graphVerification.path_evidence && graphVerification.path_evidence.length > 0 && (
                  <div style={{ backgroundColor: "rgba(255,255,255,0.7)", padding: "6px 8px", borderRadius: 5, border: "1px dashed rgba(0,0,0,0.1)" }}>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "#555", marginBottom: 4 }}>
                      Relationships in the recommendation template:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, fontSize: "10.5px" }}>
                      {graphVerification.path_evidence[0].map((hop: string, hIdx: number) => (
                        <React.Fragment key={hIdx}>
                          {hIdx > 0 && <span style={{ color: "#999", fontWeight: 700 }}>→</span>}
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
                      <strong>Sources listed in the configuration:</strong> {graphVerification.clinical_citations?.join(", ") || "Not provided"}
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
                    <Network size={12} /> Open the subgraph visualization
                  </button>
                </div>
              </>
            )}
          </div>

          {!graphVerification && !isLoadingGraph && (
            <p className="menu-detail-notice">A rule explanation is not available. No food safety conclusion can be shown.</p>
          )}
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
              <strong>Catalog preparation notes (confirm with the seller):</strong> {dish.cookingNotes}
            </div>
          </div>

          <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #EAEAEA", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#222", marginBottom: 6 }}>
              Kitchen requests
            </div>
            <p style={{ fontSize: "12px", color: "#555", margin: 0 }}>
              No customization options are provided for this menu item. Catalog preparation notes remain unchanged.
            </p>
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
                <span>Ask AI about this menu</span>
              </div>
              <span style={{ fontSize: "10px", color: "#EE4D2D", backgroundColor: "#FFF0EB", padding: "2px 6px", borderRadius: 4, fontWeight: 500 }}>
                AI information assistant
              </span>
            </div>

            {/* Quick Consultation Chips */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleConsultAi("What should I ask the seller about this dish's ingredients and preparation?")}
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
                What should I ask the seller?
              </button>

              <button
                type="button"
                onClick={() => handleConsultAi("How could the preparation be adjusted to use less oil and sodium?")}
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
                Tips for adjusting the preparation?
              </button>
            </div>

            {aiError && <p role="alert" className="menu-detail-notice">{aiError}</p>}
            {/* AI Answer Box */}
            {isLoadingAi && (
              <div style={{ padding: "8px 0", fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={13} className="spin-icon" color="#EE4D2D" />
                AI is reviewing the nutrition information for this menu...
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
                  <Sparkles size={13} /> {aiSource}:
                </div>
                {aiAnswer}
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="menu-detail-actions">
            <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid #D5D5D5", borderRadius: 4, height: 48, backgroundColor: "#FFF" }}>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                style={{ background: "transparent", border: "none", padding: "0 10px", cursor: "pointer", color: "#666" }}
                aria-label="Decrease quantity"
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
                aria-label="Increase quantity"
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={dish.isAvailable === false || isAdding}
              className="btn-shopee-primary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 40, fontSize: "13px" }}
            >
              <ShoppingBag size={15} />
              <span>{dish.isAvailable === false ? "Currently unavailable" : isAdding ? "Added to cart" : `Add to cart (Rp ${(dish.discountedPrice * quantity).toLocaleString("en-US")})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* NutriGraph Subgraph Interactive Visualizer Modal */}
      {isGraphModalOpen && account?.main_persona_id && (
        <NutriGraphVisualizer
          personaId={account!.main_persona_id!}
          focusDishId={dish.id}
          focusDishName={dish.name}
          isOpen={isGraphModalOpen}
          onClose={() => setIsGraphModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function MenuDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: "#666" }}>Loading menu details...</div>}>
      <MenuDetailContent />
    </Suspense>
  );
}
