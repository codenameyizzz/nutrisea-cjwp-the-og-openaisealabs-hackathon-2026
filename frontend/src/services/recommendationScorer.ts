import type { DishItem } from "../data/menu";

/**
 * User profile inputs for recommendation scoring.
 * Reuses existing NutriSea persona & health profile attributes.
 */
export interface UserRecommendationProfile {
  primaryPersonaId?: string | null;
  secondaryPersonaIds?: string[] | null;
  targetBudget?: number | null; // target_lunch_budget_idr
  healthGoal?: string | null; // e.g. "otot", "turun", "ideal", "gerd", "hipertensi"
  archetypeCode?: string | null; // e.g. "BUDGET_FITNESS", "PREVENTIVE_HEALTH", etc.
  targetLunchKcal?: number | null; // target_lunch_kcal
  preferredTags?: string[] | string | null;
  preferredCuisines?: string[] | string | null;
  allergens?: string[] | string | null;
  medicalConditions?: string[] | string | null;
}

export interface RecommendationScoringOptions {
  searchQuery?: string | null;
  /** Custom variance generator or fixed function for testing */
  varianceProvider?: (item: DishItem) => number;
  /** Minimum score threshold (e.g. 0.70 for above 70%) */
  minScore?: number;
  /** Maximum number of top recommendations to return (e.g. 10) */
  limit?: number;
}

export interface RecommendationScoreBreakdown {
  p: number; // Primary persona fit [0.0, 1.0]
  s: number; // Secondary persona fit [0.0, 1.0]
  b: number; // Budget fit [0.0, 1.0]
  g: number; // Goal alignment [0.0, 1.0]
  n: number; // Nutrition quality / target fit [0.0, 1.0]
  f: number; // Food preference fit [0.0, 1.0]
  q?: number; // Search-query relevance [0.0, 1.0], only included if active search query
  v: number; // Random variance multiplier [0.85, 1.00]
  rawScore: number; // Weighted score before variance
  finalScore: number; // Final score R(u, m)
  hasSearchQuery: boolean;
  missingVariables: string[]; // Variables that fell back to neutral 0.50
}

export interface ScoredDishItem extends DishItem {
  recommendationScore: number;
  scoreBreakdown: RecommendationScoreBreakdown;
}

export const FALLBACK_NEUTRAL_VALUE = 0.50;
export const VARIANCE_MIN = 0.85;
export const VARIANCE_MAX = 1.00;

// Hard clinical limits (Kemenkes Isi Piringku & Permenkes No. 30/2013)
export const MAX_MEAL_SODIUM_HYPERTENSION_MG = 750;

/**
 * Hard filters: Excludes unavailable items and items with known allergy or medical restrictions.
 * High recommendation scores MUST NOT override these restrictions.
 */
export function passesHardFilters(item: DishItem, profile?: UserRecommendationProfile): boolean {
  // 1. Unavailable items filter
  if (item.isAvailable === false) {
    return false;
  }

  if (!profile) {
    return true;
  }

  // 2. Allergen Hard Filter
  let userAllergens: string[] = [];
  if (Array.isArray(profile.allergens)) {
    userAllergens = profile.allergens.map((a) => a.toLowerCase().trim()).filter(Boolean);
  } else if (typeof profile.allergens === "string" && profile.allergens.toUpperCase() !== "NONE") {
    userAllergens = profile.allergens
      .split(",")
      .map((a) => a.toLowerCase().trim())
      .filter(Boolean);
  }

  if (userAllergens.length > 0) {
    // Check item.allergens if available
    const itemAllergens = (item.allergens || []).map((a) => a.toLowerCase().trim());
    for (const allergen of userAllergens) {
      if (itemAllergens.includes(allergen)) {
        return false;
      }
      // Keyword fallback in dish name if item has allergen ingredient
      const lowerName = item.name.toLowerCase();
      if (allergen === "kacang" && lowerName.includes("kacang")) return false;
      if (allergen === "udang" && lowerName.includes("udang")) return false;
      if (allergen === "seafood" && (lowerName.includes("udang") || lowerName.includes("cumi") || lowerName.includes("kepiting"))) return false;
      if (allergen === "telur" && lowerName.includes("telur")) return false;
    }
  }

  // 3. Medical condition guardrails (e.g. Hypertension sodium cap)
  let userConditions: string[] = [];
  if (Array.isArray(profile.medicalConditions)) {
    userConditions = profile.medicalConditions.map((c) => c.toUpperCase().trim()).filter(Boolean);
  } else if (typeof profile.medicalConditions === "string" && profile.medicalConditions.toUpperCase() !== "NONE") {
    userConditions = profile.medicalConditions
      .split(",")
      .map((c) => c.toUpperCase().trim())
      .filter(Boolean);
  }

  const hasHypertension = userConditions.some((c) => c.includes("HYPERTENSION") || c.includes("HIPERTENSI"));
  if (hasHypertension && item.macros && item.macros.sodiumMg > MAX_MEAL_SODIUM_HYPERTENSION_MG) {
    return false;
  }

  return true;
}

/**
 * P: Primary persona fit [0.0, 1.0]
 */
export function computePrimaryPersonaFit(
  item: DishItem,
  profile?: UserRecommendationProfile
): { score: number; isMissing: boolean } {
  if (!profile?.primaryPersonaId || profile.primaryPersonaId.trim() === "") {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const itemPersonas = item.personas || item.matchedPersonas;
  if (!itemPersonas) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const isMatched = itemPersonas.includes(profile.primaryPersonaId.trim());
  return { score: isMatched ? 1.0 : 0.0, isMissing: false };
}

/**
 * S: Secondary persona fit [0.0, 1.0]
 */
export function computeSecondaryPersonaFit(
  item: DishItem,
  profile?: UserRecommendationProfile
): { score: number; isMissing: boolean } {
  const secondaryIds = profile?.secondaryPersonaIds;
  if (!secondaryIds || !Array.isArray(secondaryIds) || secondaryIds.length === 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const itemPersonas = item.personas || item.matchedPersonas;
  if (!itemPersonas) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const matchCount = secondaryIds.filter((id) => itemPersonas.includes(id)).length;
  const score = Math.min(1.0, Math.max(0.0, matchCount / secondaryIds.length));
  return { score, isMissing: false };
}

/**
 * B: Budget fit [0.0, 1.0]
 */
export function computeBudgetFit(
  item: DishItem,
  profile?: UserRecommendationProfile
): { score: number; isMissing: boolean } {
  if (profile?.targetBudget === undefined || profile?.targetBudget === null || profile.targetBudget <= 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const price = item.discountedPrice > 0 ? item.discountedPrice : item.basePrice;
  if (!price || price <= 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  if (price <= profile.targetBudget) {
    return { score: 1.0, isMissing: false };
  }

  // Linear decay up to 50% over budget
  const excess = price - profile.targetBudget;
  const maxExcess = profile.targetBudget * 0.50;
  const score = Math.max(0.0, 1.0 - excess / maxExcess);
  return { score: Number(score.toFixed(4)), isMissing: false };
}

/**
 * G: Goal alignment [0.0, 1.0]
 */
export function computeGoalAlignment(
  item: DishItem,
  profile?: UserRecommendationProfile
): { score: number; isMissing: boolean } {
  const goalRaw = profile?.healthGoal || profile?.archetypeCode;
  if (!goalRaw || goalRaw.trim() === "") {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const goal = goalRaw.toLowerCase();
  const protein = item.macros?.proteinG ?? 0;
  const kcal = item.macros?.kcal ?? 0;
  const fat = item.macros?.fatG ?? 0;
  const sodium = item.macros?.sodiumMg ?? 0;

  // 1. Muscle Gain / Fitness / Otot
  if (goal.includes("otot") || goal.includes("muscle") || goal.includes("fitness") || goal.includes("budget_fitness")) {
    if (protein >= 25 || item.category === "protein") return { score: 1.0, isMissing: false };
    if (protein >= 18) return { score: 0.75, isMissing: false };
    if (protein >= 12) return { score: 0.50, isMissing: false };
    return { score: 0.20, isMissing: false };
  }

  // 2. Weight Loss / Low Calorie / Turun
  if (goal.includes("turun") || goal.includes("defisit") || goal.includes("diet") || goal.includes("rendah-kalori")) {
    if ((kcal > 0 && kcal <= 350) || item.category === "rendah-kalori") return { score: 1.0, isMissing: false };
    if (kcal <= 450) return { score: 0.75, isMissing: false };
    if (kcal <= 550) return { score: 0.50, isMissing: false };
    return { score: 0.20, isMissing: false };
  }

  // 3. Digestive / GERD / Ramah Lambung
  if (goal.includes("gerd") || goal.includes("maag") || goal.includes("lambung") || goal.includes("digestive")) {
    if (item.category === "lambung" || (fat > 0 && fat <= 12)) return { score: 1.0, isMissing: false };
    if (fat <= 18) return { score: 0.60, isMissing: false };
    return { score: 0.20, isMissing: false };
  }

  // 4. Preventive Health / Balanced / Ideal
  if (goal.includes("ideal") || goal.includes("preventive") || goal.includes("overloaded") || goal.includes("sehat")) {
    if (kcal <= 500 && sodium <= 550 && protein >= 15) return { score: 1.0, isMissing: false };
    if (sodium <= 750) return { score: 0.70, isMissing: false };
    return { score: 0.40, isMissing: false };
  }

  return { score: FALLBACK_NEUTRAL_VALUE, isMissing: false };
}

/**
 * N: Nutrition quality / target fit [0.0, 1.0]
 */
export function computeNutritionFit(
  item: DishItem,
  profile?: UserRecommendationProfile
): { score: number; isMissing: boolean } {
  if (profile?.targetLunchKcal === undefined || profile?.targetLunchKcal === null || profile.targetLunchKcal <= 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const itemKcal = item.macros?.kcal;
  if (itemKcal === undefined || itemKcal === null || itemKcal <= 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const diff = Math.abs(itemKcal - profile.targetLunchKcal);
  // Within ±10% is optimal
  if (diff <= 0.10 * profile.targetLunchKcal) {
    return { score: 1.0, isMissing: false };
  }

  // Decay up to ±50%
  const maxDiff = profile.targetLunchKcal * 0.50;
  const score = Math.max(0.0, 1.0 - diff / maxDiff);
  return { score: Number(score.toFixed(4)), isMissing: false };
}

/**
 * F: Food preference fit [0.0, 1.0]
 */
export function computePreferenceFit(
  item: DishItem,
  profile?: UserRecommendationProfile
): { score: number; isMissing: boolean } {
  let tags: string[] = [];
  if (Array.isArray(profile?.preferredTags)) {
    tags = profile.preferredTags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  } else if (typeof profile?.preferredTags === "string") {
    tags = profile.preferredTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  if (tags.length === 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isMissing: true };
  }

  const itemText = [
    item.name,
    item.category,
    ...(item.healthyTags || [])
  ].join(" ").toLowerCase();

  const matchCount = tags.filter((t) => itemText.includes(t)).length;
  if (matchCount >= 2) return { score: 1.0, isMissing: false };
  if (matchCount === 1) return { score: 0.75, isMissing: false };
  return { score: 0.20, isMissing: false };
}

/**
 * Q: Search-query relevance [0.0, 1.0]
 * Only applicable when a non-empty query exists.
 * If relevance cannot be determined, returns 0.50.
 */
export function computeQueryRelevance(
  item: DishItem,
  query?: string | null
): { score: number; isApplicable: boolean } {
  if (query === undefined || query === null || query.trim() === "") {
    return { score: 0.0, isApplicable: false };
  }

  const q = query.trim().toLowerCase();
  const name = item.name.toLowerCase();
  const category = (item.category || "").toLowerCase();
  const merchant = (item.merchantName || item.restaurantName || "").toLowerCase();
  const tags = (item.healthyTags || []).map((t) => t.toLowerCase()).join(" ");

  // Full exact substring match in name
  if (name.includes(q)) {
    return { score: 1.0, isApplicable: true };
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { score: FALLBACK_NEUTRAL_VALUE, isApplicable: true };
  }

  const matched = tokens.filter(
    (t) => name.includes(t) || tags.includes(t) || category.includes(t) || merchant.includes(t)
  ).length;

  if (matched === tokens.length) {
    return { score: 0.90, isApplicable: true };
  } else if (matched > 0) {
    const score = 0.40 + 0.50 * (matched / tokens.length);
    return { score: Number(score.toFixed(4)), isApplicable: true };
  }

  return { score: 0.0, isApplicable: true };
}

/**
 * Scores a single menu item using the recommendation formula:
 *
 * No search query:
 *   R(u, m) = (0.25P + 0.10S + 0.15B + 0.25G + 0.15N + 0.10F) × V
 *
 * Active search query:
 *   R(u, m) = (0.20P + 0.05S + 0.10B + 0.20G + 0.10N + 0.05F + 0.30Q) × V
 */
export function scoreMenuItem(
  item: DishItem,
  profile?: UserRecommendationProfile,
  options?: RecommendationScoringOptions
): RecommendationScoreBreakdown {
  const missingVariables: string[] = [];

  const pRes = computePrimaryPersonaFit(item, profile);
  if (pRes.isMissing) missingVariables.push("P");

  const sRes = computeSecondaryPersonaFit(item, profile);
  if (sRes.isMissing) missingVariables.push("S");

  const bRes = computeBudgetFit(item, profile);
  if (bRes.isMissing) missingVariables.push("B");

  const gRes = computeGoalAlignment(item, profile);
  if (gRes.isMissing) missingVariables.push("G");

  const nRes = computeNutritionFit(item, profile);
  if (nRes.isMissing) missingVariables.push("N");

  const fRes = computePreferenceFit(item, profile);
  if (fRes.isMissing) missingVariables.push("F");

  // Determine V once per item
  let v = VARIANCE_MIN + Math.random() * (VARIANCE_MAX - VARIANCE_MIN);
  if (options?.varianceProvider) {
    v = options.varianceProvider(item);
  }
  // Clamp V
  v = Math.min(VARIANCE_MAX, Math.max(VARIANCE_MIN, v));

  const qRes = computeQueryRelevance(item, options?.searchQuery);
  const hasSearchQuery = qRes.isApplicable;

  let rawScore: number;
  if (!hasSearchQuery) {
    // No search query equation
    rawScore =
      0.25 * pRes.score +
      0.10 * sRes.score +
      0.15 * bRes.score +
      0.25 * gRes.score +
      0.15 * nRes.score +
      0.10 * fRes.score;
  } else {
    // Active search query equation
    rawScore =
      0.20 * pRes.score +
      0.05 * sRes.score +
      0.10 * bRes.score +
      0.20 * gRes.score +
      0.10 * nRes.score +
      0.05 * fRes.score +
      0.30 * qRes.score;
  }

  const finalScore = Number((rawScore * v).toFixed(4));

  return {
    p: pRes.score,
    s: sRes.score,
    b: bRes.score,
    g: gRes.score,
    n: nRes.score,
    f: fRes.score,
    q: hasSearchQuery ? qRes.score : undefined,
    v: Number(v.toFixed(4)),
    rawScore: Number(rawScore.toFixed(4)),
    finalScore,
    hasSearchQuery,
    missingVariables
  };
}

/**
 * Main recommendation ranking function:
 * 1. Evaluates existing hard filters (unavailable items, allergens, hypertension sodium).
 * 2. Computes stable random variance V once per item for the ranking pass.
 * 3. Scores every eligible item according to the appropriate equation.
 * 4. Sorts items in descending order of recommendation score.
 */
export function rankRecommendations(
  items: DishItem[],
  profile?: UserRecommendationProfile,
  options?: RecommendationScoringOptions
): ScoredDishItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  // Pre-generate stable variance V once per item for this ranking operation
  const varianceMap = new Map<string, number>();
  for (const item of items) {
    const v = options?.varianceProvider
      ? options.varianceProvider(item)
      : VARIANCE_MIN + Math.random() * (VARIANCE_MAX - VARIANCE_MIN);
    varianceMap.set(item.id, Math.min(VARIANCE_MAX, Math.max(VARIANCE_MIN, v)));
  }

  const effectiveOptions: RecommendationScoringOptions = {
    ...options,
    varianceProvider: (item: DishItem) => varianceMap.get(item.id) ?? VARIANCE_MAX
  };

  const scoredItems: ScoredDishItem[] = [];

  for (const item of items) {
    // Apply hard filters first: restrictions cannot be overridden by score
    if (!passesHardFilters(item, profile)) {
      continue;
    }

    const breakdown = scoreMenuItem(item, profile, effectiveOptions);
    scoredItems.push({
      ...item,
      recommendationScore: breakdown.finalScore,
      scoreBreakdown: breakdown
    });
  }

  // Sort descending by recommendationScore
  scoredItems.sort((a, b) => b.recommendationScore - a.recommendationScore);

  let result = scoredItems;
  if (options?.minScore !== undefined) {
    result = result.filter((item) => item.recommendationScore >= options.minScore!);
  }
  if (options?.limit !== undefined && options.limit > 0) {
    result = result.slice(0, options.limit);
  }

  return result;
}
