"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { Plus, RefreshCw } from "lucide-react";
import FoodImage from "@/components/FoodImage";
import { API_BASE_URL, responseJson } from "@/lib/api";
import type { DishItem } from "@/data/menu";
import { useApp } from "@/context/AppContext";
import { useAccountSession } from "@/context/AccountSessionContext";
import styles from "./commerce.module.css";

function nutrientHint(value: unknown, unit: string): string | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString("en-US")} ${unit}` : null;
}

function FoodCard({ dish, onSelect, onAdd }: {
  dish: DishItem;
  onSelect: (dish: DishItem) => void;
  onAdd: (dish: DishItem) => void;
}) {
  const energy = nutrientHint(dish.macros.kcal, "kcal");
  const protein = nutrientHint(dish.macros.proteinG, "g protein");
  return (
    <article className={styles.foodCard}>
      <Link href={`/menu/${dish.id}`} className={styles.cardLink} onClick={() => onSelect(dish)}>
        <FoodImage src={dish.imageUrl} alt={dish.name} className={styles.cardImage} width={480} height={320} />
        <div className={styles.cardBody}>
          <h3 title={dish.name}>{dish.name}</h3>
          <p className={styles.merchant}>{dish.merchantName}</p>
          <p className={styles.nutrientHint}>{[energy, protein].filter(Boolean).join(" · ") || "Nutrition not provided"}</p>
        </div>
      </Link>
      <div className={styles.cardFooter}>
        <strong className={styles.cardPrice}>Rp {dish.discountedPrice.toLocaleString("en-US")}</strong>
        <button type="button" className={styles.addButton} disabled={dish.isAvailable === false} onClick={() => onAdd(dish)} aria-label={`Add ${dish.name} to cart`}>
          <Plus size={16} aria-hidden="true" />{dish.isAvailable === false ? "Unavailable" : "Add"}
        </button>
      </div>
    </article>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { account } = useAccountSession();
  const {
    addToCart, snackLogged, clearSnack, activeCategory, setActiveCategory, activeRole,
    searchQuery, setSearchQuery, logUserAction, availableRoles, roleAccessLoaded,
  } = useApp();
  const [adaptiveDish, setAdaptiveDish] = useState<DishItem | null>(null);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [preferenceSummary, setPreferenceSummary] = useState("");
  const [recommendationReason, setRecommendationReason] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [catalog, setCatalog] = useState<DishItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const recommendationRequest = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifiedPersonaId = account?.main_persona_id || null;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !roleAccessLoaded) return;
    const currentRole = availableRoles.includes(activeRole) ? activeRole : "CONSUMER";
    if (currentRole === "MERCHANT") router.replace("/merchant");
    if (currentRole === "SHOPEE_ADMIN") router.replace("/admin");
  }, [isLoaded, isSignedIn, roleAccessLoaded, availableRoles, activeRole, router]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const fetchAiRecommendation = useCallback(async () => {
    const requestId = ++recommendationRequest.current;
    setIsLoadingAi(true);
    setAdaptiveDish(null);
    setCandidateIds([]);
    setPreferenceSummary("");
    setRecommendationReason("");
    setRecommendationError("");
    if (!account?.onboarding_complete) {
      setRecommendationError(isSignedIn ? "Complete your profile for meal suggestions." : "Sign in for meal suggestions.");
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
      setRecommendationReason(data.reason);
      if (!data.dish) setRecommendationError(data.reason);
    } catch (err) {
      if (requestId === recommendationRequest.current)
        setRecommendationError(err instanceof Error ? err.message : "Recommendations are not available yet.");
    } finally {
      if (requestId === recommendationRequest.current) setIsLoadingAi(false);
    }
  }, [getToken, account, isSignedIn]);

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
    const invalidate = () => { recommendationRequest.current++; };
    const refresh = () => { void Promise.resolve().then(() => { if (!cancelled) void fetchAiRecommendation(); }); };
    refresh();
    window.addEventListener("nutrisea:preferences-updated", refresh);
    return () => { cancelled = true; invalidate(); window.removeEventListener("nutrisea:preferences-updated", refresh); };
  }, [fetchAiRecommendation, verifiedPersonaId]);

  const recommendedDishes = useMemo(() => candidateIds.map(id => catalog.find(d => d.id === id)).filter((d): d is DishItem => !!d).slice(0, 10), [catalog, candidateIds]);
  const filteredCatalog = useMemo(() => catalog.filter(item => {
    const query = searchQuery.trim().toLocaleLowerCase("en");
    if (query && !`${item.name} ${item.merchantName}`.toLocaleLowerCase("en").includes(query)) return false;
    if (activeCategory === "persona") return (item.personas || item.matchedPersonas || []).includes(verifiedPersonaId || "");
    if (activeCategory === "hemat") return item.discountedPrice <= 20000;
    if (activeCategory === "protein") return typeof item.macros.proteinG === "number" && item.macros.proteinG >= 25;
    if (activeCategory === "rendah-kalori") return typeof item.macros.kcal === "number" && item.macros.kcal >= 0 && item.macros.kcal < 350;
    if (activeCategory === "bebas-santan") return item.healthyTags.some(t => t.toLowerCase().includes("bebas santan") || t.toLowerCase().includes("tanpa santan"));
    if (activeCategory === "lambung") return item.category === "lambung" || item.category === "rendah-kalori";
    return true;
  }), [catalog, activeCategory, verifiedPersonaId, searchQuery]);

  const addDish = (dish: DishItem) => {
    if (dish.isAvailable === false) return;
    addToCart(dish);
    setToastMessage(`${dish.name} added to your cart.`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2500);
  };
  const recordSelection = (dish: DishItem) => {
    void logUserAction("CLICK_MENU_ITEM", {
      item_id: dish.id, item_name: dish.name, merchant_name: dish.merchantName, price: dish.discountedPrice,
      personas: dish.personas || dish.matchedPersonas || [], category: dish.category, macros: dish.macros,
    });
  };
  const retryCatalog = () => { setCatalogError(""); setIsLoadingCatalog(true); setCatalogAttempt(attempt => attempt + 1); };
  const profileHref = !isSignedIn ? "/sign-in" : account?.onboarding_complete ? "/onboarding/personas?change=true" : "/onboarding";

  return (
    <div className={styles.commerce}>
      {toastMessage && <p className="app-toast" role="status">{toastMessage}</p>}
      <header className={styles.pageHeading}><h1>Find your next meal</h1><Link href={profileHref}>{isSignedIn ? "Food preferences" : "Sign in"}</Link></header>

      {account?.onboarding_complete ? (
        <section className={styles.contextStrip} aria-label="Meal suggestions">
          <div className={styles.contextLine}>
            <p>{isLoadingAi ? "Finding a meal for you..." : adaptiveDish ? <>Suggested for you: <Link href={`/menu/${adaptiveDish.id}`} onClick={() => recordSelection(adaptiveDish)}>{adaptiveDish.name}</Link></> : recommendationError || "Suggestions are not available yet."}</p>
            <button type="button" className={styles.textButton} disabled={isLoadingAi} onClick={() => void fetchAiRecommendation()} aria-label="Refresh recommendations"><RefreshCw size={16} aria-hidden="true" /><span>Refresh</span></button>
          </div>
          {adaptiveDish && <details className={styles.suggestionDetails}><summary>Why this meal?</summary><div><p>{recommendationReason}</p><p>{preferenceSummary}</p><p>Suggestions use your saved preferences. Confirm ingredients and allergies with the seller.</p><button type="button" className={styles.secondaryButton} disabled={adaptiveDish.isAvailable === false} onClick={() => addDish(adaptiveDish)}>Add this meal</button>{recommendedDishes.length > 1 && <><h2>More suggestions</h2><ul>{recommendedDishes.map(dish => <li key={dish.id}><Link href={`/menu/${dish.id}`} onClick={() => recordSelection(dish)}>{dish.name}</Link></li>)}</ul></>}</div></details>}
        </section>
      ) : <p className={styles.guestContext}><Link href={profileHref}>{isSignedIn ? "Complete your preferences" : "Sign in"}</Link> for meal suggestions. You can browse and add meals now.</p>}

      {snackLogged && <div className={styles.demoNotice}><p>Demo filter active. No meal was logged or nutrition target changed.</p><button type="button" className={styles.textButton} onClick={clearSnack}>Dismiss</button></div>}

      <section id="all-dishes-catalog" className={styles.catalog} aria-labelledby="catalog-heading" aria-busy={isLoadingCatalog}>
        <div className={styles.catalogHeading}><h2 id="catalog-heading">{activeCategory === "persona" ? "Meals for your profile" : "Explore meals"}</h2>{!isLoadingCatalog && !catalogError && <span>{filteredCatalog.length} meals</span>}</div>
        <div className={styles.filters} role="group" aria-label="Filter meals">
          {[
            { key: "semua", label: "All meals", title: "Show all catalog meals" },
            ...(verifiedPersonaId ? [{ key: "persona", label: "For your goals", title: "Matches your selected persona template" }] : []),
            { key: "hemat", label: "Budget meals", title: "Priced at Rp20,000 or less" },
            { key: "protein", label: "High protein", title: "At least 25 g of protein according to the catalog" },
            { key: "rendah-kalori", label: "Lower calorie", title: "Under 350 kcal according to the catalog" },
            { key: "bebas-santan", label: "No coconut milk label", title: "Tagged without coconut milk in the catalog; confirm with the seller" },
            { key: "lambung", label: "Stomach-related category", title: "Catalog stomach-related and lower-calorie categories, not a medical recommendation" },
          ].map(category => <button key={category.key} type="button" className={styles.filterButton} title={category.title} aria-pressed={activeCategory === category.key} onClick={() => setActiveCategory(category.key)}>{category.label}</button>)}
        </div>
        {searchQuery && <p className={styles.searchSummary}>Results for <strong>{searchQuery}</strong><button type="button" className={styles.textButton} onClick={() => setSearchQuery("")}>Clear search</button></p>}
        {isLoadingCatalog ? <><p role="status" className={styles.loadingText}>Loading meals and nutrition information...</p><div className={styles.foodGrid} aria-hidden="true">{[0, 1, 2, 3].map(index => <div key={index} className={styles.placeholderCard}><div className={styles.placeholderPhoto} /><div className={styles.placeholderLines}><span /><span /><span /></div></div>)}</div></>
          : catalogError ? <div className={styles.state} role="alert"><h3>Meals could not be loaded</h3><p>{catalogError}</p><button type="button" className={styles.primaryButton} onClick={retryCatalog}>Try again</button></div>
          : filteredCatalog.length === 0 ? <div className={styles.state} role="status"><h3>{catalog.length ? "No matching meals" : "No meals available yet"}</h3><p>{catalog.length ? "Try another search or clear your filters." : "The catalog is empty. You can try loading it again later."}</p><button type="button" className={styles.secondaryButton} onClick={() => { if (catalog.length) { setActiveCategory("semua"); setSearchQuery(""); } else retryCatalog(); }}>{catalog.length ? "Clear search and filters" : "Reload catalog"}</button></div>
          : <div className={styles.foodGrid}>{filteredCatalog.map(dish => <FoodCard key={dish.id} dish={dish} onSelect={recordSelection} onAdd={addDish} />)}</div>}
        <p className={styles.catalogNote}>Nutrition and filters use catalog information. Open a meal for sources and details; confirm portions and allergens with the seller.</p>
      </section>
    </div>
  );
}
