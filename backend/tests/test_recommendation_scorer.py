import unittest
from backend.app.services.recommendation_scorer import (
    score_menu_item,
    rank_recommendations,
    passes_hard_filters,
    FALLBACK_NEUTRAL_VALUE,
    VARIANCE_MIN,
    VARIANCE_MAX
)

class TestRecommendationScorer(unittest.TestCase):
    def setUp(self):
        self.sample_dish_1 = {
            "id": "DISH-001",
            "name": "Paket Nasi Merah Dada Ayam Bakar",
            "category": "protein",
            "merchant_name": "Warteg Berkah Sehat",
            "discounted_price_idr": 25000,
            "base_price_idr": 30000,
            "macros": {
                "kcal": 450,
                "protein_g": 35.0,
                "carbs_g": 40.0,
                "fat_g": 8.0,
                "sodium_mg": 420
            },
            "healthy_tags": ["Minyak Baru", "Sayur Bening", "Dada Ayam"],
            "personas": ["BUDG_FACHRI_MENTENG_115", "BUDG_HANA_MENTENG_096"],
            "allergens": [],
            "is_available": True
        }

        self.sample_dish_2 = {
            "id": "DISH-002",
            "name": "Soto Ayam Suwir Bening",
            "category": "lambung",
            "merchant_name": "Soto Kudus Menara",
            "discounted_price_idr": 22000,
            "base_price_idr": 26000,
            "macros": {
                "kcal": 380,
                "protein_g": 24.0,
                "carbs_g": 35.0,
                "fat_g": 7.0,
                "sodium_mg": 490
            },
            "healthy_tags": ["Kuah Bening", "Rendah Lemak"],
            "personas": ["PREV_ADITYA_KUNINGAN_088"],
            "allergens": [],
            "is_available": True
        }

        self.sample_dish_allergens = {
            "id": "DISH-003",
            "name": "Gado-gado Saus Kacang Mantap",
            "category": "hemat",
            "discounted_price_idr": 18000,
            "base_price_idr": 22000,
            "macros": {"kcal": 420, "protein_g": 14.0, "sodium_mg": 520},
            "healthy_tags": ["Sayur Segar"],
            "personas": ["BUDG_FACHRI_MENTENG_115"],
            "allergens": ["kacang"],
            "is_available": True
        }

        self.sample_dish_unavailable = {
            "id": "DISH-004",
            "name": "Ikan Bakar Bumbu Rujak (Habis)",
            "category": "protein",
            "discounted_price_idr": 28000,
            "base_price_idr": 32000,
            "macros": {"kcal": 400, "protein_g": 30.0, "sodium_mg": 450},
            "personas": ["BUDG_FACHRI_MENTENG_115"],
            "is_available": False
        }

        self.sample_profile = {
            "primary_persona_id": "BUDG_FACHRI_MENTENG_115",
            "secondary_persona_ids": ["BUDG_HANA_MENTENG_096", "PREV_ADITYA_KUNINGAN_088"],
            "target_lunch_budget_idr": 25000,
            "health_goal": "otot",
            "target_lunch_kcal": 450,
            "preferred_tags": "Minyak Baru, Dada Ayam",
            "allergens": "NONE",
            "medical_conditions": "NONE"
        }

    def test_equation_no_search_query(self):
        """
        Verify no-search equation:
        R(u, m) = (0.25P + 0.10S + 0.15B + 0.25G + 0.15N + 0.10F) × V
        """
        res = score_menu_item(self.sample_dish_1, self.sample_profile, search_query=None, variance=1.0)
        self.assertFalse(res["has_search_query"])
        self.assertIsNone(res["q"])
        self.assertEqual(res["v"], 1.0)
        
        # P = 1.0 (in personas)
        self.assertEqual(res["p"], 1.0)
        # S = 0.5 (1 of 2 secondary personas match: BUDG_HANA_MENTENG_096)
        self.assertEqual(res["s"], 0.5)
        # B = 1.0 (25000 <= 25000)
        self.assertEqual(res["b"], 1.0)
        # G = 1.0 (goal 'otot', protein 35.0 >= 25)
        self.assertEqual(res["g"], 1.0)
        # N = 1.0 (kcal 450 == target 450)
        self.assertEqual(res["n"], 1.0)
        # F = 1.0 (matches both 'minyak baru' and 'dada ayam')
        self.assertEqual(res["f"], 1.0)

        # Expected: 0.25(1) + 0.10(0.5) + 0.15(1) + 0.25(1) + 0.15(1) + 0.10(1) = 0.25 + 0.05 + 0.15 + 0.25 + 0.15 + 0.10 = 0.95
        expected_raw = 0.95
        self.assertAlmostEqual(res["raw_score"], expected_raw, places=3)
        self.assertAlmostEqual(res["final_score"], expected_raw * 1.0, places=3)

    def test_equation_active_search_query(self):
        """
        Verify active search query equation:
        R(u, m) = (0.20P + 0.05S + 0.10B + 0.20G + 0.10N + 0.05F + 0.30Q) × V
        """
        res = score_menu_item(self.sample_dish_1, self.sample_profile, search_query="ayam bakar", variance=1.0)
        self.assertTrue(res["has_search_query"])
        self.assertIsNotNone(res["q"])
        self.assertEqual(res["q"], 1.0) # 'ayam bakar' in 'Paket Nasi Merah Dada Ayam Bakar'

        # Expected:
        # 0.20(1.0) + 0.05(0.5) + 0.10(1.0) + 0.20(1.0) + 0.10(1.0) + 0.05(1.0) + 0.30(1.0)
        # = 0.20 + 0.025 + 0.10 + 0.20 + 0.10 + 0.05 + 0.30 = 0.975
        expected_raw = 0.975
        self.assertAlmostEqual(res["raw_score"], expected_raw, places=3)
        self.assertAlmostEqual(res["final_score"], expected_raw * 1.0, places=3)

    def test_missing_data_fallback(self):
        """
        If profile-based data is missing, variables must fall back to 0.50.
        """
        empty_profile = {}
        res = score_menu_item(self.sample_dish_1, empty_profile, search_query=None, variance=1.0)

        self.assertEqual(res["p"], FALLBACK_NEUTRAL_VALUE)
        self.assertEqual(res["s"], FALLBACK_NEUTRAL_VALUE)
        self.assertEqual(res["b"], FALLBACK_NEUTRAL_VALUE)
        self.assertEqual(res["g"], FALLBACK_NEUTRAL_VALUE)
        self.assertEqual(res["n"], FALLBACK_NEUTRAL_VALUE)
        self.assertEqual(res["f"], FALLBACK_NEUTRAL_VALUE)

        # All 6 missing
        self.assertEqual(set(res["missing_variables"]), {"P", "S", "B", "G", "N", "F"})
        # Weighted sum: 1.00 * 0.50 = 0.50
        self.assertAlmostEqual(res["raw_score"], 0.50, places=3)
        self.assertAlmostEqual(res["final_score"], 0.50, places=3)

    def test_search_query_handling(self):
        """
        - Empty or whitespace search query must use no-search equation (no Q fallback).
        - Non-empty query without direct match has calculated token relevance.
        - Indeterminate empty token fallback uses Q = 0.50.
        """
        # Empty string
        res_empty = score_menu_item(self.sample_dish_1, self.sample_profile, search_query="   ", variance=1.0)
        self.assertFalse(res_empty["has_search_query"])
        self.assertIsNone(res_empty["q"])

        # Query with match
        res_match = score_menu_item(self.sample_dish_1, self.sample_profile, search_query="soto", variance=1.0)
        self.assertTrue(res_match["has_search_query"])
        self.assertEqual(res_match["q"], 0.0) # Not a soto

    def test_random_variance_bounds_and_stability(self):
        """
        Random variance V must be strictly between 0.85 and 1.00,
        and generated once per item per recommendation operation.
        """
        items = [self.sample_dish_1, self.sample_dish_2]
        ranked = rank_recommendations(items, self.sample_profile)

        for item in ranked:
            v = item["score_breakdown"]["v"]
            self.assertGreaterEqual(v, VARIANCE_MIN)
            self.assertLessEqual(v, VARIANCE_MAX)
            # Check stability: score equals raw * v
            self.assertAlmostEqual(
                item["recommendation_score"],
                round(item["score_breakdown"]["raw_score"] * v, 4),
                places=3
            )

    def test_hard_filters_allergens_and_availability(self):
        """
        Allergen conflicts and unavailable items must be excluded before scoring.
        High recommendation scores must never override these hard restrictions.
        """
        profile_with_allergy = dict(self.sample_profile)
        profile_with_allergy["allergens"] = "kacang"

        self.assertFalse(passes_hard_filters(self.sample_dish_allergens, profile_with_allergy))
        self.assertFalse(passes_hard_filters(self.sample_dish_unavailable, self.sample_profile))
        self.assertTrue(passes_hard_filters(self.sample_dish_1, profile_with_allergy))

        # In ranking, excluded dishes must not appear
        ranked = rank_recommendations(
            [self.sample_dish_1, self.sample_dish_allergens, self.sample_dish_unavailable],
            profile_with_allergy,
            variance_map={"DISH-001": 1.0, "DISH-003": 1.0, "DISH-004": 1.0}
        )
        ranked_ids = [d["id"] for d in ranked]
        self.assertIn("DISH-001", ranked_ids)
        self.assertNotIn("DISH-003", ranked_ids)
        self.assertNotIn("DISH-004", ranked_ids)

    def test_ranking_order_descending(self):
        """
        Eligible menu items must be sorted in descending order of recommendation score.
        """
        items = [self.sample_dish_2, self.sample_dish_1]
        variance_map = {"DISH-001": 1.0, "DISH-002": 1.0}
        ranked = rank_recommendations(items, self.sample_profile, variance_map=variance_map)

        self.assertEqual(len(ranked), 2)
        # DISH-001 has higher score than DISH-002 for fitness profile
        self.assertGreater(ranked[0]["recommendation_score"], ranked[1]["recommendation_score"])
        self.assertEqual(ranked[0]["id"], "DISH-001")
        self.assertEqual(ranked[1]["id"], "DISH-002")

    def test_threshold_and_top_10_limit(self):
        """
        Recommendations should only include dishes with score >= 0.70 and capped at top 10.
        """
        mock_dishes = []
        for i in range(15):
            d = dict(self.sample_dish_1)
            d["id"] = f"DISH-{i + 100}"
            d["name"] = f"Menu {i + 1}"
            d["discounted_price_idr"] = 20000 + i * 4000
            mock_dishes.append(d)

        variance_map = {d["id"]: 1.0 for d in mock_dishes}
        result = rank_recommendations(
            mock_dishes,
            self.sample_profile,
            variance_map=variance_map,
            min_score=0.70,
            limit=10
        )

        self.assertLessEqual(len(result), 10)
        for it in result:
            self.assertGreaterEqual(it["recommendation_score"], 0.70)

if __name__ == "__main__":
    unittest.main()
