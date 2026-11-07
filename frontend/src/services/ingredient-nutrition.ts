import { API_BASE_URL, responseJson } from "../lib/api";

export interface SourceServing {
  source_key: string;
  description: string | null;
  metric_amount: number;
  metric_unit: string;
  nutrients: Record<string, number | null>;
  nutrient_units: Record<string, string | null>;
  unit_unverified_fields: string[];
}

export interface IngredientNutritionData {
  ingredient: { id: string; name: string; is_active: boolean };
  status: "source_reference" | "no_source";
  basis: "per_source_serving";
  note: string;
  sources: {
    source_key: string;
    source_name: string;
    source_url: string | null;
    servings: SourceServing[];
  }[];
}

export async function loadIngredientNutrition(id: string, signal?: AbortSignal) {
  return responseJson<IngredientNutritionData>(await fetch(
    `${API_BASE_URL}/api/ingredients/${encodeURIComponent(id)}/nutrition`, { signal, cache: "no-store" }));
}
