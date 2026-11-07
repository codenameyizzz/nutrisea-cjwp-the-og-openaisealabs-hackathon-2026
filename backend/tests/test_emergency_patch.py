import os
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal, create_all_tables
from backend.app.core.ingredient_auth import IngredientPrincipal, current_principal
from backend.app.db import crud
from backend.app.main import app
from backend.app.models.menu_item import MenuItem
from backend.app.models.merchant import Merchant
from backend.app.services import profile_actions as actions
from backend.app.services.recommendation_scorer import passes_hard_filters


DISCLOSURE = "I think ive developed an alergic reaction to eggs"
FOLLOWUP = "Did you update my profile informationthat im alergic to eggs"
BUDGET = "My usual lunch budget is Rp30,000"


class EmergencyParserTests(unittest.TestCase):
    def test_possible_allergy_variants(self):
        for text in [
            DISCLOSURE,
            "I think I may be allergic to eggs",
            "I've developed an allergic reaction to eggs",
            "saya mungkin alergi telur",
        ]:
            with self.subTest(text=text):
                self.assertEqual(actions.parse_change(text), ("allergy:telur", True))
                self.assertEqual(actions.parse_allergy_statement(text),
                                 {"allergen": "telur", "certainty": "possible"})

    def test_self_reported_allergy_aliases(self):
        for text in ["im alergic to eggs", "I'm allergic to egg", "Saya alergi telur"]:
            with self.subTest(text=text):
                self.assertEqual(actions.parse_change(text), ("allergy:telur", True))
                self.assertEqual(actions.parse_allergy_statement(text)["certainty"], "self_reported")

    def test_questions_negation_third_parties_and_hypotheticals_are_not_facts(self):
        for text in [
            FOLLOWUP, "I'm not allergic to eggs", "My sister is allergic to eggs",
            "If I were allergic to eggs, what could I eat?", "I'm no longer allergic to eggs",
            "Saya tidak alergi telur", "My sister thinks I'm allergic to eggs",
        ]:
            with self.subTest(text=text):
                self.assertIsNone(actions.parse_change(text))
                self.assertIsNone(actions.parse_allergy_statement(text))

    def test_usual_lunch_budget(self):
        self.assertEqual(actions.parse_change(BUDGET), ("meal_budget_idr", 30000))

    def test_allergen_aliases_match_on_both_sides(self):
        for user_allergen in ["egg", "eggs", "telur"]:
            for item_allergen in ["egg", "eggs", "telur"]:
                with self.subTest(user=user_allergen, item=item_allergen):
                    item = {"name": "Synthetic dish", "isAvailable": True,
                            "allergenCoverage": "complete", "allergens": [item_allergen]}
                    self.assertFalse(passes_hard_filters(item, {"allergens": [user_allergen]}))

    def test_unknown_coverage_never_establishes_allergy_safety(self):
        item = {"name": "Synthetic dish", "isAvailable": True,
                "allergenCoverage": "unknown", "allergens": []}
        for allergen in ["egg", "eggs", "telur"]:
            with self.subTest(allergen=allergen):
                self.assertFalse(passes_hard_filters(item, {"allergens": [allergen]}))


class EmergencyChatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get("NUTRISEA_TESTING") != "1" or not settings.DATABASE_URL.startswith("sqlite:///"):
            raise RuntimeError("Run with scripts/run_backend_tests.py using disposable SQLite storage")
        create_all_tables()
        with SessionLocal() as db:
            db.add(Merchant(id="EP-M", name="Synthetic emergency test", area="Test", is_open=True))
            for ident, name, price in [("EP-A", "Synthetic steamed meal", 20000),
                                       ("EP-B", "Synthetic lunch", 28000)]:
                db.add(MenuItem(id=ident, name=name, merchant_id="EP-M", base_price_idr=price,
                    discounted_price_idr=price, kcal=400, protein_g=20, carbs_g=40,
                    fat_g=10, sodium_mg=300, is_available=True))
            db.commit()

    def setUp(self):
        self.uid = "emergency-" + uuid.uuid4().hex[:12]
        principal = IngredientPrincipal(self.uid, "CONSUMER")
        app.dependency_overrides[current_principal] = lambda: principal
        self.addCleanup(app.dependency_overrides.pop, current_principal, None)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        with SessionLocal() as db:
            crud.upsert_user(db, self.uid, name="Synthetic", consent_health_data=True)
            crud.upsert_health_profile(db, self.uid, {"age": 25, "sex": "F", "height_cm": 160,
                "weight_kg": 55, "meal_budget_idr": 25000})
        for patcher in [patch.object(settings, "OPENAI_API_KEY", ""),
                        patch("backend.app.api.preferences.MealPlannerAgent.plan_lunch", return_value={})]:
            patcher.start()
            self.addCleanup(patcher.stop)
        provider = patch("backend.app.api.chat.get_openai_client", side_effect=AssertionError("No external model calls"))
        self.provider = provider.start()
        self.addCleanup(provider.stop)
        self.addCleanup(self.provider.assert_not_called)

    def say(self, message):
        response = self.client.post("/api/ai/chat", json={"message": message})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def recommendation(self):
        response = self.client.get("/api/preferences/recommendation")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def canonical(self):
        with SessionLocal() as db:
            profile = crud.get_health_profile(db, self.uid)
            return {"allergies": list(profile.allergies or []), "budget": profile.meal_budget_idr}

    def confirm(self, action, choice):
        response = self.client.post(f"/api/ai/actions/{action['action_id']}/confirm", json={"choice": choice})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("Catalog suggestion:", response.json()["reply"])
        return response.json()

    def test_exact_incident_precaution_followup_then_permanent(self):
        result = self.say(DISCLOSURE)
        action = result["pending_actions"][0]
        self.assertEqual(action["field"], "allergy:telur")
        self.assertEqual(self.canonical()["allergies"], [])
        self.assertIsNone(result["recommendation"])
        self.assertNotIn("Catalog suggestion:", result["reply"])
        self.assertIn("precaution", result["reply"].lower())
        self.assertRegex(result["reply"].lower(), r"urgent|emergency")
        rec = self.recommendation()
        self.assertEqual(rec["effective_profile"]["allergies"], ["telur"])
        self.assertEqual(rec["candidate_ids"], [])
        followup = self.say(FOLLOWUP)
        self.assertEqual([x["action_id"] for x in followup["pending_actions"]], [action["action_id"]])
        self.assertRegex(followup["reply"].lower(), r"pending|not.*saved|not.*updated|unchanged")
        self.assertNotIn("Catalog suggestion:", followup["reply"])
        self.assertEqual(self.canonical()["allergies"], [])
        self.confirm(action, "permanent")
        self.assertEqual(self.canonical()["allergies"], ["telur"])
        saved = self.say(FOLLOWUP)
        self.assertRegex(saved["reply"].lower(), r"saved|permanent")
        self.assertEqual(saved["pending_actions"], [])
        self.assertIsNone(saved["recommendation"])

    def test_allergy_today_keeps_canonical_unchanged(self):
        action = self.say(DISCLOSURE)["pending_actions"][0]
        self.confirm(action, "today")
        self.assertEqual(self.canonical()["allergies"], [])
        self.assertEqual(self.recommendation()["effective_profile"]["allergies"], ["telur"])
        self.assertRegex(self.say(FOLLOWUP)["reply"].lower(), r"temporary|today|midnight")

    def test_reject_removes_pending_precaution(self):
        action = self.say(DISCLOSURE)["pending_actions"][0]
        self.confirm(action, "reject")
        self.assertEqual(self.canonical()["allergies"], [])
        self.assertEqual(self.recommendation()["effective_profile"]["allergies"], [])

    def test_budget_permanent_refreshes_live_catalog(self):
        self.assertNotIn("EP-B", self.recommendation()["candidate_ids"])
        result = self.say(BUDGET)
        action = result["pending_actions"][0]
        self.assertTrue(result["profile_changed"])
        self.assertEqual(action["old_value"], 25000)
        self.assertEqual(action["proposed_value"], 30000)
        self.assertEqual(self.canonical()["budget"], 25000)
        self.confirm(action, "permanent")
        self.assertEqual(self.canonical()["budget"], 30000)
        refreshed = self.recommendation()
        self.assertEqual(refreshed["effective_profile"]["meal_budget_idr"], 30000)
        self.assertIn("EP-B", refreshed["candidate_ids"])

    def test_budget_today_and_cancel_preserve_canonical(self):
        action = self.say(BUDGET)["pending_actions"][0]
        self.confirm(action, "reject")
        self.assertEqual(self.canonical()["budget"], 25000)
        self.assertNotIn("EP-B", self.recommendation()["candidate_ids"])
        action = self.say(BUDGET)["pending_actions"][0]
        self.confirm(action, "today")
        self.assertEqual(self.canonical()["budget"], 25000)
        self.assertEqual(self.recommendation()["effective_profile"]["meal_budget_idr"], 30000)
        self.assertIn("EP-B", self.recommendation()["candidate_ids"])

    def test_nonshopping_messages_do_not_retrieve_or_append_food(self):
        with patch("backend.app.api.chat.personalized_recommendation") as retrieve:
            for text in ["Thanks", "Did you update my profile?", "I have a stomach ache", "yes", FOLLOWUP]:
                with self.subTest(text=text):
                    result = self.say(text)
                    self.assertIsNone(result["recommendation"])
                    self.assertNotIn("Catalog suggestion:", result["reply"])
            retrieve.assert_not_called()

    def test_food_request_uses_live_catalog_and_respects_precaution(self):
        response = self.say("What can I eat for lunch?")
        self.assertIsNotNone(response["recommendation"])
        self.assertIn(response["recommendation"]["id"], self.recommendation()["candidate_ids"])
        self.say(DISCLOSURE)
        restricted = self.say("What can I eat for lunch?")
        self.assertIsNone(restricted["recommendation"])
        self.assertNotIn("Catalog suggestion:", restricted["reply"])

    def test_urgent_symptoms_receive_safety_message_without_food(self):
        result = self.say("I have throat swelling and difficulty breathing after eating eggs")
        self.assertRegex(result["reply"].lower(), r"urgent|emergency")
        self.assertIsNone(result["recommendation"])
        self.assertNotIn("Catalog suggestion:", result["reply"])

    def test_profile_question_does_not_hide_urgent_symptoms(self):
        result = self.say("Did you update my allergy profile? My throat is swelling and I feel faint")
        self.assertIn("urgent medical care", result["reply"])
        self.assertIsNone(result["recommendation"])
        self.assertEqual(self.canonical()["allergies"], [])

    def test_existing_profile_egg_alias_is_effective_and_not_duplicated(self):
        with SessionLocal() as db:
            crud.get_health_profile(db, self.uid).allergies = ["eggs"]
            db.commit()
        self.assertEqual(self.recommendation()["effective_profile"]["allergies"], ["telur"])
        action = self.say("im alergic to eggs")["pending_actions"][0]
        self.assertTrue(action["old_value"])
        self.confirm(action, "permanent")
        self.assertEqual(self.canonical()["allergies"], ["telur"])
