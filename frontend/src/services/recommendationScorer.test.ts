import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreMenuItem,
  rankRecommendations,
  passesHardFilters,
  FALLBACK_NEUTRAL_VALUE,
  VARIANCE_MIN,
  VARIANCE_MAX
} from "./recommendationScorer";
import type { UserRecommendationProfile } from "./recommendationScorer";
import type { DishItem } from "../data/menu";

const sampleDish1: DishItem = {
  id: "DISH-001",
  name: "Paket Nasi Merah Dada Ayam Bakar",
  category: "protein",
  merchantName: "Warteg Berkah Sehat",
  district: "Kuningan",
  distanceKm: 0.8,
  rating: 4.9,
  soldCount: "1.8rb+",
  basePrice: 30000,
  discountedPrice: 25000,
  imageUrl: "",
  healthyTags: ["Minyak Baru", "Sayur Bening", "Dada Ayam"],
  macros: {
    kcal: 450,
    proteinG: 35.0,
    carbsG: 40.0,
    fatG: 8.0,
    sodiumMg: 420
  },
  cookingNotes: "Minyak baru",
  hygieneBadges: ["Minyak Baru Terverifikasi"],
  personas: ["BUDG_FACHRI_MENTENG_115", "BUDG_HANA_MENTENG_096"],
  allergens: [],
  isAvailable: true
};

const sampleDish2: DishItem = {
  id: "DISH-002",
  name: "Soto Ayam Suwir Bening",
  category: "lambung",
  merchantName: "Soto Kudus Menara",
  district: "Menteng",
  distanceKm: 1.2,
  rating: 4.7,
  soldCount: "900+",
  basePrice: 26000,
  discountedPrice: 22000,
  imageUrl: "",
  healthyTags: ["Kuah Bening", "Rendah Lemak"],
  macros: {
    kcal: 380,
    proteinG: 24.0,
    carbsG: 35.0,
    fatG: 7.0,
    sodiumMg: 490
  },
  cookingNotes: "Tanpa santan",
  hygieneBadges: ["Dapur Higienis"],
  personas: ["PREV_ADITYA_KUNINGAN_088"],
  allergens: [],
  isAvailable: true
};

const sampleDishAllergen: DishItem = {
  id: "DISH-003",
  name: "Gado-gado Saus Kacang Mantap",
  category: "hemat",
  merchantName: "Gado-gado Ibu Eni",
  district: "Sudirman",
  distanceKm: 0.5,
  rating: 4.8,
  soldCount: "2.1rb+",
  basePrice: 22000,
  discountedPrice: 18000,
  imageUrl: "",
  healthyTags: ["Sayur Segar"],
  macros: {
    kcal: 420,
    proteinG: 14.0,
    carbsG: 50.0,
    fatG: 18.0,
    sodiumMg: 520
  },
  cookingNotes: "Bumbu kacang kental",
  hygieneBadges: [],
  personas: ["BUDG_FACHRI_MENTENG_115"],
  allergens: ["kacang"],
  isAvailable: true
};

const sampleDishUnavailable: DishItem = {
  id: "DISH-004",
  name: "Ikan Bakar Bumbu Rujak",
  category: "protein",
  merchantName: "Ikan Bakar Cianjur",
  district: "Senayan",
  distanceKm: 2.1,
  rating: 4.6,
  soldCount: "400+",
  basePrice: 32000,
  discountedPrice: 28000,
  imageUrl: "",
  healthyTags: [],
  macros: { kcal: 400, proteinG: 30.0, carbsG: 20.0, fatG: 10.0, sodiumMg: 450 },
  cookingNotes: "",
  hygieneBadges: [],
  personas: ["BUDG_FACHRI_MENTENG_115"],
  allergens: [],
  isAvailable: false
};

const sampleProfile: UserRecommendationProfile = {
  primaryPersonaId: "BUDG_FACHRI_MENTENG_115",
  secondaryPersonaIds: ["BUDG_HANA_MENTENG_096", "PREV_ADITYA_KUNINGAN_088"],
  targetBudget: 25000,
  healthGoal: "otot",
  targetLunchKcal: 450,
  preferredTags: ["Minyak Baru", "Dada Ayam"],
  allergens: "NONE",
  medicalConditions: "NONE"
};

test("Equation 1: No active search query", () => {
  const breakdown = scoreMenuItem(sampleDish1, sampleProfile, {
    searchQuery: "",
    varianceProvider: () => 1.0
  });

  assert.strictEqual(breakdown.hasSearchQuery, false);
  assert.strictEqual(breakdown.q, undefined);
  assert.strictEqual(breakdown.v, 1.0);

  // P = 1.0 (in personas)
  assert.strictEqual(breakdown.p, 1.0);
  // S = 0.5 (1 of 2 secondary personas match)
  assert.strictEqual(breakdown.s, 0.5);
  // B = 1.0 (25000 <= 25000)
  assert.strictEqual(breakdown.b, 1.0);
  // G = 1.0 (goal 'otot', protein 35.0 >= 25)
  assert.strictEqual(breakdown.g, 1.0);
  // N = 1.0 (kcal 450 == target 450)
  assert.strictEqual(breakdown.n, 1.0);
  // F = 1.0 (matches both 'Minyak Baru' and 'Dada Ayam')
  assert.strictEqual(breakdown.f, 1.0);

  // Expected raw score:
  // 0.25(1.0) + 0.10(0.5) + 0.15(1.0) + 0.25(1.0) + 0.15(1.0) + 0.10(1.0) = 0.95
  assert.strictEqual(breakdown.rawScore, 0.95);
  assert.strictEqual(breakdown.finalScore, 0.95);
});

test("Equation 2: Active search query", () => {
  const breakdown = scoreMenuItem(sampleDish1, sampleProfile, {
    searchQuery: "ayam bakar",
    varianceProvider: () => 1.0
  });

  assert.strictEqual(breakdown.hasSearchQuery, true);
  assert.strictEqual(breakdown.q, 1.0);

  // Expected raw score:
  // 0.20(1.0) + 0.05(0.5) + 0.10(1.0) + 0.20(1.0) + 0.10(1.0) + 0.05(1.0) + 0.30(1.0)
  // = 0.20 + 0.025 + 0.10 + 0.20 + 0.10 + 0.05 + 0.30 = 0.975
  assert.strictEqual(breakdown.rawScore, 0.975);
  assert.strictEqual(breakdown.finalScore, 0.975);
});

test("Missing data fallback: Profile variables fallback to neutral 0.50", () => {
  const emptyProfile: UserRecommendationProfile = {};
  const breakdown = scoreMenuItem(sampleDish1, emptyProfile, {
    searchQuery: null,
    varianceProvider: () => 1.0
  });

  assert.strictEqual(breakdown.p, FALLBACK_NEUTRAL_VALUE);
  assert.strictEqual(breakdown.s, FALLBACK_NEUTRAL_VALUE);
  assert.strictEqual(breakdown.b, FALLBACK_NEUTRAL_VALUE);
  assert.strictEqual(breakdown.g, FALLBACK_NEUTRAL_VALUE);
  assert.strictEqual(breakdown.n, FALLBACK_NEUTRAL_VALUE);
  assert.strictEqual(breakdown.f, FALLBACK_NEUTRAL_VALUE);

  assert.deepStrictEqual(new Set(breakdown.missingVariables), new Set(["P", "S", "B", "G", "N", "F"]));
  // 1.00 * 0.50 = 0.50
  assert.strictEqual(breakdown.rawScore, 0.50);
  assert.strictEqual(breakdown.finalScore, 0.50);
});

test("Search query handling: Empty vs active vs non-matching", () => {
  // Empty query -> no search equation
  const emptyRes = scoreMenuItem(sampleDish1, sampleProfile, {
    searchQuery: "   ",
    varianceProvider: () => 1.0
  });
  assert.strictEqual(emptyRes.hasSearchQuery, false);
  assert.strictEqual(emptyRes.q, undefined);

  // Active query non-matching -> Q = 0.0
  const noMatchRes = scoreMenuItem(sampleDish1, sampleProfile, {
    searchQuery: "soto kudus",
    varianceProvider: () => 1.0
  });
  assert.strictEqual(noMatchRes.hasSearchQuery, true);
  assert.strictEqual(noMatchRes.q, 0.0);
});

test("Random variance: Generated between 0.85 and 1.00 and stable per item", () => {
  const items = [sampleDish1, sampleDish2];
  const ranked = rankRecommendations(items, sampleProfile);

  for (const item of ranked) {
    const v = item.scoreBreakdown.v;
    assert.ok(v >= VARIANCE_MIN, `V ${v} must be >= ${VARIANCE_MIN}`);
    assert.ok(v <= VARIANCE_MAX, `V ${v} must be <= ${VARIANCE_MAX}`);
    // Stability verification
    const expectedFinal = Number((item.scoreBreakdown.rawScore * v).toFixed(4));
    assert.strictEqual(item.recommendationScore, item.scoreBreakdown.finalScore);
    assert.ok(Math.abs(item.recommendationScore - (item.scoreBreakdown.rawScore * v)) < 0.001);
  }
});

test("Hard filters: Unavailable items and allergens excluded before scoring", () => {
  const profileWithAllergy: UserRecommendationProfile = {
    ...sampleProfile,
    allergens: ["kacang"]
  };

  assert.strictEqual(passesHardFilters(sampleDishAllergen, profileWithAllergy), false);
  assert.strictEqual(passesHardFilters(sampleDishUnavailable, sampleProfile), false);
  assert.strictEqual(passesHardFilters(sampleDish1, profileWithAllergy), true);

  const ranked = rankRecommendations(
    [sampleDish1, sampleDishAllergen, sampleDishUnavailable],
    profileWithAllergy,
    { varianceProvider: () => 1.0 }
  );

  const ids = ranked.map((d) => d.id);
  assert.ok(ids.includes("DISH-001"));
  assert.ok(!ids.includes("DISH-003"));
  assert.ok(!ids.includes("DISH-004"));
});

test("Ranking order: Items sorted in descending order of recommendation score", () => {
  const items = [sampleDish2, sampleDish1];
  const ranked = rankRecommendations(items, sampleProfile, {
    varianceProvider: () => 1.0
  });

  assert.strictEqual(ranked.length, 2);
  assert.ok(ranked[0].recommendationScore > ranked[1].recommendationScore);
  assert.strictEqual(ranked[0].id, "DISH-001");
  assert.strictEqual(ranked[1].id, "DISH-002");
});

test("Threshold and Top 10 Limit: Only items above 70% and capped at top 10", () => {
  // Create 15 mock dishes with varying prices to produce varying scores
  const mockDishes: DishItem[] = Array.from({ length: 15 }, (_, i) => ({
    ...sampleDish1,
    id: `DISH-${i + 100}`,
    name: `Menu Pilihan ${i + 1}`,
    discountedPrice: 20000 + i * 4000 // Increasing price degrades budget fit
  }));

  const result = rankRecommendations(mockDishes, sampleProfile, {
    varianceProvider: () => 1.0,
    minScore: 0.70,
    limit: 10
  });

  // Must not exceed 10 items
  assert.ok(result.length <= 10, "Must be capped at top 10");
  // Every item must be >= 0.70
  for (const item of result) {
    assert.ok(
      item.recommendationScore >= 0.70,
      `Score ${item.recommendationScore} must be >= 0.70`
    );
  }
});
