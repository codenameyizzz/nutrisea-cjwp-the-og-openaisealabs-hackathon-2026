"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import IngredientAutocomplete from "@/components/ingredients/IngredientAutocomplete";
import IngredientGuard from "@/components/ingredients/IngredientGuard";
import { useIngredientApi } from "@/services/ingredient-api";
import { EMPTY_RECIPE_VERSION, recipePayload } from "@/services/ingredient-types";
import type { MenuRecipe } from "@/services/ingredient-types";
import { responseJson } from "@/lib/api";
import {
  Store,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Check,
  Plus,
  RefreshCw,
  Utensils,
  Edit2,
  Trash2,
  X,
  Building2
} from "lucide-react";

interface OutletItem {
  id: string;
  name: string;
  brand_name: string;
  cuisine_type: string;
  area: string;
  address?: string;
  distance_km: number;
  delivery_radius_km: number;
  rating: number;
  rating_count: number;
  is_verified_hygiene: boolean;
  is_open: boolean;
  dish_count: number;
}

interface DishItem {
  id: string;
  merchant_id?: string;
  restaurant_id?: string | null;
  name: string;
  category: string;
  price: number;
  description?: string;
  imageUrl?: string;
  tags: string[];
  macros: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sodium_mg: number;
  };
  cookingNotes?: string;
}

export default function MerchantPage() {
  return <IngredientGuard mode="merchant"><MerchantContent /></IngredientGuard>;
}

function MerchantContent() {
  const ingredientApi = useIngredientApi();
  const { authenticatedFetch } = ingredientApi;
  const [recipe, setRecipe] = useState<MenuRecipe | null>(null);
  const [recipeError, setRecipeError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [merchantOptions, setMerchantOptions] = useState<{ id: string; name: string }[]>([]);
  const [formMerchantId, setFormMerchantId] = useState("");
  const { merchantDemoTrigger, setMerchantDemoTrigger, setActiveRole } = useApp();
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [merchantPartner, setMerchantPartner] = useState<{ name: string; seabank_account_no?: string } | null>(null);
  const [outletError, setOutletError] = useState("");
  const [menuError, setMenuError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [togglingOutletId, setTogglingOutletId] = useState<string | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen) return;
    const controller = new AbortController();
    const request = editingDishId ? ingredientApi.recipe(editingDishId, controller.signal)
      : Promise.resolve({ items: [], version: EMPTY_RECIPE_VERSION });
    request.then(value => { if (!controller.signal.aborted) { setRecipe(value); setRecipeError(""); } })
      .catch(err => { if (!controller.signal.aborted) setRecipeError(err instanceof Error ? err.message : "Could not load the meal ingredients."); });
    return () => controller.abort();
  }, [editingDishId, isModalOpen, ingredientApi]);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("protein");
  const [formPrice, setFormPrice] = useState<number>(25000);
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80");
  const [formKcal, setFormKcal] = useState<number | "">("");
  const [formProtein, setFormProtein] = useState<number | "">("");
  const [formCarbs, setFormCarbs] = useState<number | "">("");
  const [formFat, setFormFat] = useState<number | "">("");
  const [formSodium, setFormSodium] = useState<number | "">("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formCookingNotes, setFormCookingNotes] = useState("");

  const [descriptionPreview, setDescriptionPreview] = useState<{ context: string; description: string; source?: string } | null>(null);
  const [descriptionPendingContext, setDescriptionPendingContext] = useState<string | null>(null);
  const descriptionRequest = useRef<AbortController | null>(null);
  const descriptionContext = JSON.stringify([isModalOpen, editingDishId, formName, formCategory, recipe?.items, formCookingNotes]);
  const isGeneratingDescription = descriptionPendingContext === descriptionContext;
  const currentDescriptionPreview = descriptionPreview?.context === descriptionContext ? descriptionPreview : null;

  useEffect(() => () => { descriptionRequest.current?.abort(); }, [descriptionContext]);

  function clearDescriptionPreview() {
    descriptionRequest.current?.abort();
    descriptionRequest.current = null;
    setDescriptionPreview(null);
    setDescriptionPendingContext(null);
  }

  // AI Estimation state
  const [isEstimatingAi, setIsEstimatingAi] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerateDescription = async () => {
    if (!formName.trim() || isGeneratingDescription || !recipe || saveBusy) return;
    descriptionRequest.current?.abort();
    const controller = new AbortController();
    descriptionRequest.current = controller;
    setDescriptionPendingContext(descriptionContext);
    setDescriptionPreview(null);
    try {
      const response = await authenticatedFetch("/api/merchant/generate-description", {
        method: "POST", signal: controller.signal,
        body: JSON.stringify({
          dish_name: formName, category: formCategory,
          ingredients: recipe.items.map(item => `${item.quantity} ${item.unit} ${item.name}`),
          cooking_notes: formCookingNotes,
        }),
      });
      const data = await responseJson<{ description: string; source?: string }>(response);
      if (controller.signal.aborted || descriptionRequest.current !== controller) return;
      if (typeof data.description !== "string" || !data.description.trim()) throw new Error("The generated description was empty. Your current description has been kept.");
      setDescriptionPreview({ context: descriptionContext, description: data.description.slice(0, 500), source: data.source });
    } catch (error) {
      if (!controller.signal.aborted && descriptionRequest.current === controller) {
        showToast(error instanceof Error ? error.message : "Description generation failed. Your current description has been kept.");
      }
    } finally {
      if (descriptionRequest.current === controller) setDescriptionPendingContext(null);
    }
  };


  const fetchOutlets = async () => {
    try {
      const json = await responseJson<{ outlets: OutletItem[]; merchant: { name: string; seabank_account_no?: string } | null }>(await authenticatedFetch("/api/merchant/outlets"));
      setOutlets(json.outlets || []);
      setMerchantPartner(json.merchant);
      setOutletError("");
    } catch (e) {
      setOutletError(e instanceof Error ? e.message : "Outlets could not be loaded. Try again.");
    }
  };

  const handleToggleOutletStatus = async (outletId: string) => {
    setTogglingOutletId(outletId);
    try {
      const res = await authenticatedFetch(`/api/merchant/outlets/${outletId}/toggle-status`, {
        method: "POST"
      });
      if (res.ok) {
        const json = await res.json();
        setOutlets(prev => prev.map(o => o.id === outletId ? { ...o, is_open: json.is_open } : o));
        showToast(json.is_open ? "Outlet is now open." : "Outlet is now closed.");
      } else { await responseJson(res); }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update outlet status.");
    } finally {
      setTogglingOutletId(null);
    }
  };

  const fetchDishes = async () => {
    setIsLoadingDishes(true);
    try {
      const json = await responseJson<{ data: DishItem[]; merchants: { id: string; name: string }[] }>(await authenticatedFetch("/api/merchant/dishes"));
      setDishes(json.data || []);
      setMerchantOptions(json.merchants || []);
      setMenuError("");
    } catch (e) {
      setMenuError(e instanceof Error ? e.message : "Could not load the menu. Try again.");
    } finally {
      setIsLoadingDishes(false);
    }
  };

  useEffect(() => {
    setActiveRole("MERCHANT");
    fetchOutlets();
    fetchDishes();
  }, []);

  // Open Modal for Create
  const handleOpenCreateModal = () => {
    clearDescriptionPreview();
    setEditingDishId(null);
    setRecipe(null); setRecipeError(""); setFormMerchantId(merchantOptions.length === 1 ? merchantOptions[0].id : "");
    setFormName("");
    setFormCategory("protein");
    setFormPrice(25000);
    setFormDescription("");
    setFormImageUrl("https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80");
    setFormKcal("");
    setFormProtein("");
    setFormCarbs("");
    setFormFat("");
    setFormSodium("");
    setFormTags([]);
    setFormCookingNotes("");
    setAiRationale(null);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (dish: DishItem) => {
    clearDescriptionPreview();
    setEditingDishId(dish.id);
    setRecipe(null); setRecipeError(""); setFormMerchantId(dish.merchant_id || "");
    setFormName(dish.name);
    setFormCategory(dish.category || "protein");
    setFormPrice(dish.price);
    setFormDescription(dish.description || "");
    setFormImageUrl(dish.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80");
    setFormKcal(dish.macros?.kcal ?? "");
    setFormProtein(dish.macros?.protein_g ?? "");
    setFormCarbs(dish.macros?.carbs_g ?? "");
    setFormFat(dish.macros?.fat_g ?? "");
    setFormSodium(dish.macros?.sodium_mg ?? "");
    setFormTags(dish.tags || []);
    setFormCookingNotes(dish.cookingNotes || "Review preparation notes before saving");
    setAiRationale(null);
    setIsModalOpen(true);
  };

  // AI Automatic Nutrition Estimator
  const handleEstimateWithAi = async (customName?: string | unknown, customDesc?: string, customCat?: string) => {
    const targetName = typeof customName === "string" ? customName : formName;
    const targetDesc = typeof customDesc === "string" ? customDesc : formDescription;
    const targetCat = typeof customCat === "string" ? customCat : formCategory;

    if (!targetName.trim()) {
      showToast("Enter a food name first.");
      return;
    }

    setIsEstimatingAi(true);
    setAiRationale(null);

    try {
      const res = await authenticatedFetch("/api/merchant/estimate-nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish_name: targetName,
          description: targetDesc,
          category: targetCat
        })
      });

      if (res.ok) {
        const data = await res.json();
        setFormKcal(data.estimated_macros.kcal);
        setFormProtein(data.estimated_macros.protein_g);
        setFormCarbs(data.estimated_macros.carbs_g);
        setFormFat(data.estimated_macros.fat_g);
        setFormSodium(data.estimated_macros.sodium_mg);
        setFormTags(data.healthy_tags);
        setFormCookingNotes(data.cooking_notes);
        setAiRationale(data.rationale);
        showToast("AI nutrition estimates received. Review the values before saving.");
      } else {
        throw new Error("AI estimation endpoint returned error");
      }
    } catch (e) {
      console.warn("AI estimation error fallback:", e);
      setAiRationale("AI estimation failed. Your existing values have been kept; enter or verify nutrition information before saving.");
      showToast("AI estimation failed. No nutrition values were changed.");
    } finally {
      setIsEstimatingAi(false);
    }
  };

  // Listen to 1-click Demo Trigger from DemoBar
  useEffect(() => {
    if (merchantDemoTrigger) {
      clearDescriptionPreview();
      setMerchantDemoTrigger(false);
      setEditingDishId(null);
    setRecipe(null); setRecipeError(""); setFormMerchantId(merchantOptions.length === 1 ? merchantOptions[0].id : "");
      const demoName = "Ikan Nila Bakar Sambal Dabu-dabu";
      const demoCat = "protein";
      const demoPrice = 28000;
      const demoDesc = "One fresh tilapia grilled with turmeric spices and broth, served with basil and fresh tomato sambal dabu-dabu, without reused cooking oil.";
      const demoImg = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80";

      setFormName(demoName);
      setFormCategory(demoCat);
      setFormPrice(demoPrice);
      setFormDescription(demoDesc);
      setFormImageUrl(demoImg);
      setAiRationale(null);
      setIsModalOpen(true);

      setFormKcal(""); setFormProtein(""); setFormCarbs(""); setFormFat(""); setFormSodium("");
      setFormTags([]); setFormCookingNotes("");
      setAiRationale("Example draft only. Nothing has been saved. Review the meal details, then enter nutrition information or explicitly request an AI estimate.");
    }
  }, [merchantDemoTrigger]);

  // Save menu, tags and ingredient selections in one backend transaction.
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveBusy) return;
    if ([formKcal, formProtein, formCarbs, formFat, formSodium].some(value => value === "" || !Number.isFinite(value) || value < 0)) {
      showToast("Enter valid nutrition values before saving. Missing values cannot be saved as zero."); return;
    }
    if (!recipe) { showToast("Ingredients have not loaded. Close and reopen the form to try again."); return; }
    setSaveBusy(true);
    try {
      const payload = {
        name: formName, category: formCategory, price: formPrice,
        merchant_id: formMerchantId || undefined,
        description: formDescription, imageUrl: formImageUrl, tags: formTags,
        macros: { kcal: Number(formKcal), protein_g: Number(formProtein), carbs_g: Number(formCarbs), fat_g: Number(formFat), sodium_mg: Number(formSodium) },
        cookingNotes: formCookingNotes, ingredients: recipePayload(recipe.items, recipe.version)
      };
      const response = await authenticatedFetch(editingDishId ? `/api/merchant/dishes/${encodeURIComponent(editingDishId)}` : "/api/merchant/dishes", {
        method: editingDishId ? "PUT" : "POST", body: JSON.stringify(payload)
      });
      const json = await responseJson<{ dish: DishItem }>(response);
      setDishes(prev => editingDishId ? prev.map(d => d.id === editingDishId ? json.dish : d) : [json.dish, ...prev]);
      showToast("Meal and ingredient composition saved.");
      clearDescriptionPreview();
      setIsModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed. Your changes have not been saved.");
    } finally { setSaveBusy(false); }
  };

  // Deactivation preserves ingredient and order history.
  const handleDeleteDish = async (dishId: string) => {
    try {
      await responseJson(await authenticatedFetch(`/api/merchant/dishes/${encodeURIComponent(dishId)}`, { method: "DELETE" }));
      setDishes(prev => prev.filter(d => d.id !== dishId));
      showToast("Meal deactivated in the catalog.");
      setDeleteConfirmId(null);
    } catch (err) { showToast(err instanceof Error ? err.message : "Could not deactivate the meal."); }
  };

  // Toggle Tag in quick list
  const toggleTag = async (dishId: string, tag: string) => {
    const target = dishes.find(d => d.id === dishId);
    if (!target) return;

    const newTags = target.tags.includes(tag)
      ? target.tags.filter(t => t !== tag)
      : [...target.tags, tag];

    const updated = { ...target, tags: newTags };
    try {
      const json = await responseJson<{ dish: DishItem }>(await authenticatedFetch(`/api/merchant/dishes/${encodeURIComponent(dishId)}`, {
        method: "PUT", body: JSON.stringify(updated)
      }));
      setDishes(prev => prev.map(d => d.id === dishId ? json.dish : d));
      showToast("Meal tags updated.");
    } catch (err) { showToast(err instanceof Error ? err.message : "Could not update meal tags."); }
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && <div role="status" className="app-toast">{toast}</div>}

      {/* Back to Consumer App */}
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "12.5px",
            color: "#666",
            textDecoration: "none"
          }}
        >
          <ArrowLeft size={14} /> Back to the customer app
        </Link>
      </div>

      {/* Merchant Header Card */}
      <div className="merchant-header-card">
        <div className="merchant-header-info">
          <div className="merchant-header-avatar">
            <Store size={26} color="#EE4D2D" />
          </div>

          <div>
            <div className="merchant-header-title-row">
              <h1 className="merchant-header-name">
                {merchantPartner?.name || "Merchant workspace"}
              </h1>
              <span className="merchant-header-badge">
                <Store size={13} /> Menu and outlets
              </span>
            </div>

            <div className="merchant-header-sub">
              <a href="#merchant-outlets">Manage outlets</a>
              <span aria-hidden="true">&bull;</span>
              <a href="#merchant-meals">Manage meals</a>
              <span aria-hidden="true">&bull;</span>
              <Link href="/merchant/register">Application status</Link>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Add New Dish */}
        <button
          onClick={handleOpenCreateModal}
          className="btn-shopee-primary merchant-add-btn"
        >
          <Plus size={15} /> Add meal
        </button>
      </div>

      {outletError && <p role="alert">{outletError} <button onClick={() => void fetchOutlets()}>Retry outlets</button></p>}
      {/* Managed Restaurant Outlets & Brands */}
      <div id="merchant-outlets" style={{
        backgroundColor: "#FFFFFF",
        borderRadius: "10px",
        padding: "16px 20px",
        marginBottom: "16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        border: "1px solid #E2E8F0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Building2 size={18} color="#EE4D2D" />
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                Managed outlets and restaurant brands ({outlets.length} outlets)
              </h3>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748B" }}>
              Outlets and restaurant brands managed by {merchantPartner?.name || "your business"}.
            </p>
          </div>
          <span style={{ fontSize: "11px", color: "#10B981", fontWeight: 700, backgroundColor: "#ECFDF5", padding: "4px 8px", borderRadius: "6px" }}>
            SeaBank account: {merchantPartner?.seabank_account_no || "Not provided"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "12px" }}>
          {outlets.map((outlet) => (
            <div
              key={outlet.id}
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "12px 14px",
                backgroundColor: outlet.is_open ? "#FAFAFA" : "#FFF1F2"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>{outlet.name}</div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>
                    Brand: <strong>{outlet.brand_name}</strong> &bull; {outlet.cuisine_type}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                    📍 {outlet.area} &bull; Radius {outlet.delivery_radius_km} km &bull; {outlet.dish_count} meals
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleOutletStatus(outlet.id)}
                  disabled={togglingOutletId === outlet.id}
                  style={{
                    backgroundColor: outlet.is_open ? "#DCFCE7" : "#FEE2E2",
                    color: outlet.is_open ? "#166534" : "#991B1B",
                    border: "none",
                    borderRadius: "20px",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {togglingOutletId === outlet.id ? "..." : (outlet.is_open ? "🟢 OPEN" : "🔴 CLOSED")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Section: Dish Management Table / Grid (CRUD) */}
      <div id="merchant-meals" className="merchant-dishes-card">
        <div className="merchant-dishes-header">
          <div>
            <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#222" }}>
              Meal catalog and nutrition management
            </div>
            <div style={{ fontSize: "11px", color: "#777", marginTop: 2 }}>
              Active meals in the NutriSea catalog ({dishes.length} meals)
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="btn-shopee-primary"
            style={{ minHeight: 44, padding: "0 12px", fontSize: "11.5px", fontWeight: 600, flexShrink: 0 }}
          >
            <Plus size={13} /> Add meal
          </button>
        </div>

        {menuError && <p role="alert">{menuError} <button onClick={() => void fetchDishes()}>Retry menu</button></p>}
        {isLoadingDishes && <p role="status">Loading meals...</p>}
        {!isLoadingDishes && !menuError && !dishes.length && <p>No meals yet. Add your first meal to start building the catalog.</p>}
        {/* Dishes Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {dishes.map((dish) => (
            <div key={dish.id} className="merchant-dish-item">
              {/* Top Row: Name, Price, Actions */}
              <div className="merchant-dish-top">
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                  <img
                    src={dish.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80"}
                    alt={dish.name}
                    className="merchant-dish-img"
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="merchant-dish-name">
                      {dish.name}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#EE4D2D", fontWeight: 700, marginTop: 1 }}>
                      Rp {dish.price.toLocaleString("id-ID")}
                    </div>
                    {dish.cookingNotes && (
                      <div className="merchant-dish-cooking-note">
                        Instructions: {dish.cookingNotes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="merchant-dish-actions">
                  <button
                    onClick={() => handleOpenEditModal(dish)}
                    className="merchant-btn-edit"
                  >
                    <Edit2 size={12} color="#003B7A" /> Edit
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(dish.id)}
                    className="merchant-btn-delete"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Box */}
              {deleteConfirmId === dish.id && (
                <div
                  style={{
                    backgroundColor: "#FFF2E8",
                    border: "1px solid #FFBB96",
                    borderRadius: 6,
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#D4380D" }}>
                    Remove this meal from the catalog?
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleDeleteDish(dish.id)}
                      style={{ backgroundColor: "#D4380D", color: "#FFF", border: "none", borderRadius: 4, padding: "3px 8px", fontSize: "11px", cursor: "pointer" }}
                    >
                      Yes, remove
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      style={{ backgroundColor: "#FFF", border: "1px solid #CCC", borderRadius: 4, padding: "3px 8px", fontSize: "11px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Middle Row: 5 Macro Nutrients Badge */}
              <div className="merchant-dish-macros">
                <div>
                  <div className="merchant-dish-macro-val" style={{ color: "#EE4D2D" }}>
                    {dish.macros?.kcal ?? "?"} kcal
                  </div>
                  <div className="merchant-dish-macro-lbl">Calories</div>
                </div>

                <div>
                  <div className="merchant-dish-macro-val" style={{ color: "#00B14F" }}>
                    {dish.macros?.protein_g ?? "?"}g
                  </div>
                  <div className="merchant-dish-macro-lbl">Protein</div>
                </div>

                <div>
                  <div className="merchant-dish-macro-val" style={{ color: "#333" }}>
                    {dish.macros?.carbs_g ?? "?"}g
                  </div>
                  <div className="merchant-dish-macro-lbl">Carbs</div>
                </div>

                <div>
                  <div className="merchant-dish-macro-val" style={{ color: "#333" }}>
                    {dish.macros?.fat_g ?? "?"}g
                  </div>
                  <div className="merchant-dish-macro-lbl">Fat</div>
                </div>

                <div>
                  <div className="merchant-dish-macro-val" style={{ color: "#003B7A" }}>
                    {dish.macros?.sodium_mg ?? "?"}mg
                  </div>
                  <div className="merchant-dish-macro-lbl">Sodium</div>
                </div>
              </div>

              {/* Bottom Row: Healthy Tag Toggles */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "#666", marginRight: 4 }}>
                  Meal attributes:
                </span>
                {[
                  { tag: "MINYAK_BARU", label: "Fresh cooking oil" },
                  { tag: "TANPA_SANTAN", label: "No coconut milk" },
                  { tag: "TINGGI_PROTEIN", label: "High protein" },
                  { tag: "SAYUR_BENING", label: "Clear vegetable soup" },
                  { tag: "BEBAS_GORENGAN", label: "Not fried" }
                ].map((t) => {
                  const isTagged = (dish.tags || []).includes(t.tag);
                  return (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => toggleTag(dish.id, t.tag)}
                      style={{
                        backgroundColor: isTagged ? "#FFF5F1" : "#FFFFFF",
                        border: isTagged ? "1px solid #EE4D2D" : "1px solid #DCDCDC",
                        color: isTagged ? "#EE4D2D" : "#666",
                        fontSize: "11px",
                        fontWeight: isTagged ? 600 : 400,
                        padding: "2px 7px",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3
                      }}
                    >
                      {isTagged && <Check size={10} />}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================
          MODAL FORM: TAMBAH / EDIT MENU WARUNG DENGAN AI AUTO-GIZI
          ======================================================== */}
      {isModalOpen && (
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
            backdropFilter: "blur(4px)"
          }}
          onClick={() => { if (!saveBusy) { clearDescriptionPreview(); setIsModalOpen(false); } }}
        >
          <div className="merchant-modal-box" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: "#EE4D2D",
                color: "#FFFFFF",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Utensils size={17} />
                <div style={{ fontSize: "14.5px", fontWeight: 700 }}>
                  {editingDishId ? "Edit meal and nutrition" : "Add a meal to NutriSea"}
                </div>
              </div>
              <button
                onClick={() => { if (!saveBusy) { clearDescriptionPreview(); setIsModalOpen(false); } }}
                style={{ background: "transparent", border: "none", color: "#FFFFFF", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDish} className="merchant-modal-form">
              {!editingDishId && <label className="bmi-input-group">Meal owner
                <select value={formMerchantId} onChange={e => setFormMerchantId(e.target.value)} required disabled={saveBusy}>
                  <option value="">Choose a merchant</option>
                  {merchantOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>}
              {recipeError && <p role="alert">{recipeError}</p>}
              {!recipe && !recipeError && <p role="status">Loading ingredients...</p>}
              <IngredientAutocomplete value={recipe?.items || []} onChange={items => setRecipe(r => r ? { ...r, items } : r)}
                search={ingredientApi.search} disabled={saveBusy || !recipe} />
              {/* Dish Name */}
              <div className="bmi-input-group">
                <label className="bmi-input-label">Meal name *</label>
                <div className="bmi-input-control">
                  <input
                    type="text"
                    placeholder="Example: Ikan Nila Bakar Sambal Dabu-dabu"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Price & Category */}
              <div className="merchant-modal-row-2">
                <div className="bmi-input-group">
                  <label className="bmi-input-label">Price (Rp) *</label>
                  <div className="bmi-input-control">
                    <input
                      type="number"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                <div className="bmi-input-group">
                  <label className="bmi-input-label">Nutrition category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      height: 40,
                      borderRadius: 4,
                      border: "1px solid #DDD",
                      padding: "0 10px",
                      fontSize: "13px",
                      outline: "none",
                      backgroundColor: "#FFF"
                    }}
                  >
                    <option value="protein">High protein</option>
                    <option value="rendah-kalori">Lower calorie</option>
                    <option value="bebas-santan">No coconut milk</option>
                    <option value="hemat">Budget friendly</option>
                    <option value="lambung">Gentler meal preference</option>
                  </select>
                </div>
              </div>

              {/* Description & Ingredients */}
              <div className="bmi-input-group">
                <label className="bmi-input-label">Description and ingredients</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  aria-label="Description and ingredients"
                  placeholder="Example: One tilapia grilled with turmeric spices and broth, served with fresh tomato sambal dabu-dabu and a small amount of cooking oil."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  style={{
                    border: "1px solid #DDD",
                    borderRadius: 4,
                    padding: "8px 10px",
                    fontSize: "12.5px",
                    outline: "none",
                    resize: "none"
                  }}
                />
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDescription || !formName.trim() || !recipe || saveBusy}
                  style={{ minHeight: 44, marginTop: 8, background: isGeneratingDescription ? "#CCC" : "#EE4D2D", color: "#FFF", border: 0, borderRadius: 4, padding: "9px 12px", fontSize: 12.5, fontWeight: 600, cursor: isGeneratingDescription || !formName.trim() ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {isGeneratingDescription ? <RefreshCw size={14} className="spin-icon" /> : <Sparkles size={14} />}
                  {isGeneratingDescription ? "Generating a description..." : "Draft description with AI"}
                </button>
                {currentDescriptionPreview && <div role="region" aria-label="Generated description preview" style={{ padding: 12, border: "1px solid #DDD", borderRadius: 6, marginTop: 10 }}>
                  <p><strong>{currentDescriptionPreview.source === "input_template" ? "Template from your inputs (AI unavailable)" : currentDescriptionPreview.source === "ai_generated" ? "AI-generated draft" : "Generated draft"}</strong></p>
                  <p>{currentDescriptionPreview.description}</p>
                  <p style={{ fontSize: 12, color: "#555" }}>Review the wording and ingredients. Applying this draft replaces the description in this form; save the meal to publish it.</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <button type="button" disabled={saveBusy} style={{ minHeight: 44 }} onClick={() => { setFormDescription(currentDescriptionPreview.description); clearDescriptionPreview(); }}>Apply draft description</button>
                    <button type="button" disabled={saveBusy} style={{ minHeight: 44 }} onClick={clearDescriptionPreview}>Discard draft</button>
                  </div>
                </div>}
              </div>

              {/* ========================================================
                  AI AUTO-NUTRITION ESTIMATOR BUTTON & RESULT
                  ======================================================== */}
              <div
                style={{
                  backgroundColor: "#FFF9F6",
                  border: "1px solid #FFD0C0",
                  borderRadius: 8,
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={15} color="#EE4D2D" />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#222" }}>
                      AI nutrition estimates
                    </span>
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#666" }}>Per serving estimate</span>
                </div>

                <p style={{ fontSize: "11.5px", color: "#555", margin: 0 }}>
                  Enter a meal name, then request estimates for calories, protein, fat, carbohydrates, and sodium. Review the portion size and values before saving; these are not laboratory measurements.
                </p>

                <button
                  type="button"
                  onClick={() => handleEstimateWithAi()}
                  disabled={isEstimatingAi || !formName.trim()}
                  style={{
                    backgroundColor: isEstimatingAi ? "#CCC" : "#EE4D2D",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 4,
                    height: 38,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: isEstimatingAi ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  {isEstimatingAi ? (
                    <>
                      <RefreshCw size={14} className="spin-icon" />
                      Estimating nutrition with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Estimate nutrition and calories with AI
                    </>
                  )}
                </button>

                {aiRationale && (
                  <div style={{ backgroundColor: "#F9FBF9", border: "1px solid #D5EED8", borderRadius: 6, padding: "8px 10px", fontSize: "11.5px", color: "#00B14F", display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span><strong>Estimate explanation:</strong> {aiRationale}</span>
                  </div>
                )}
              </div>

              {/* 5 Macro Inputs (Auto-filled by AI, can be tweaked manually) */}
              <div>
                <label className="bmi-input-label" style={{ marginBottom: 6, display: "block" }}>
                  Nutrition values (editable):
                </label>
                <div className="merchant-macro-inputs-grid">
                  <div>
                    <span style={{ fontSize: "10px", color: "#EE4D2D", fontWeight: 600 }}>Calories (kcal)</span>
                    <input
                      type="number"
                      min="0" step="any"
                      aria-label="Calories (kcal)"
                      value={formKcal}
                      onChange={(e) => setFormKcal(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ width: "100%", minHeight: 44, border: "1px solid #DDD", borderRadius: 4, textAlign: "center", fontSize: "13px", fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: "10px", color: "#00B14F", fontWeight: 600 }}>Protein (g)</span>
                    <input
                      type="number"
                      min="0" step="any"
                      aria-label="Protein (g)"
                      value={formProtein}
                      onChange={(e) => setFormProtein(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ width: "100%", minHeight: 44, border: "1px solid #DDD", borderRadius: 4, textAlign: "center", fontSize: "13px", fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: "10px", color: "#333", fontWeight: 600 }}>Carbs (g)</span>
                    <input
                      type="number"
                      min="0" step="any"
                      aria-label="Carbohydrates (g)"
                      value={formCarbs}
                      onChange={(e) => setFormCarbs(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ width: "100%", minHeight: 44, border: "1px solid #DDD", borderRadius: 4, textAlign: "center", fontSize: "13px", fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: "10px", color: "#333", fontWeight: 600 }}>Fat (g)</span>
                    <input
                      type="number"
                      min="0" step="any"
                      aria-label="Fat (g)"
                      value={formFat}
                      onChange={(e) => setFormFat(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ width: "100%", minHeight: 44, border: "1px solid #DDD", borderRadius: 4, textAlign: "center", fontSize: "13px", fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div>
                    <span style={{ fontSize: "10px", color: "#003B7A", fontWeight: 600 }}>Sodium (mg)</span>
                    <input
                      type="number"
                      min="0" step="any"
                      aria-label="Sodium (mg)"
                      value={formSodium}
                      onChange={(e) => setFormSodium(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ width: "100%", minHeight: 44, border: "1px solid #DDD", borderRadius: 4, textAlign: "center", fontSize: "13px", fontWeight: 700 }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Cooking Notes */}
              <div className="bmi-input-group">
                <label className="bmi-input-label">Preparation instructions</label>
                <input
                  type="text"
                  placeholder="Example: Use fresh cooking oil and serve sambal separately"
                  value={formCookingNotes}
                  onChange={(e) => setFormCookingNotes(e.target.value)}
                  style={{ height: 38, border: "1px solid #DDD", borderRadius: 4, padding: "0 10px", fontSize: "12.5px" }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { if (!saveBusy) { clearDescriptionPreview(); setIsModalOpen(false); } }}
                  style={{ flex: 1, height: 42, border: "1px solid #DDD", borderRadius: 4, backgroundColor: "#FFF", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saveBusy || !recipe}
                  className="btn-shopee-primary"
                  style={{ flex: 2, height: 42, fontSize: "13px", fontWeight: 600 }}
                >
                  {editingDishId ? "Save meal changes" : "Save to NutriSea catalog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
