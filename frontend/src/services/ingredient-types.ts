export const INGREDIENT_UNITS = ["gram", "kg", "ml", "liter", "pcs", "tsp", "tbsp"] as const;
export type IngredientUnit = typeof INGREDIENT_UNITS[number];
export interface Ingredient {
  id: string;
  name: string;
  category: string;
  default_unit: IngredientUnit;
  is_active: boolean;
  aliases: string[];
}
export interface IngredientPage { items: Ingredient[]; total: number; page: number; limit: number; has_more: boolean }
export interface IngredientAccess { role?: "CONSUMER" | "MERCHANT_ADMIN" | "SHOPEE_ADMIN"; is_admin: boolean; can_edit_menus: boolean; merchant_ids: string[] }
export interface IngredientSelection {
  ingredient_id: string;
  name: string;
  quantity: string;
  unit: IngredientUnit;
  is_active: boolean;
}
export interface MenuRecipe { items: IngredientSelection[]; version: string }
export const EMPTY_RECIPE_VERSION = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
export interface IngredientWrite { name: string; category: string; default_unit: IngredientUnit; aliases: string[]; is_active: boolean }

export function quantityIsValid(value: string): boolean {
  return /^\d+(\.\d{1,3})?$/.test(value) && Number(value) > 0 && Number(value) <= 999999.999;
}

export function recipePayload(items: IngredientSelection[], version: string) {
  if (items.length > 100) throw new Error("A meal can contain at most 100 ingredients.");
  if (new Set(items.map(i => i.ingredient_id)).size !== items.length) throw new Error("Duplicate ingredients are not allowed.");
  if (items.some(i => !quantityIsValid(i.quantity) || !INGREDIENT_UNITS.includes(i.unit))) {
    throw new Error("Enter a positive quantity up to 999999.999 (maximum 3 decimal places) and a valid unit.");
  }
  return { items: items.map(({ ingredient_id, quantity, unit }) => ({ ingredient_id, quantity, unit })), version };
}
