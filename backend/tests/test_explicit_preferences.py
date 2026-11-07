import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal, create_all_tables
from backend.app.core.ingredient_auth import current_principal, IngredientPrincipal
from backend.app.models.menu_item import MenuItem
from backend.app.models.merchant import Merchant
from backend.app.models.user_memory import UserMemoryItem
from backend.app.services.explicit_preferences import parse_preference, preferences


class ExplicitPreferenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        create_all_tables()
        with SessionLocal() as db:
            db.add(Merchant(id="PREF-M", name="Test merchant", area="Test"))
            for ident, name in [("PREF-A", "Ayam bakar"), ("PREF-B", "Tempe kukus")]:
                db.add(MenuItem(id=ident, merchant_id="PREF-M", name=name,
                                base_price_idr=25000, discounted_price_idr=20000,
                                kcal=400, protein_g=20, carbs_g=40, fat_g=10, sodium_mg=300))
            db.commit()

    def setUp(self):
        self.client = TestClient(app)
        self.identity = IngredientPrincipal("preference-alice", "CONSUMER")
        app.dependency_overrides[current_principal] = lambda: self.identity
        self.planner = patch("backend.app.api.preferences.MealPlannerAgent.plan_lunch",
                             return_value={"source": "openai", "menu_item": {"item_id": "invented"}})
        self.planner.start()
        with SessionLocal() as db:
            db.query(UserMemoryItem).filter(UserMemoryItem.user_id.in_([
                "preference-alice", "preference-bob"])).delete(synchronize_session=False)
            db.query(MenuItem).filter(MenuItem.id.in_(["PREF-A", "PREF-B"])).update(
                {MenuItem.is_available: True}, synchronize_session=False)
            db.commit()

    def tearDown(self):
        self.planner.stop()
        app.dependency_overrides.pop(current_principal, None)

    def say(self, text):
        response = self.client.post("/api/preferences", json={"message": text})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def recommendation(self):
        response = self.client.get("/api/preferences/recommendation")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_persist_filter_and_correct(self):
        self.assertIn("PREF-A", self.recommendation()["candidate_ids"])
        self.assertEqual(self.say("Saya tidak suka ayam")["status"], "saved")
        # New DB session and new HTTP client simulate persistence after refresh.
        with SessionLocal() as db:
            self.assertEqual(preferences(db, self.identity.user_id), ["ayam"])
        self.client = TestClient(app)
        result = self.recommendation()
        self.assertNotIn("PREF-A", result["candidate_ids"])
        self.assertIn("PREF-B", result["candidate_ids"])
        self.assertEqual(result["source"], "deterministic")  # hallucinated ID rejected
        self.assertIn(result["dish"]["id"], result["candidate_ids"])
        self.say("Saya suka ayam lagi")
        self.assertIn("PREF-A", self.recommendation()["candidate_ids"])

    def test_isolation_and_spoofed_body_identity(self):
        self.client.post("/api/preferences", json={"message": "Saya tidak suka ayam", "user_id": "preference-bob"})
        self.assertEqual(self.client.get("/api/preferences").json()["excluded_foods"], ["ayam"])
        self.identity = IngredientPrincipal("preference-bob", "CONSUMER")
        self.assertEqual(self.client.get("/api/preferences").json()["excluded_foods"], [])
        self.assertIn("PREF-A", self.recommendation()["candidate_ids"])

    def test_empty_candidates_and_unavailable_menu(self):
        with SessionLocal() as db:
            # Restrict this endpoint's fixture query without modifying other suites' catalog.
            items = db.query(MenuItem).filter(MenuItem.id.in_(["PREF-A", "PREF-B"])).all()
            for item in items:
                item.is_available = False
            db.commit()
        result = self.recommendation()
        self.assertNotIn("PREF-A", result["candidate_ids"])
        self.assertNotIn("PREF-B", result["candidate_ids"])
        with patch("backend.app.api.preferences.matches_preference", return_value=False):
            result = self.recommendation()
        self.assertEqual(result["status"], "no_candidates")
        self.assertIsNone(result["dish"])
        self.assertEqual(result["candidate_ids"], [])

    def test_authentication_required(self):
        app.dependency_overrides.pop(current_principal)
        for path in ["/api/preferences", "/api/preferences/recommendation"]:
            self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.post("/api/preferences", json={"message": "Saya tidak suka ayam"}).status_code, 401)

    def test_valid_ai_choice_keeps_server_price_and_id(self):
        with patch("backend.app.api.preferences.MealPlannerAgent.plan_lunch", return_value={
            "source": "openai", "selected_meal": {"item_id": "PREF-B", "price_idr": 1}
        }):
            result = self.recommendation()
        self.assertEqual(result["source"], "openai")
        self.assertEqual(result["dish"]["id"], "PREF-B")
        self.assertEqual(result["dish"]["discountedPrice"], 20000)

    def test_only_explicit_durable_preferences(self):
        for text in ["Hari ini saya tidak suka ayam", "Saya tidak suka ayam hari ini",
                     "Apakah saya tidak suka ayam?", "Teman saya tidak suka ayam",
                     "Saya alergi ayam", "Saya tidak suka ayam tapi suka tempe"]:
            self.assertIsNone(parse_preference(text), text)
            self.assertFalse(self.say(text)["recognized"])
        self.assertEqual(self.client.get("/api/preferences").json()["excluded_foods"], [])
        self.say("Saya tidak suka ayam")
        self.say("Saya tidak suka ayam")
        with SessionLocal() as db:
            rows = db.query(UserMemoryItem).filter_by(user_id=self.identity.user_id).all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].category, "preference")


if __name__ == "__main__":
    unittest.main()
