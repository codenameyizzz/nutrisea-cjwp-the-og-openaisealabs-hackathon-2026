"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useMemo } from "react";
import { API_BASE_URL, ApiError, responseJson } from "../lib/api";
import type { Ingredient, IngredientAccess, IngredientPage, IngredientWrite, MenuRecipe } from "./ingredient-types";

export function useIngredientApi() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const authenticatedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getToken();
    if (!token) throw new ApiError(401, "Silakan masuk untuk mengelola bahan.");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  }, [getToken]);
  const request = useCallback(async <T,>(path: string, init: RequestInit = {}) =>
    responseJson<T>(await authenticatedFetch(path, init)), [authenticatedFetch]);
  return useMemo(() => ({
    isLoaded, isSignedIn, userId, authenticatedFetch,
    access: (signal?: AbortSignal) => request<IngredientAccess>("/api/ingredients/access", { signal }),
    search: async (query: string, signal?: AbortSignal) => responseJson<IngredientPage>(await fetch(
      `${API_BASE_URL}/api/ingredients?${new URLSearchParams({ search: query, limit: "8" })}`, { signal, cache: "no-store" })),
    manage: (search: string, page: number, signal?: AbortSignal) => request<IngredientPage>(
      `/api/ingredients/manage?${new URLSearchParams({ search, page: String(page), limit: "20" })}`, { signal }),
    save: (data: IngredientWrite, id?: string) => request<Ingredient>(
      `/api/ingredients${id ? `/${encodeURIComponent(id)}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(data) }),
    deactivate: (id: string) => request(`/api/ingredients/${encodeURIComponent(id)}`, { method: "DELETE" }),
    recipe: (id: string, signal?: AbortSignal) => request<MenuRecipe>(`/api/dishes/${encodeURIComponent(id)}/ingredients`, { signal }),
  }), [isLoaded, isSignedIn, userId, authenticatedFetch, request]);
}
