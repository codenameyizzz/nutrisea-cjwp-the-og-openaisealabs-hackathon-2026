"use client";

import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import FoodImage from "@/components/FoodImage";
import NutriGraphVisualizer from "@/components/NutriGraphVisualizer";
import type { DishItem } from "@/data/menu";
import { API_BASE_URL, responseJson } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAccountSession } from "@/context/AccountSessionContext";
import { catalogLabelEnglish } from "@/services/catalog-labels";
import styles from "../../commerce.module.css";

function displayNutrient(value: unknown, unit: string) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? `${value.toLocaleString("en-US")} ${unit}` : "Not available";
}

interface GraphExplanation {
  is_safe: boolean;
  severity: string;
  clinical_citations?: string[];
  path_evidence?: string[][];
}

function MenuDetailContent() {
  const { account } = useAccountSession();
  const params = useParams();
  const router = useRouter();
  const { addToCart, bmiStats, activeUserId, logUserAction } = useApp();
  const { getToken } = useAuth();
  const id = typeof params?.id === "string" ? params.id : "";
  const [dish, setDish] = useState<DishItem | null>(null);
  const [isLoadingDish, setIsLoadingDish] = useState(true);
  const [dishError, setDishError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const cartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logAction = useRef(logUserAction);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState("Response source not provided");
  const [graphVerification, setGraphVerification] = useState<GraphExplanation | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);

  useEffect(() => { logAction.current = logUserAction; }, [logUserAction]);
  useEffect(() => {
    if (!dish) return;
    void logAction.current("VIEW_DETAILS", {
      item_id: dish.id, item_name: dish.name, merchant_name: dish.merchantName, price: dish.discountedPrice,
      personas: dish.personas || dish.matchedPersonas || [], category: dish.category, macros: dish.macros,
    });
  }, [dish]);
  useEffect(() => () => { if (cartTimer.current) clearTimeout(cartTimer.current); }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 15000);
    const load = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsLoadingDish(true);
      setDishError("");
      setQuantity(1);
      setAiAnswer(null);
      setAiError(null);
      try {
        if (!id) { setDish(null); return; }
        const response = await fetch(`${API_BASE_URL}/api/dishes/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 404) { if (!cancelled) setDish(null); return; }
        const result = await responseJson<{ data: DishItem }>(response);
        if (!result?.data || typeof result.data.id !== "string") throw new Error("Invalid menu response");
        if (!cancelled) setDish(result.data);
      } catch {
        if (!cancelled) { setDish(null); setDishError("This meal could not be loaded. Check your connection and try again."); }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setIsLoadingDish(false);
      }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [id, loadAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const effectivePersona = account?.main_persona_id;
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setGraphVerification(null);
      if (!dish || !effectivePersona) { setIsLoadingGraph(false); return; }
      setIsLoadingGraph(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/graph/explain/${encodeURIComponent(effectivePersona)}/${encodeURIComponent(dish.id)}`, { signal: controller.signal });
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

  const retry = () => { setIsLoadingDish(true); setDishError(""); setLoadAttempt(attempt => attempt + 1); };
  if (isLoadingDish) return <div className={styles.commerce}><div className={styles.state} role="status"><h1>Loading meal...</h1><p>Getting the latest catalog details.</p></div></div>;
  if (!dish) return <div className={styles.commerce}><div className={styles.state} role={dishError ? "alert" : "status"}><h1>{dishError ? "Meal could not be loaded" : "Meal not found"}</h1><p>{dishError || "This item may no longer be in the catalog."}</p>{dishError && <button type="button" className={styles.primaryButton} onClick={retry}>Try again</button>}<Link href="/" className={styles.backLink}>Back to meals</Link></div></div>;

  const handleConsultAi = async (question: string) => {
    setIsLoadingAi(true);
    setAiAnswer(null);
    setAiError(null);
    try {
      const token = await getToken();
      if (!token) { setAiError("Sign in to ask a question about this meal."); return; }
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: question, user_id: activeUserId,
          dish_context: `${dish.name} at ${dish.merchantName} (${displayNutrient(dish.macros.kcal, "kcal")}, ${displayNutrient(dish.macros.proteinG, "g")} protein)`,
          user_bmi_stats: bmiStats,
        }),
      });
      if (!response.ok) throw new Error("Chat API error");
      const data = await response.json();
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Empty reply");
      setAiAnswer(data.reply);
      setAiSource(data.model === "dynamic-context-synthesis" ? "Fallback response based on app rules" : data.model ? "AI model response" : "Response source not provided");
    } catch {
      setAiError("An answer is not available because the service did not respond. Try again; your meal choices remain on this page.");
    } finally {
      setIsLoadingAi(false);
    }
  };
  const handleAdd = () => {
    if (dish.isAvailable === false || isAdding) return;
    setIsAdding(true);
    addToCart(dish, quantity);
    setToastMessage(`Added ${quantity} × ${dish.name} to your cart.`);
    cartTimer.current = setTimeout(() => { setToastMessage(null); router.push("/cart"); }, 800);
  };

  return (
    <div className={styles.commerce}>
      {toastMessage && <p className="app-toast" role="status">{toastMessage}</p>}
      <Link href="/" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" />Back to meals</Link>
      <section className={styles.itemLayout} aria-labelledby="meal-title">
        <FoodImage src={dish.imageUrl} alt={dish.name} className={styles.itemPhoto} loading="eager" fetchPriority="high" width={640} height={480} />
        <div className={styles.itemInfo}>
          <p className={styles.merchant}>{dish.merchantName}</p>
          <h1 id="meal-title">{dish.name}</h1>
          <p className={styles.itemPrice}>Rp {dish.discountedPrice.toLocaleString("en-US")}</p>
          <p className={styles.availability}>{dish.isAvailable === false ? "Currently unavailable" : dish.isAvailable === true ? "Available in the catalog" : "Availability is not provided by the seller."}</p>
          <div className={styles.orderControls}>
            <div className={styles.quantity} role="group" aria-label="Meal quantity">
              <button type="button" disabled={quantity <= 1 || isAdding} aria-label="Decrease quantity" onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={17} aria-hidden="true" /></button>
              <output aria-live="polite" aria-label="Quantity">{quantity}</output>
              <button type="button" disabled={isAdding} aria-label="Increase quantity" onClick={() => setQuantity(value => value + 1)}><Plus size={17} aria-hidden="true" /></button>
            </div>
            <button type="button" className={styles.primaryButton} disabled={dish.isAvailable === false || isAdding} onClick={handleAdd}>{dish.isAvailable === false ? "Unavailable" : isAdding ? "Added to cart" : `Add to cart · Rp ${(dish.discountedPrice * quantity).toLocaleString("en-US")}`}</button>
          </div>
          <p className={styles.orderNote}>Confirm ingredients, allergens, and portions with the seller. Preparation changes cannot be requested here.</p>
        </div>
      </section>

      <section className={styles.disclosures} aria-label="More about this meal">
        <details className={styles.disclosure}>
          <summary>Nutrition and source</summary>
          <div className={styles.disclosureBody}>
            <p><strong>{dish.nutritionSource === "TKPI" ? "TKPI reference (catalog label; not a measurement of the restaurant serving)" : dish.nutritionSource === "ESTIMATE" ? "Catalog estimate" : "Nutrition source not available"}.</strong> Serving weights and measurement methods are not provided. Your ordered portion may differ.</p>
            <dl className={styles.nutritionGrid}>
              {[["Energy", dish.macros.kcal, "kcal"], ["Protein", dish.macros.proteinG, "g"], ["Carbohydrates", dish.macros.carbsG, "g"], ["Fat", dish.macros.fatG, "g"], ["Sodium", dish.macros.sodiumMg, "mg"]].map(([name, value, unit]) => <div key={String(name)}><dt>{name}</dt><dd>{displayNutrient(value, String(unit))}</dd></div>)}
            </dl>
            <p>Missing values are shown as unavailable. A recorded zero is kept as zero.</p>
          </div>
        </details>
        <details className={styles.disclosure}>
          <summary>Ingredients and preparation</summary>
          <div className={styles.disclosureBody}>
            <p><strong>Listed allergens:</strong> {dish.allergens?.length ? dish.allergens.join(", ") : "Not provided. This does not mean allergen-free."}</p>
            <p><strong>Catalog preparation notes:</strong> {dish.cookingNotes || "Not provided."}</p>
            {(dish.healthyTags || []).length > 0 && <><p>Catalog labels, not independent certification:</p><div className={styles.labels}>{dish.healthyTags.map((tag, index) => <span key={`${tag}-${index}`}>{catalogLabelEnglish(tag)}</span>)}</div></>}
          </div>
        </details>
        <details className={styles.disclosure}>
          <summary>Recommendation context</summary>
          <div className={styles.disclosureBody}>
            <p>NutriGraph uses a recommendation template. Its rules are not a diagnosis or a food safety guarantee.</p>
            {isLoadingGraph ? <p role="status">Loading recommendation context...</p> : !graphVerification ? <p>Recommendation context is not available for this meal.</p> : <>
              <p>{graphVerification.is_safe === false ? "The application reported a rule conflict for this template. Review the meal information and your preferences." : graphVerification.severity === "SAFE" ? "The application reported no rule conflicts for this template. Ingredient and portion data may still be incomplete." : "The available template data is incomplete."}</p>
              {!!graphVerification.path_evidence?.length && <ul className={styles.rulePaths}>{graphVerification.path_evidence.slice(0, 3).map((path, index) => <li key={index}>{path.map(hop => hop.replace(/^(PERSONA|COND|ING|METHOD|ALLERGEN|DISH):/, "")).join(" → ")}</li>)}</ul>}
              <p><strong>Sources listed in the configuration:</strong> {graphVerification.clinical_citations?.join(", ") || "Not provided"}. Their presence does not validate the application rules.</p>
              {account?.main_persona_id && <button type="button" className={styles.secondaryButton} onClick={() => setIsGraphModalOpen(true)}>View recommendation graph</button>}
            </>}
          </div>
        </details>
        <details className={styles.disclosure}>
          <summary>Ask about this meal</summary>
          <div className={styles.disclosureBody}>
            <p>AI can help you prepare questions. Confirm any requested changes directly with the seller.</p>
            <div className={styles.questionActions}>
              <button type="button" className={styles.secondaryButton} disabled={isLoadingAi} onClick={() => void handleConsultAi("What should I ask the seller about this dish's ingredients and preparation?")}>What should I ask the seller?</button>
              <button type="button" className={styles.secondaryButton} disabled={isLoadingAi} onClick={() => void handleConsultAi("How could the preparation be adjusted to use less oil and sodium?")}>Questions about oil and sodium</button>
            </div>
            {isLoadingAi && <p role="status">Preparing an answer...</p>}
            {aiError && <p role="alert" className={styles.error}>{aiError}</p>}
            {aiAnswer && <div className={styles.answer}><p>{aiSource}</p>{aiAnswer}</div>}
          </div>
        </details>
      </section>
      {isGraphModalOpen && account?.main_persona_id && <NutriGraphVisualizer personaId={account.main_persona_id} focusDishId={dish.id} focusDishName={dish.name} isOpen={isGraphModalOpen} onClose={() => setIsGraphModalOpen(false)} />}
    </div>
  );
}

export default function MenuDetailPage() {
  return <Suspense fallback={<p role="status">Loading meal details...</p>}><MenuDetailContent /></Suspense>;
}
