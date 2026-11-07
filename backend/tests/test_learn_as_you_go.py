import unittest
from backend.app.services.memory_extractor import extract_fallback_candidates, _is_text_duplicate
from backend.app.services.profile_actions import parse_change

class TestLearnAsYouGo(unittest.TestCase):
    def test_negation(self):
        self.assertIsNone(parse_change("Saya tidak alergi udang"))
        self.assertEqual(extract_fallback_candidates([{"role": "user", "content": "Saya tidak alergi udang"}]), [])
    def test_third_party(self):
        self.assertIsNone(parse_change("Ibu saya diabetes"))
        self.assertEqual(extract_fallback_candidates([{"role": "user", "content": "Ibu saya diabetes"}]), [])
    def test_temporary_habits_not_durable(self):
        self.assertEqual(extract_fallback_candidates([{"role": "user", "content": "half rice today"}]), [])
    def test_assistant_not_evidence(self):
        self.assertEqual(extract_fallback_candidates([{"role": "assistant", "content": "Saya tidak suka ayam"}]), [])
    def test_exact_preference_candidate(self):
        self.assertEqual(extract_fallback_candidates([{"role": "user", "content": "Saya tidak suka ayam"}])[0]["category"], "preference")
    def test_allergy_proposed_not_extracted(self):
        self.assertEqual(parse_change("I'm allergic to shrimp"), ("allergy:udang", True))
        self.assertEqual(extract_fallback_candidates([{"role": "user", "content": "Saya alergi udang"}]), [])
    def test_budget(self):
        self.assertEqual(parse_change("My lunch budget is now Rp60,000"), ("meal_budget_idr", 60000))
        self.assertEqual(parse_change("my usual budget is Rp30,000"), ("meal_budget_idr", 30000))
    def test_deduplication(self):
        self.assertTrue(_is_text_duplicate("Alergi terhadap udang", ["Alergi terhadap udang."]))
