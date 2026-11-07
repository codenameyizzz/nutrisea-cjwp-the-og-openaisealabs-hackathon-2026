"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from "react";
import { DishItem } from "@/data/menu";
import { useAuth } from "@clerk/nextjs";
import { sessionAccess } from "@/services/session-access";
import { CART_STORAGE_KEY, CART_OWNER_KEY, restoreAccountCart } from "@/services/shopping-cart";
import { useAccountSession } from "@/context/AccountSessionContext";
import { useMerchantNavigation } from "@/services/merchant-navigation";

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
  merchantNavigation: ReturnType<typeof useMerchantNavigation>;
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
  logUserAction: (actionType: string, payload: Record<string, any>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAccountSession();
  const { getToken, userId, sessionId, sessionClaims, isLoaded, isSignedIn } = useAuth();
  const [refreshError, setRefreshError] = useState<{ sessionId: string; message: string } | null>(null);
  const refreshAccountAccess = useCallback(() => {
    if (!isSignedIn || !sessionId) return;
    void getToken({ skipCache: true }).then(() => setRefreshError(null)).catch(() => {
      setRefreshError({ sessionId, message: "Your Clerk session could not be refreshed. Please try again." });
    });
  }, [getToken, isSignedIn, sessionId]);
  useEffect(() => {
    window.addEventListener("focus", refreshAccountAccess);
    return () => window.removeEventListener("focus", refreshAccountAccess);
  }, [refreshAccountAccess]);
  const sessionAccessResult = useMemo(() => {
    if (!isSignedIn) return {};
    try { return { access: sessionAccess(sessionClaims) }; }
    catch (error) { return { error: error instanceof Error ? error.message : "The session check failed." }; }
  }, [isSignedIn, sessionClaims]);
  const access = sessionAccessResult.access;
  const availableRoles = useMemo<UserAppRole[]>(() => [
    "CONSUMER", ...(access?.can_edit_menus ? ["MERCHANT" as const] : []),
    ...(access?.is_admin ? ["SHOPEE_ADMIN" as const] : []),
  ], [access]);
  const roleAccessLoaded = !!isLoaded;
  const merchantNavigation = useMerchantNavigation({
    userId: isLoaded && isSignedIn ? userId ?? null : null,
    sessionId: isLoaded && isSignedIn ? sessionId ?? null : null,
    getToken,
    hasAccess: availableRoles.includes("MERCHANT"),
  });
  const roleAccessError = sessionAccessResult.error || (refreshError?.sessionId === sessionId ? refreshError?.message : null) || null;
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
  const [cartRestored, setCartRestored] = useState(false);
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const owner = userId || "guest";
      setCartItems(restoreAccountCart(sessionStorage.getItem(CART_STORAGE_KEY), sessionStorage.getItem(CART_OWNER_KEY), owner));
      sessionStorage.setItem(CART_OWNER_KEY, owner);
    }
    catch { /* Browsing still works when browser storage is unavailable. */ }
    setCartRestored(true);
  }, [isLoaded, userId]);
  useEffect(() => {
    if (!cartRestored) return;
    try { sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems)); }
    catch { /* Keep the in-memory cart usable. */ }
  }, [cartItems, cartRestored]);
  const [heightCm, setHeightCm] = useState<number>(160); // Lily SCBD default
  const [weightKg, setWeightKg] = useState<number>(52);  // Lily SCBD default
  const [activityGoal, setActivityGoal] = useState<"turun" | "ideal" | "otot">("ideal");
  const [snackLogged, setSnackLogged] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>("semua");
  const [isSeaBankOpen, setIsSeaBankOpen] = useState<boolean>(false);
  const [merchantDemoTrigger, setMerchantDemoTrigger] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const activeUserId = isSignedIn ? userId : "";
  useEffect(() => {
    setHeightCm(account?.profile?.height_cm ?? 160);
    setWeightKg(account?.profile?.weight_kg ?? 52);
    setActivityGoal(account?.profile?.goal === "LOSE_WEIGHT" ? "turun" : account?.profile?.goal === "GAIN_MUSCLE" ? "otot" : "ideal");
  }, [account]);

  const logUserAction = async (actionType: string, payload: Record<string, any>) => {
    if (!activeUserId) return;
    try {
      const token = await getToken();
      if (!token) return;
      await fetch("http://127.0.0.1:8000/api/actions/log", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    let category = "Normal range";
    let badgeClass = "ideal";
    let targetCalories = 1750;
    let targetProtein = 75;

    if (score < 18.5) {
      category = "Underweight";
      badgeClass = "warning";
      targetCalories = 2000;
      targetProtein = 65;
    } else if (score >= 23 && score < 25) {
      category = "Overweight";
      badgeClass = "warning";
      targetCalories = 1600;
      targetProtein = 80;
    } else if (score >= 25) {
      category = "Obesity range";
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
        return prev.map((item, index) => index === idx ? { ...item, qty: item.qty + qty } : item);
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
        merchantNavigation,
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
