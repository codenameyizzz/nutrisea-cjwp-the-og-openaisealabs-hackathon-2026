"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
import { DishItem } from "@/data/menu";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, responseJson } from "@/lib/api";
import type { IngredientAccess } from "@/services/ingredient-types";

export interface CartItem {
  dish: DishItem;
  qty: number;
}

export interface BmiStats {
  score: number;
  category: string;
  badgeClass: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  sodiumCap: number;
}

export type UserAppRole = "CONSUMER" | "MERCHANT" | "SHOPEE_ADMIN";

interface AppContextType {
  refreshAccountAccess: () => void;
  availableRoles: UserAppRole[];
  roleAccessLoaded: boolean;
  roleAccessError: string | null;
  activeRole: UserAppRole;
  setActiveRole: (role: UserAppRole) => void;

  cartItems: CartItem[];
  addToCart: (dish: DishItem, qty?: number) => void;
  removeFromCart: (dishId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;

  heightCm: number;
  weightKg: number;
  activityGoal: "turun" | "ideal" | "otot";
  bmiStats: BmiStats;
  updateBmi: (h: number, w: number, goal: "turun" | "ideal" | "otot") => void;

  snackLogged: boolean;
  logSnack: () => void;
  clearSnack: () => void;

  activeCategory: string;
  setActiveCategory: (cat: string) => void;

  isSeaBankOpen: boolean;
  setIsSeaBankOpen: (open: boolean) => void;

  merchantDemoTrigger: boolean;
  setMerchantDemoTrigger: (v: boolean) => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  activeUserId: string;
  setActiveUserId: (id: string) => void;
  logUserAction: (actionType: string, payload: Record<string, any>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [accessRevision, setAccessRevision] = useState(0);
  const refreshAccountAccess = useCallback(() => setAccessRevision(current => current + 1), []);
  useEffect(() => {
    window.addEventListener("focus", refreshAccountAccess);
    return () => window.removeEventListener("focus", refreshAccountAccess);
  }, [refreshAccountAccess]);
  const { getToken, userId, isLoaded, isSignedIn } = useAuth();
  const [account, setAccount] = useState<{ userId: string; access?: IngredientAccess; error?: string } | null>(null);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Silakan masuk kembali.");
        const access = await responseJson<IngredientAccess>(await fetch(`${API_BASE_URL}/api/ingredients/access`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store",
        }));
        if (!controller.signal.aborted) setAccount({ userId, access });
      } catch (error) {
        if (!controller.signal.aborted) setAccount({ userId, error: error instanceof Error ? error.message : "Pemeriksaan akses gagal." });
      }
    };
    void load();
    return () => controller.abort();
  }, [getToken, userId, isLoaded, isSignedIn, accessRevision]);
  const access = account?.userId === userId ? account?.access : undefined;
  const availableRoles = useMemo<UserAppRole[]>(() => [
    "CONSUMER", ...(access?.can_edit_menus ? ["MERCHANT" as const] : []),
    ...(access?.is_admin ? ["SHOPEE_ADMIN" as const] : []),
  ], [access]);
  const roleAccessLoaded = !!isLoaded && (!isSignedIn || account?.userId === userId);
  const roleAccessError = account?.userId === userId ? account?.error || null : null;
  const [activeRole, setActiveRoleState] = useState<UserAppRole>("CONSUMER");
  useEffect(() => {
    if (roleAccessLoaded && !availableRoles.includes(activeRole)) {
      setActiveRoleState("CONSUMER");
      localStorage.setItem("nutrisea_user_role", "CONSUMER");
    }
  }, [roleAccessLoaded, availableRoles, activeRole]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nutrisea_user_role") as UserAppRole | null;
      if (saved && ["CONSUMER", "MERCHANT", "SHOPEE_ADMIN"].includes(saved)) {
        setActiveRoleState(saved);
      }
    }
  }, []);

  const setActiveRole = (role: UserAppRole) => {
    if (!availableRoles.includes(role)) return;
    setActiveRoleState(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("nutrisea_user_role", role);
    }
  };
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [heightCm, setHeightCm] = useState<number>(160); // Lily SCBD default
  const [weightKg, setWeightKg] = useState<number>(52);  // Lily SCBD default
  const [activityGoal, setActivityGoal] = useState<"turun" | "ideal" | "otot">("ideal");
  const [snackLogged, setSnackLogged] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>("semua");
  const [isSeaBankOpen, setIsSeaBankOpen] = useState<boolean>(false);
  const [merchantDemoTrigger, setMerchantDemoTrigger] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeUserId, setActiveUserIdState] = useState<string>("user_3LdSuzBP84WASHC2BC7vliRK52R");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("nutrisea_user_id");
      if (savedUser) setActiveUserIdState(savedUser);
    }
  }, []);

  const setActiveUserId = (id: string) => {
    setActiveUserIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("nutrisea_user_id", id);
    }
  };

  const logUserAction = async (actionType: string, payload: Record<string, any>) => {
    try {
      const actionRecord = {
        action_type: actionType,
        payload,
        created_at: new Date().toISOString()
      };
      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("nutrisea_short_term_memory") || "[]");
          stored.unshift(actionRecord);
          localStorage.setItem("nutrisea_short_term_memory", JSON.stringify(stored.slice(0, 20)));
        } catch {}
      }

      await fetch("http://127.0.0.1:8000/api/actions/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: activeUserId,
          action_type: actionType,
          payload
        })
      });
    } catch (err) {
      console.debug("Failed to sync action to backend STM:", err);
    }
  };

  const bmiStats = useMemo(() => {
    const hMeter = heightCm / 100;
    const score = Number((weightKg / (hMeter * hMeter)).toFixed(1));
    let category = "Ideal (Normal)";
    let badgeClass = "ideal";
    let targetCalories = 1750;
    let targetProtein = 75;

    if (score < 18.5) {
      category = "Kurang (Underweight)";
      badgeClass = "warning";
      targetCalories = 2000;
      targetProtein = 65;
    } else if (score >= 23 && score < 25) {
      category = "Berisiko (Overweight)";
      badgeClass = "warning";
      targetCalories = 1600;
      targetProtein = 80;
    } else if (score >= 25) {
      category = "Obesitas";
      badgeClass = "warning";
      targetCalories = 1450;
      targetProtein = 85;
    }

    if (activityGoal === "turun") {
      targetCalories = Math.max(1400, targetCalories - 250);
    } else if (activityGoal === "otot") {
      targetCalories += 300;
      targetProtein += 20;
    }

    return {
      score,
      category,
      badgeClass,
      targetCalories,
      targetProtein,
      targetCarbs: Math.round((targetCalories * 0.5) / 4),
      sodiumCap: 2000
    };
  }, [heightCm, weightKg, activityGoal]);

  const addToCart = (dish: DishItem, qty: number = 1) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.dish.id === dish.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].qty += qty;
        return updated;
      }
      return [...prev, { dish, qty }];
    });

    logUserAction("ADD_TO_CART", {
      item_id: dish.id,
      item_name: dish.name,
      merchant_name: dish.merchantName,
      price: dish.discountedPrice,
      personas: dish.personas || dish.matchedPersonas || [],
      category: dish.category,
      qty
    });
  };

  const removeFromCart = (dishId: string) => {
    setCartItems((prev) => prev.filter((i) => i.dish.id !== dishId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.dish.discountedPrice * item.qty, 0);
  }, [cartItems]);

  const cartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.qty, 0);
  }, [cartItems]);

  const updateBmi = (h: number, w: number, goal: "turun" | "ideal" | "otot") => {
    setHeightCm(h);
    setWeightKg(w);
    setActivityGoal(goal);
  };

  const logSnack = () => {
    setSnackLogged(true);
    setActiveCategory("rendah-kalori");
  };

  const clearSnack = () => {
    setSnackLogged(false);
  };

  return (
    <AppContext.Provider
      value={{
        availableRoles, roleAccessLoaded, roleAccessError, refreshAccountAccess,
        activeRole,
        setActiveRole,
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        heightCm,
        weightKg,
        activityGoal,
        bmiStats,
        updateBmi,
        snackLogged,
        logSnack,
        clearSnack,
        activeCategory,
        setActiveCategory,
        isSeaBankOpen,
        setIsSeaBankOpen,
        merchantDemoTrigger,
        setMerchantDemoTrigger,
        searchQuery,
        setSearchQuery,
        activeUserId,
        setActiveUserId,
        logUserAction
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
