"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import FoodImage from "@/components/FoodImage";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { API_BASE_URL, responseJson } from "@/lib/api";
import {
  Utensils,
  Plus,
  Store,
  Scale,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  RefreshCw,
  ChefHat,
  ShoppingBag
} from "lucide-react";
// Hardcoded import commented out - now pulling from Aiven Cloud PostgreSQL:
// import { MENU_CATALOG } from "@/data/menu";
import { DishItem } from "@/data/menu";
import { UserRecommendationProfile } from "@/services/recommendationScorer";
import { useApp } from "@/context/AppContext";
import { useAccountSession } from "@/context/AccountSessionContext";
import { catalogLabelEnglish } from "@/services/catalog-labels";

interface AiRecommendation {
  source?: string;
  recommendation_id?: string;
  selected_meal?: {
    merchant_name: string;
    item_name: string;
    item_id?: string;
    rationale?: string;
    final_cooking_instructions?: string;
    estimated_macros?: {
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      sodium_mg: number;
    };
  };
  selected_merchant?: {
    merchant_name: string;
    distance_km?: number;
  };
  menu_item?: {
    item_name: string;
    price_idr?: number;
    cooking_notes?: string;
  };
  justification_chips?: string[];
  rationale?: string;
}

function nutrientText(value: unknown, unit: string): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value} ${unit}` : "Not available";
}

function nutritionSourceLabel(source: DishItem["nutritionSource"]): string {
  return source === "TKPI" ? "TKPI reference, not a measurement of the seller's portion"
    : source === "ESTIMATE" ? "Estimated catalog nutrition" : "Nutrition source not available";
}

const categoryLabels: Record<string, string> = {
  hemat: "Budget meals", protein: "Protein choices", "rendah-kalori": "Lower-calorie choices",
  "bebas-santan": "No coconut milk label", lambung: "Stomach-related catalog category",
};

export default function HomePage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [adaptiveDish, setAdaptiveDish] = useState<DishItem | null>(null);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [preferenceSummary, setPreferenceSummary] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const recommendationRequest = useRef(0);
  const {
    bmiStats,
    addToCart,
    snackLogged,
    clearSnack,
    activeCategory,
    setActiveCategory,
    activeRole,
    searchQuery,
    setSearchQuery,
    activityGoal,
    logUserAction,
    availableRoles, roleAccessLoaded,
  } = useApp();

  const { account } = useAccountSession();
  const verifiedPersonaId = account?.main_persona_id || null;
  const secondaryPersonaIds = useMemo(() => account?.side_persona_ids || [], [account]);
  const userPersona = account?.main_persona;
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (direction: "left" | "right") => {
    carouselRef.current?.scrollBy({ left: direction === "left" ? -320 : 320, behavior: "smooth" });
  };
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !roleAccessLoaded) return;
    const currentRole = availableRoles.includes(activeRole) ? activeRole : "CONSUMER";
    if (currentRole === "MERCHANT") router.replace("/merchant");
    if (currentRole === "SHOPEE_ADMIN") router.replace("/admin");
  }, [isLoaded, isSignedIn, roleAccessLoaded, availableRoles, activeRole, router]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [catalog, setCatalog] = useState<DishItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Fetch Live AI Recommendation from AI Backend
  const fetchAiRecommendation = useCallback(async () => {
    const requestId = ++recommendationRequest.current;
    setIsLoadingAi(true);
    setAdaptiveDish(null);
    setAiRec(null);
    setCandidateIds([]);
    setPreferenceSummary("");
    setRecommendationError("");
    if (!account?.onboarding_complete) {
      setRecommendationError(isSignedIn ? "Complete your profile to see your recommendations." : "Sign in to see your recommendations.");
      setIsLoadingAi(false);
      return;
    }
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in to see your recommendations.");
      const data = await responseJson<{ dish: DishItem | null; candidate_ids: string[]; excluded_foods: string[]; reason: string; source: string }>(
        await fetch(`${API_BASE_URL}/api/preferences/recommendation`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        })
      );
      if (requestId !== recommendationRequest.current) return;
      setAdaptiveDish(data.dish);
      setCandidateIds(data.candidate_ids);
      setPreferenceSummary(data.excluded_foods.length ? `Saved preferences: dislike ${data.excluded_foods.join(", ")}.` : "No foods have been excluded by your preferences yet.");
      if (!data.dish) setRecommendationError(data.reason);
      else setAiRec({ source: data.source, selected_meal: {
        item_id: data.dish.id, item_name: data.dish.name, merchant_name: data.dish.merchantName,
        rationale: data.reason, final_cooking_instructions: data.dish.cookingNotes,
        estimated_macros: { kcal: data.dish.macros.kcal, protein_g: data.dish.macros.proteinG,
          carbs_g: data.dish.macros.carbsG, fat_g: data.dish.macros.fatG, sodium_mg: data.dish.macros.sodiumMg },
      }});
    } catch (err) {
      if (requestId === recommendationRequest.current)
        setRecommendationError(err instanceof Error ? err.message : "Recommendations are not available yet.");
    } finally {
      if (requestId === recommendationRequest.current) setIsLoadingAi(false);
    }
  }, [getToken, user?.id, account, isSignedIn]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const load = async () => {
      try {
        const result = await responseJson<{ data: DishItem[] }>(await fetch(`${API_BASE_URL}/api/dishes?limit=100`, { cache: "no-store", signal: controller.signal }));
        if (!result || !Array.isArray(result.data)) throw new Error("Invalid catalog response");
        if (!cancelled) setCatalog(result.data);
      } catch {
        if (!cancelled) setCatalogError("The catalog could not be loaded. Check your connection and try again.");
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setIsLoadingCatalog(false);
      }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [catalogAttempt]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void Promise.resolve().then(() => { if (!cancelled) void fetchAiRecommendation(); }); };
    refresh();
    window.addEventListener("nutrisea:preferences-updated", refresh);
    return () => {
      cancelled = true;
      recommendationRequest.current++;
      window.removeEventListener("nutrisea:preferences-updated", refresh);
    };
  }, [fetchAiRecommendation, verifiedPersonaId]);

  // User recommendation profile mapping existing NutriSea data
  const userProfile: UserRecommendationProfile = useMemo(() => {
    return {
      primaryPersonaId: verifiedPersonaId || undefined,
      secondaryPersonaIds: secondaryPersonaIds.length > 0 ? secondaryPersonaIds : (userPersona?.side_persona_ids || undefined),
      targetBudget: account?.profile?.meal_budget_idr,
      healthGoal: activityGoal,
      archetypeCode: userPersona?.archetype_code,
      targetLunchKcal: account?.profile?.kcal_target ? Math.round(account.profile.kcal_target * 0.4) : undefined,
      preferredTags: userPersona?.preferred_tags || undefined,
      preferredCuisines: userPersona?.preferred_cuisines || undefined,
      allergens: account?.profile?.allergies.join(",") || undefined,
      medicalConditions: undefined
    };
  }, [verifiedPersonaId, secondaryPersonaIds, userPersona, activityGoal, account]);

  // Full scored recommendations
  const recommendedDishes: (DishItem & { recommendationScore?: number })[] = useMemo(() => candidateIds.map(id => catalog.find(d => d.id === id)).filter((d): d is DishItem => !!d).slice(0, 10), [catalog, candidateIds]);
  const recommendedScoreMap = new Map<string, number>();

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const query = searchQuery.trim().toLocaleLowerCase("en");
      if (query && !`${item.name} ${item.merchantName}`.toLocaleLowerCase("en").includes(query)) return false;
      if (activeCategory === "persona") {
        const personas = item.personas || item.matchedPersonas || [];
        return personas.includes(verifiedPersonaId || "");
      }
      if (activeCategory === "hemat") return item.discountedPrice <= 20000;
      if (activeCategory === "protein") return typeof item.macros.proteinG === "number" && item.macros.proteinG >= 25;
      if (activeCategory === "rendah-kalori") return typeof item.macros.kcal === "number" && item.macros.kcal >= 0 && item.macros.kcal < 350;
      if (activeCategory === "bebas-santan") {
        return item.healthyTags.some(t => t.toLowerCase().includes("bebas santan") || t.toLowerCase().includes("tanpa santan"));
      }
      if (activeCategory === "lambung") return item.category === "lambung" || item.category === "rendah-kalori";
      return true;
    });
  }, [catalog, activeCategory, verifiedPersonaId, searchQuery]);

  // Normalize AI data for display
  const mealName =
    aiRec?.selected_meal?.item_name ||
    aiRec?.menu_item?.item_name ||
    "Menu name not available";

  const merchantName =
    aiRec?.selected_meal?.merchant_name ||
    aiRec?.selected_merchant?.merchant_name ||
    "Seller name not available";

  const aiRationale =
    aiRec?.selected_meal?.rationale ||
    aiRec?.rationale ||
    "The reason for this recommendation is not available.";

  const cookingNotes =
    aiRec?.selected_meal?.final_cooking_instructions ||
    aiRec?.menu_item?.cooking_notes ||
    "Preparation notes are not available. Confirm your requirements with the seller.";

  const calories =
    aiRec?.selected_meal?.estimated_macros?.kcal ?? null;

  const protein =
    aiRec?.selected_meal?.estimated_macros?.protein_g ?? null;

  return (
    <>
      {toastMessage && (
        <div className="app-toast" role="status">
          {toastMessage}
        </div>
      )}

      {/* 1. Hero Grid */}
      <section className="hero-banner-grid">
        {/* Promo Card */}
        <div className="promo-banner-card">
          <div>
            <span className="promo-banner-tag">NutriSea by ShopeeFood</span>
            <h1 className="promo-banner-title">
              Find your next meal
            </h1>
            <p className="promo-banner-sub">
              Explore meals with nutrition information. Confirm ingredients, portions, and availability with the seller.
            </p>
          </div>
          <button
            className="promo-banner-btn"
            onClick={() => document.getElementById("all-dishes-catalog")?.scrollIntoView({ behavior: "smooth" })}
          >
            Browse meals
          </button>
        </div>

        {/* Quick BMI Summary Card */}
        <div className="bmi-summary-card">
          <div className="bmi-summary-header">
            <span className="bmi-summary-title">
              <Scale size={15} /> Estimated daily nutrition
            </span>
            <span className={`bmi-category-badge ${bmiStats.badgeClass}`}>
              {account?.profile ? "Profile estimate" : "Set up your profile"}
            </span>
          </div>

          <div className="bmi-stats-row">
            <div className="bmi-stat-box">
              <span className="bmi-stat-val">{account?.profile ? bmiStats.targetCalories : "Not set"}</span>
              <span className="bmi-stat-lbl">Calorie target (kcal)</span>
            </div>
            <div className="bmi-stat-box">
              <span className="bmi-stat-val" style={{ color: "#00B14F" }}>{account?.profile ? `${bmiStats.targetProtein}g` : "Not set"}</span>
              <span className="bmi-stat-lbl">Protein</span>
            </div>
            <div className="bmi-stat-box">
              <span className="bmi-stat-val" style={{ color: "#EE4D2D" }}>BMI {account?.profile ? bmiStats.score : "Not set"}</span>
              <span className="bmi-stat-lbl">Calculated BMI</span>
            </div>
          </div>

          <Link
            href="/bmi"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#EE4D2D",
              textDecoration: "none",
              paddingTop: 8,
              borderTop: "1px solid #F0F0F0"
            }}
          >
            <span>Update height and weight</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* 2. Interactive AI Real-time Recommendation Section */}
      <section style={{ marginBottom: 18 }}>
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "8px",
            border: "1px solid #FFD0C0",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(238, 77, 45, 0.08)"
          }}
        >
          {/* Top Bar with AI Badge */}
          <div
            style={{
              backgroundColor: "#FFF4F0",
              padding: "10px 14px",
              borderBottom: "1px solid #FFE4DB",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  backgroundColor: "#EE4D2D",
                  color: "#FFFFFF",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Sparkles size={12} /> {aiRec?.source === "openai" ? "AI meal suggestion" : "Rule-based suggestions"}
              </span>
            </div>

            <button
              onClick={fetchAiRecommendation}
              disabled={isLoadingAi}
              style={{
                background: "transparent",
                border: "1px solid #EE4D2D",
                color: "#EE4D2D",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: isLoadingAi ? "not-allowed" : "pointer"
              }}
            >
              <RefreshCw size={11} className={isLoadingAi ? "spin-icon" : ""} />
              {isLoadingAi ? "Loading..." : "Refresh recommendations"}
            </button>
          </div>

          {/* AI Content Card */}
          <div style={{ padding: "14px 16px" }}>
            {isLoadingAi ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#666", fontSize: "13px" }}>
                <RefreshCw size={18} className="spin-icon" color="#EE4D2D" style={{ margin: "0 auto 8px" }} />
                Loading your catalog and preferences...
              </div>
            ) : !adaptiveDish ? (
              <p role="status">{recommendationError || "Recommendations are not available yet."}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p role="status">{preferenceSummary}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#222" }}>
                      {mealName}
                    </h3>
                    <div style={{ fontSize: "12px", color: "#666", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Store size={12} /> {merchantName}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ backgroundColor: "#F0F0F0", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, color: "#333" }}>
                      Energy: {nutrientText(calories, "kcal")}
                    </span>
                    <span style={{ backgroundColor: "#EBF9F1", color: "#00B14F", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500 }}>
                      Protein: {nutrientText(protein, "g")}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: "12px", color: "#666" }}>{nutritionSourceLabel(adaptiveDish.nutritionSource)}.</p>
                <button type="button" onClick={() => void logUserAction("DISMISS_SUGGESTION", { item_id: adaptiveDish.id, reason: "not_interested" }).then(() => { setAdaptiveDish(null); setAiRec(null); })}>Not for me</button>

                {/* Recommendation rationale */}
                <div
                  style={{
                    backgroundColor: "#F8F9FA",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    color: "#444",
                    lineHeight: "1.45",
                    borderLeft: "3px solid #EE4D2D"
                  }}
                >
                  <strong style={{ color: "#222" }}>Why this meal: </strong>
                  {aiRationale}
                </div>

                {/* AI Kitchen Instruction */}
                <div
                  style={{
                    backgroundColor: "#FFF9F5",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    color: "#C2410C",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <ChefHat size={14} />
                  <span>
                    <strong>Notes for the seller:</strong> {cookingNotes}
                  </span>
                </div>

                {/* Quick Add Button */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    onClick={() => {
                      if (!adaptiveDish) return;
                      addToCart(adaptiveDish);
                      showToast("Recommended meal added to your cart.");
                    }}
                    style={{
                      backgroundColor: "#EE4D2D",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: "4px",
                      padding: "8px 16px",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <ShoppingBag size={14} /> Add to cart
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Local demo state does not confirm a saved meal. */}
      {snackLogged && (
        <section style={{ marginBottom: 14 }}>
          <div
            style={{
              backgroundColor: "#EBF9F1",
              border: "1px solid #C2EFD7",
              borderRadius: "4px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color="#00B14F" />
              <div>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "#00B14F" }}>
                  Demo menu filter enabled
                </span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: 8 }}>
                  This is a demo view. No meal has been logged and no nutrition targets have been changed.
                </span>
              </div>
            </div>
            <button
              style={{
                background: "transparent",
                border: "none",
                fontSize: "12px",
                color: "#00B14F",
                cursor: "pointer",
                padding: "2px 6px"
              }}
              onClick={clearSnack}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* ShopeeFood Recommended Section: Personalized for User Main Persona */}
      {recommendedDishes.length > 0 && (
        <section className="shopee-rec-section">
          <div className="shopee-rec-header">
            <div className="shopee-rec-title-group">
              <div className="shopee-rec-badge-row">
                <span className="shopee-rec-badge">
                  <Sparkles size={11} /> Recommended for you
                </span>
                {userPersona && (
                  <span className="shopee-rec-persona-tag">
                    {account?.user.name || "Customer"}
                  </span>
                )}
              </div>
              <h2 className="shopee-rec-title">
                Meals based on your profile and persona template
              </h2>
              <p className="shopee-rec-sub">
                {recommendedDishes.length} suggestions from your saved preferences and profile. These are not a guarantee of dietary or medical suitability.
              </p>
            </div>

            <div className="shopee-rec-nav-actions">
              <button
                type="button"
                className="shopee-rec-arrow-btn"
                onClick={() => scrollCarousel("left")}
                title="Scroll left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="shopee-rec-arrow-btn"
                onClick={() => scrollCarousel("right")}
                title="Scroll right"
                aria-label="Scroll right"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="shopee-rec-see-all-btn"
                onClick={() => {
                  setActiveCategory("persona");
                  const el = document.getElementById("all-dishes-catalog");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                View all ({recommendedDishes.length}) <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Carousel styled after ShopeeFood */}
          <div className="shopee-rec-carousel" ref={carouselRef}>
            {recommendedDishes.map((dish) => {
              const discountPercent = Math.round(((dish.basePrice - dish.discountedPrice) / dish.basePrice) * 100);

              // Top-left Shopee badge logic
              let badgeText = "MENU PICK";
              if (dish.discountedPrice <= 20000) {
                badgeText = "UP TO RP20,000";
              } else if (dish.macros.proteinG >= 25) {
                badgeText = "PROTEIN ≥ 25 G";
              } else if (dish.category === "lambung") {
                badgeText = "CATEGORY PICK";
              } else if (dish.macros.kcal <= 350) {
                badgeText = "LOWER CALORIE";
              }

              return (
                <Link
                  key={dish.id}
                  href={`/menu/${dish.id}`}
                  onClick={() => {
                    logUserAction("CLICK_MENU_ITEM", {
                      item_id: dish.id,
                      item_name: dish.name,
                      merchant_name: dish.merchantName,
                      price: dish.discountedPrice,
                      personas: dish.personas || dish.matchedPersonas || [],
                      category: dish.category,
                      macros: dish.macros
                    });
                  }}
                  className="shopee-rec-card"
                >
                  {/* Image Container with Shopee Overlays */}
                  <div className="shopee-rec-card-img-wrap">
                    {dish.imageUrl ? (
                      <FoodImage
                        src={dish.imageUrl}
                        alt={dish.name}
                        className="shopee-rec-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "linear-gradient(135deg, #FFF0EB 0%, #FEE2E2 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#EE4D2D"
                        }}
                      >
                        <Utensils size={28} />
                      </div>
                    )}

                    {/* Rule-based recommendation score */}
                    <span className="shopee-rec-card-tag">
                      {dish.recommendationScore !== undefined
                        ? `Rule score ${Math.round(dish.recommendationScore * 100)}/100`
                        : badgeText}
                    </span>

                    {/* Top Right Discount Badge */}
                    {discountPercent > 0 && (
                      <span className="shopee-rec-card-discount">
                        -{discountPercent}%
                      </span>
                    )}

                    {/* Bottom Sold Count Overlay */}
                    <div className="shopee-rec-card-sold-overlay">
                      <span className="shopee-rec-card-sold-text">
                        {dish.soldCount ? `${dish.soldCount} sold` : "Sales count not available"}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="shopee-rec-card-body">
                    <div>
                      <div className="shopee-rec-card-merchant" title={dish.merchantName}>
                        {dish.merchantName}
                      </div>
                      <h3 className="shopee-rec-card-title" title={dish.name}>
                        {dish.name}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                        {dish.recommendationScore !== undefined && (
                          <span
                            className="shopee-rec-card-score-chip"
                            title={`Rule-based matching score (not a clinical probability): ${Math.round(dish.recommendationScore * 100)}/100`}
                          >
                            Rule score {Math.round(dish.recommendationScore * 100)}/100
                          </span>
                        )}
                        <span className="shopee-rec-card-macro-chip" style={{ marginBottom: 0 }}>
                          Energy: {nutrientText(dish.macros.kcal, "kcal")} · Protein: {nutrientText(dish.macros.proteinG, "g")}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#666", marginBottom: 6 }}>{nutritionSourceLabel(dish.nutritionSource)}.</p>
                    </div>

                    {/* Footer: Price & Quick Add Button */}
                    <div className="shopee-rec-card-footer">
                      <div className="shopee-rec-card-price-col">
                        <span className="shopee-rec-card-price">
                          Rp {dish.discountedPrice.toLocaleString("id-ID")}
                        </span>
                        {dish.basePrice > dish.discountedPrice && (
                          <span className="shopee-rec-card-orig-price">
                            Rp {dish.basePrice.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="shopee-rec-card-add-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addToCart(dish);
                          showToast(`${dish.name} added to your cart.`);
                        }}
                        title="Add to cart"
                        aria-label="Add to cart"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Category Filter Tabs */}
      <section className="category-filter-bar">
        {[
          { key: "semua", label: "All meals" },
          ...(verifiedPersonaId ? [{ key: "persona", label: `For ${user?.firstName || "you"} (${recommendedDishes.length})` }] : []),
          { key: "hemat", label: "Budget meals (up to Rp20,000)" },
          { key: "protein", label: "Protein ≥ 25 g" },
          { key: "rendah-kalori", label: "Under 350 kcal" },
          { key: "bebas-santan", label: "No coconut milk label" },
          { key: "lambung", label: "Stomach-related category" }
        ].map((cat) => (
          <button
            key={cat.key}
            type="button"
            aria-pressed={activeCategory === cat.key}
            className={`category-tab-btn ${activeCategory === cat.key ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </section>

      {/* 5. Section Header */}
      <div id="all-dishes-catalog" className="section-header">
        <h2 className="section-title">
          <Utensils size={16} color="#EE4D2D" />
          {activeCategory === "persona"
            ? `Persona-based meals: ${account?.user.name || "You"}`
            : "Explore meals from local eateries and restaurants"}
        </h2>
        <span className="section-count">
          {isLoadingCatalog ? "Loading..." : catalogError ? "" : `${filteredCatalog.length} meals`}
        </span>
      </div>

      {isLoadingCatalog && <p role="status" style={{ padding: "32px 20px", textAlign: "center" }}>Loading meals and nutrition information...</p>}
      {catalogError && <div role="alert" style={{ backgroundColor: "#FFFFFF", padding: "32px 20px", textAlign: "center", borderRadius: 8, marginBottom: 20 }}><p>{catalogError}</p><button className="btn-shopee-primary" style={{ marginTop: 12 }} onClick={() => { setCatalogError(""); setIsLoadingCatalog(true); setCatalogAttempt(attempt => attempt + 1); }}>Try again</button></div>}
      {filteredCatalog.length === 0 && !isLoadingCatalog && !catalogError && (
        <div style={{ backgroundColor: "#FFFFFF", padding: "40px 20px", textAlign: "center", borderRadius: 8, border: "1px dashed #DDD", margin: "10px 0 20px" }}>
          <Utensils size={32} color="#AAA" style={{ margin: "0 auto 8px" }} />
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#444" }}>{catalog.length ? "No meals match your search or filters" : "No meals available yet"}</h3>
          <p style={{ fontSize: "12px", color: "#777", marginTop: 4 }}>
            {catalog.length ? "Try another search or clear the filters to see all meals." : "The catalog is currently empty. Try loading it again later."}
          </p>
          <button className="btn-shopee-primary" style={{ marginTop: 12 }} onClick={() => { if (catalog.length) { setActiveCategory("semua"); setSearchQuery(""); } else { setIsLoadingCatalog(true); setCatalogAttempt(attempt => attempt + 1); } }}>{catalog.length ? "Clear search and filters" : "Reload catalog"}</button>
        </div>
      )}

      {/* 6. Food Grid */}
      <div className="food-grid">
        {filteredCatalog.map((dish) => (
          <Link
            key={dish.id}
            href={`/menu/${dish.id}`}
            onClick={() => {
              logUserAction("CLICK_MENU_ITEM", {
                item_id: dish.id,
                item_name: dish.name,
                merchant_name: dish.merchantName,
                price: dish.discountedPrice,
                personas: dish.personas || dish.matchedPersonas || [],
                category: dish.category,
                macros: dish.macros
              });
            }}
            className="food-card"
          >
            {/* Thumbnail Image */}
            <div className="food-card-img-wrap">
              {dish.imageUrl ? (
                <FoodImage
                  src={dish.imageUrl}
                  alt={dish.name}
                  className="food-card-img"
                  loading="lazy"
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: "#6C757D"
                  }}
                >
                  <Utensils size={28} color="#EE4D2D" style={{ opacity: 0.7 }} />
                  <span style={{ fontSize: "10.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#888" }}>
                    {categoryLabels[dish.category] || "Menu category"}
                  </span>
                </div>
              )}
              <span className="food-card-promo-badge">
                Save {Math.round(((dish.basePrice - dish.discountedPrice) / dish.basePrice) * 100)}%
              </span>
            </div>

            {/* Body */}
            <div className="food-card-body">
              <div>
                <div className="food-merchant-row">
                  <span className="food-merchant-name">
                    <Store size={11} color="#666" />
                    {dish.merchantName}
                  </span>
                  <span>{dish.distanceKm} km | {dish.rating} ({dish.soldCount})</span>
                </div>

                <h3 className="food-card-title">{dish.name}</h3>

                {/* Health Tags & Recommendation Score Pill */}
                <div className="food-card-tags">
                  {recommendedScoreMap.has(dish.id) ? (
                    <span
                      className="healthy-tag-pill"
                      style={{
                        backgroundColor: "#FFF0EB",
                        color: "#EE4D2D",
                        borderColor: "#FFD0C0",
                        fontWeight: 700
                      }}
                      title={`Rule-based matching score (not a clinical probability): ${Math.round(recommendedScoreMap.get(dish.id)! * 100)}/100`}
                    >
                      Rule score {Math.round(recommendedScoreMap.get(dish.id)! * 100)}/100
                    </span>
                  ) : (
                    verifiedPersonaId && (dish.personas?.includes(verifiedPersonaId) || dish.matchedPersonas?.includes(verifiedPersonaId)) && (
                      <span
                        className="healthy-tag-pill"
                        style={{
                          backgroundColor: "#FFF0EB",
                          color: "#EE4D2D",
                          borderColor: "#FFD0C0",
                          fontWeight: 600
                        }}
                      >
                        Persona match
                      </span>
                    )
                  )}
                  {dish.healthyTags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="healthy-tag-pill">
                      {catalogLabelEnglish(tag)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price & Action */}
              <div className="food-card-footer">
                <div>
                  <div className="food-card-price">
                    Rp {dish.discountedPrice.toLocaleString("id-ID")}
                  </div>
                  <div className="food-card-macros">
                    Energy: {nutrientText(dish.macros.kcal, "kcal")} | Protein: {nutrientText(dish.macros.proteinG, "g")}
                  </div>
                  <div className="food-card-macros">{nutritionSourceLabel(dish.nutritionSource)}.</div>
                </div>

                <button
                  className="food-card-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addToCart(dish);
                    showToast(`${dish.name} added to your cart.`);
                  }}
                  aria-label="Add to cart"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
