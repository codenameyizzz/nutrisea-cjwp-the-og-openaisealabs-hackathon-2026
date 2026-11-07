"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AUTH_ROUTES } from "@/domains/auth/config/auth-routes";
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
import { DishItem, fetchMenuCatalog } from "@/data/menu";
import { rankRecommendations, UserRecommendationProfile } from "@/services/recommendationScorer";
import { useApp } from "@/context/AppContext";

interface AiRecommendation {
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

export default function HomePage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const {
    bmiStats,
    addToCart,
    snackLogged,
    clearSnack,
    activeCategory,
    setActiveCategory,
    activeRole,
    searchQuery,
    activityGoal,
    logUserAction,
    availableRoles, roleAccessLoaded,
  } = useApp();

  const [isCheckingDbPersona, setIsCheckingDbPersona] = useState(true);
  const [verifiedPersonaId, setVerifiedPersonaId] = useState<string | null>(null);
  const [secondaryPersonaIds, setSecondaryPersonaIds] = useState<string[]>([]);
  const [userPersona, setUserPersona] = useState<any | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const offset = direction === "left" ? -320 : 320;
      carouselRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  // Route guard: queries PostgreSQL database directly. If user has no persona in DB, redirect to onboarding
  useEffect(() => {
    if (!isLoaded || !roleAccessLoaded) return;

    if (!isSignedIn || !user) {
      router.replace(AUTH_ROUTES.SIGN_IN);
      return;
    }

    const currentRole = availableRoles.includes(activeRole) ? activeRole : "CONSUMER";
    if (currentRole === "MERCHANT") {
      router.replace("/merchant");
      return;
    }
    if (currentRole === "SHOPEE_ADMIN") {
      router.replace("/admin");
      return;
    }

    const verifyDatabasePersona = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/personas/users/${user.id}/personas`);
        if (res.ok) {
          const data = await res.json();
          const personaId = data.main_persona_id || data.main_persona?.id;
          if (personaId) {
            // Persona confirmed in PostgreSQL database!
            setVerifiedPersonaId(personaId);
            setUserPersona(data.main_persona || null);
            if (data.side_persona_ids && Array.isArray(data.side_persona_ids)) {
              setSecondaryPersonaIds(data.side_persona_ids);
            }
            if (typeof window !== "undefined") {
              localStorage.setItem("nutrisea_main_persona", personaId);
              if (data.side_persona_ids) {
                localStorage.setItem("nutrisea_side_personas", JSON.stringify(data.side_persona_ids));
              }
            }
            setIsCheckingDbPersona(false);
            return;
          }
        }

        // If DB returned 404 or persona is null, check Clerk metadata fallback
        const fallbackClerkPersona = (user.unsafeMetadata?.main_persona_id as string) || (typeof window !== "undefined" ? localStorage.getItem("nutrisea_main_persona") : null);
        if (fallbackClerkPersona) {
          setVerifiedPersonaId(fallbackClerkPersona);
          if (typeof window !== "undefined") {
            const savedSides = localStorage.getItem("nutrisea_side_personas");
            if (savedSides) {
              try { setSecondaryPersonaIds(JSON.parse(savedSides)); } catch {}
            }
          }
          setIsCheckingDbPersona(false);
          fetch(`http://127.0.0.1:8000/api/personas?search=${fallbackClerkPersona}`)
            .then((r) => r.json())
            .then((ps) => {
              if (ps && ps[0]) setUserPersona(ps[0]);
            })
            .catch(() => {});
          return;
        }

        // Truly no persona in DB or metadata -> route to onboarding screen
        if (typeof window !== "undefined") {
          localStorage.removeItem("nutrisea_main_persona");
          localStorage.removeItem("nutrisea_side_personas");
        }
        router.replace(AUTH_ROUTES.PERSONA_SELECTION);
      } catch (err) {
        console.warn("DB persona check network notice:", err);
        const fallbackPersona = (user.unsafeMetadata?.main_persona_id as string) || (typeof window !== "undefined" ? localStorage.getItem("nutrisea_main_persona") : null);
        if (fallbackPersona) {
          setVerifiedPersonaId(fallbackPersona);
          setIsCheckingDbPersona(false);
        } else {
          router.replace(AUTH_ROUTES.PERSONA_SELECTION);
        }
      }
    };

    verifyDatabasePersona();
  }, [isLoaded, isSignedIn, user?.id, activeRole, router, roleAccessLoaded, availableRoles]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [aiRec, setAiRec] = useState<AiRecommendation | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [catalog, setCatalog] = useState<DishItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Fetch Live AI Recommendation from AI Backend
  const fetchAiRecommendation = async () => {
    setIsLoadingAi(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/recommend/lunch?persona_id=${verifiedPersonaId || "CORP_LILY_SCBD_001"}`);
      if (res.ok) {
        const data = await res.json();
        setAiRec(data);
      }
    } catch (err) {
      console.warn("Backend AI fetch failed, using fallback:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  useEffect(() => {
    setIsLoadingCatalog(true);
    fetchMenuCatalog()
      .then((data) => setCatalog(data))
      .catch((err) => console.warn("Failed to load catalog from PostgreSQL:", err))
      .finally(() => setIsLoadingCatalog(false));
  }, []);

  useEffect(() => {
    if (verifiedPersonaId) {
      fetchAiRecommendation();
    }
  }, [verifiedPersonaId]);

  // User recommendation profile mapping existing NutriSea data
  const userProfile: UserRecommendationProfile = useMemo(() => {
    return {
      primaryPersonaId: verifiedPersonaId || undefined,
      secondaryPersonaIds: secondaryPersonaIds.length > 0 ? secondaryPersonaIds : (userPersona?.side_persona_ids || undefined),
      targetBudget: userPersona?.target_lunch_budget_idr,
      healthGoal: userPersona?.health_goal || activityGoal,
      archetypeCode: userPersona?.archetype_code,
      targetLunchKcal: userPersona?.target_lunch_kcal || (bmiStats?.targetCalories ? Math.round(bmiStats.targetCalories * 0.4) : undefined),
      preferredTags: userPersona?.preferred_tags || undefined,
      preferredCuisines: userPersona?.preferred_cuisines || undefined,
      allergens: userPersona?.allergens && userPersona.allergens !== "NONE" ? userPersona.allergens : undefined,
      medicalConditions: userPersona?.medical_conditions && userPersona.medical_conditions !== "NONE" ? userPersona.medical_conditions : undefined
    };
  }, [verifiedPersonaId, secondaryPersonaIds, userPersona, activityGoal, bmiStats]);

  // Full scored recommendations
  const allScoredDishes = useMemo(() => {
    if (catalog.length === 0) return [];
    return rankRecommendations(catalog, userProfile, {
      searchQuery: searchQuery || undefined
    });
  }, [catalog, userProfile, searchQuery]);

  // Recommended section: strictly top 10 dishes with score above 70% (score >= 0.70)
  const recommendedDishes = useMemo(() => {
    return allScoredDishes
      .filter((d) => d.recommendationScore >= 0.70)
      .slice(0, 10);
  }, [allScoredDishes]);

  // Lookup map for fast recommendation score display on any menu item card
  const recommendedScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of allScoredDishes) {
      if (d.recommendationScore !== undefined) {
        map.set(d.id, d.recommendationScore);
      }
    }
    return map;
  }, [allScoredDishes]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (activeCategory === "persona") {
        const personas = item.personas || item.matchedPersonas || [];
        return personas.includes(verifiedPersonaId || "");
      }
      if (activeCategory === "hemat") return item.discountedPrice <= 20000;
      if (activeCategory === "protein") return item.macros.proteinG >= 25;
      if (activeCategory === "rendah-kalori") return item.macros.kcal < 350;
      if (activeCategory === "bebas-santan") {
        return item.healthyTags.some(t => t.toLowerCase().includes("bebas santan") || t.toLowerCase().includes("tanpa santan"));
      }
      if (activeCategory === "lambung") return item.category === "lambung" || item.category === "rendah-kalori";
      return true;
    });
  }, [catalog, activeCategory, verifiedPersonaId]);

  // Normalize AI data for display
  const mealName =
    aiRec?.selected_meal?.item_name ||
    aiRec?.menu_item?.item_name ||
    "Paket Sehat Ayam Bakar Dada + Sayur Bening Bayam";

  const merchantName =
    aiRec?.selected_meal?.merchant_name ||
    aiRec?.selected_merchant?.merchant_name ||
    "Warteg Berkah Mandiri - Kuningan";

  const aiRationale =
    aiRec?.selected_meal?.rationale ||
    "Menu ini disesuaikan dengan batas target kalori makan siang Anda, tinggi protein tanpa lemak berlebih, dan sayur bening yang ramah untuk asam lambung.";

  const cookingNotes =
    aiRec?.selected_meal?.final_cooking_instructions ||
    aiRec?.menu_item?.cooking_notes ||
    "Nasi setengah porsi, sambal dipisah, tanpa kuah santan";

  const calories =
    aiRec?.selected_meal?.estimated_macros?.kcal || 410;

  const protein =
    aiRec?.selected_meal?.estimated_macros?.protein_g || 36;

  if (!isLoaded || (isSignedIn && isCheckingDbPersona && activeRole === "CONSUMER")) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", color: "#64748B" }}>
          <div style={{
            width: 28,
            height: 28,
            border: "3px solid rgba(238,77,45,0.2)",
            borderTopColor: "#EE4D2D",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px auto"
          }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Memeriksa profil persona...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {toastMessage && (
        <div className="app-toast">
          {toastMessage}
        </div>
      )}

      {/* 1. Hero Grid */}
      <section className="hero-banner-grid">
        {/* Promo Card */}
        <div className="promo-banner-card">
          <div>
            <span className="promo-banner-tag">ShopeeFood Sehat</span>
            <h1 className="promo-banner-title">
              Diskon 35% + Bebas Ongkir Kalau Presiden nya Ganti
            </h1>
            <p className="promo-banner-sub">
              Menu pilihan warteg terverifikasi minyak goreng baru, kuah kaldu segar, dan bebas santan berlebih.
            </p>
          </div>
          <button
            className="promo-banner-btn"
            onClick={() => showToast("Voucher NutriSea 35% berhasil diklaim!")}
          >
            Klaim Voucher
          </button>
        </div>

        {/* Quick BMI Summary Card */}
        <div className="bmi-summary-card">
          <div className="bmi-summary-header">
            <span className="bmi-summary-title">
              <Scale size={15} /> Target Gizi Harian
            </span>
            <span className={`bmi-category-badge ${bmiStats.badgeClass}`}>
              {bmiStats.category}
            </span>
          </div>

          <div className="bmi-stats-row">
            <div className="bmi-stat-box">
              <span className="bmi-stat-val">{bmiStats.targetCalories}</span>
              <span className="bmi-stat-lbl">Target Kalori (kcal)</span>
            </div>
            <div className="bmi-stat-box">
              <span className="bmi-stat-val" style={{ color: "#00B14F" }}>{bmiStats.targetProtein}g</span>
              <span className="bmi-stat-lbl">Protein</span>
            </div>
            <div className="bmi-stat-box">
              <span className="bmi-stat-val" style={{ color: "#EE4D2D" }}>BMI {bmiStats.score}</span>
              <span className="bmi-stat-lbl">Status Gizi</span>
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
            <span>Sesuaikan Tinggi & Berat Badan</span>
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
                <Sparkles size={12} /> AI Smart Planner
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
              {isLoadingAi ? "Menganalisis..." : "Minta Menu Lain (AI)"}
            </button>
          </div>

          {/* AI Content Card */}
          <div style={{ padding: "14px 16px" }}>
            {isLoadingAi ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#666", fontSize: "13px" }}>
                <RefreshCw size={18} className="spin-icon" color="#EE4D2D" style={{ margin: "0 auto 8px" }} />
                AI sedang menganalisis kebutuhan kalori & 24 mitra warteg terdekat...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                      {calories} kcal
                    </span>
                    <span style={{ backgroundColor: "#EBF9F1", color: "#00B14F", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500 }}>
                      {protein}g Protein
                    </span>
                  </div>
                </div>

                {/* AI Clinical Rationale */}
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
                  <strong style={{ color: "#222" }}>Alasan Klinis AI: </strong>
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
                    <strong>Instruksi Dapur Otomatis:</strong> {cookingNotes}
                  </span>
                </div>

                {/* Quick Add Button */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    onClick={() => {
                      const baselineDish = catalog[0] || {
                        id: "DISH-01",
                        category: "protein" as const,
                        district: "Kuningan",
                        distanceKm: 0.8,
                        rating: 4.8,
                        soldCount: "1.8rb+",
                        basePrice: 32000,
                        discountedPrice: 25600,
                        imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
                        healthyTags: ["Minyak Baru", "Sayur Bening"],
                        hygieneBadges: ["Minyak Baru Terverifikasi", "Dapur Higienis"]
                      };
                      addToCart({
                        ...baselineDish,
                        id: "itm-ai-rec",
                        name: mealName,
                        merchantName: merchantName,
                        cookingNotes: cookingNotes,
                        macros: { kcal: calories, proteinG: protein, carbsG: 42, fatG: 8, sodiumMg: 580 }
                      });
                      showToast("Menu AI ditambahkan ke Keranjang!");
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
                    <ShoppingBag size={14} /> Pesan Menu Rekomendasi Ini
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Recalibration Banner (if snack logged) */}
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
                  Camilan Sore Tercatat (+320 kcal)
                </span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: 8 }}>
                  AI otomatis menyeimbangkan menu malam ke porsi kaldu sayur bening.
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
              Reset
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
                  <Sparkles size={11} /> TOP 10 REKOMENDASI (70%+)
                </span>
                {userPersona && (
                  <span className="shopee-rec-persona-tag">
                    👤 {userPersona.full_name} ({userPersona.archetype_name})
                  </span>
                )}
              </div>
              <h2 className="shopee-rec-title">
                Menu Pilihan Sesuai Profil Gizi & Batasan Medis Kamu
              </h2>
              <p className="shopee-rec-sub">
                Top {recommendedDishes.length} menu dengan kecocokan di atas 70% {userPersona?.target_lunch_kcal ? `• Target: ${userPersona.target_lunch_kcal} kcal` : ""} • {userPersona?.medical_conditions && userPersona.medical_conditions !== "NONE" ? `Aman: ${userPersona.medical_conditions}` : "Nutrisi seimbang & minyak baru"}
              </p>
            </div>

            <div className="shopee-rec-nav-actions">
              <button
                type="button"
                className="shopee-rec-arrow-btn"
                onClick={() => scrollCarousel("left")}
                title="Geser Kiri"
                aria-label="Geser Kiri"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="shopee-rec-arrow-btn"
                onClick={() => scrollCarousel("right")}
                title="Geser Kanan"
                aria-label="Geser Kanan"
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
                Lihat Semua ({recommendedDishes.length}) <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Carousel styled after ShopeeFood */}
          <div className="shopee-rec-carousel" ref={carouselRef}>
            {recommendedDishes.map((dish) => {
              const discountPercent = Math.round(((dish.basePrice - dish.discountedPrice) / dish.basePrice) * 100);
              
              // Top-left Shopee badge logic
              let badgeText = "100% COCOK";
              if (dish.discountedPrice <= 20000) {
                badgeText = "TERMURAH";
              } else if (dish.macros.proteinG >= 25) {
                badgeText = "HIGH PROTEIN";
              } else if (dish.category === "lambung") {
                badgeText = "RAMAH LAMBUNG";
              } else if (dish.macros.kcal <= 350) {
                badgeText = "RENDAH KALORI";
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
                      <img
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

                    {/* Top Left Tag with Exact Recommendation Match Score */}
                    <span className="shopee-rec-card-tag">
                      {dish.recommendationScore !== undefined
                        ? `🎯 ${Math.round(dish.recommendationScore * 100)}% COCOK`
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
                        {dish.soldCount || "1.2rb+"} terjual
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
                            title={`Skor Rekomendasi Klinis R(u, m): ${(dish.recommendationScore * 100).toFixed(1)}%`}
                          >
                            🎯 Skor {Math.round(dish.recommendationScore * 100)}%
                          </span>
                        )}
                        <span className="shopee-rec-card-macro-chip" style={{ marginBottom: 0 }}>
                          {dish.macros.kcal} kcal • {dish.macros.proteinG}g P
                        </span>
                      </div>
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
                          showToast(`${dish.name} ditambahkan ke Keranjang!`);
                        }}
                        title="Tambah ke Keranjang"
                        aria-label="Tambah ke Keranjang"
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
          { key: "semua", label: "Semua Menu" },
          ...(verifiedPersonaId ? [{ key: "persona", label: `✨ Khusus ${userPersona?.full_name ? userPersona.full_name.split(" ")[0] : "Persona"} (${recommendedDishes.length})` }] : []),
          { key: "hemat", label: "Budget Hemat (< 20rb)" },
          { key: "protein", label: "Tinggi Protein (> 25g)" },
          { key: "rendah-kalori", label: "Rendah Kalori (< 350 kcal)" },
          { key: "bebas-santan", label: "Bebas Santan" },
          { key: "lambung", label: "Ramah Lambung" }
        ].map((cat) => (
          <button
            key={cat.key}
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
            ? `Menu Sesuai Persona: ${userPersona?.full_name || "Kamu"}`
            : "Eksplor Menu Warteg & Resto Sehat"}
        </h2>
        <span className="section-count">
          {filteredCatalog.length} Menu
        </span>
      </div>

      {/* Empty State when Database is Depopulated */}
      {filteredCatalog.length === 0 && !isLoadingCatalog && (
        <div style={{ backgroundColor: "#FFFFFF", padding: "40px 20px", textAlign: "center", borderRadius: 8, border: "1px dashed #DDD", margin: "10px 0 20px" }}>
          <Utensils size={32} color="#AAA" style={{ margin: "0 auto 8px" }} />
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#444" }}>Database Katalog Kosong</h3>
          <p style={{ fontSize: "12px", color: "#777", marginTop: 4 }}>
            Semua data telah dikosongkan. Data tersimpan bersih di database PostgreSQL Aiven Cloud.
          </p>
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
                <img
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
                    {dish.category}
                  </span>
                </div>
              )}
              <span className="food-card-promo-badge">
                Hemat {Math.round(((dish.basePrice - dish.discountedPrice) / dish.basePrice) * 100)}%
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
                      title={`Skor Rekomendasi Klinis R(u, m): ${(recommendedScoreMap.get(dish.id)! * 100).toFixed(1)}%`}
                    >
                      🎯 {Math.round(recommendedScoreMap.get(dish.id)! * 100)}% Cocok
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
                        ✨ Cocok
                      </span>
                    )
                  )}
                  {dish.healthyTags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="healthy-tag-pill">
                      {tag}
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
                    {dish.macros.kcal} kcal | {dish.macros.proteinG}g protein
                  </div>
                </div>

                <button
                  className="food-card-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addToCart(dish);
                    showToast(`${dish.name} ditambahkan`);
                  }}
                  aria-label="Tambah"
                >
                  <Plus size={13} /> Tambah
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
