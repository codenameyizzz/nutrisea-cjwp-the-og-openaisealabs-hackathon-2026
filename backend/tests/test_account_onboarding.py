"""New and returning accounts follow the same persisted onboarding contract."""
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import users, personas
from backend.app.core.database import Base, get_db
from backend.app.core.ingredient_auth import IngredientPrincipal, current_principal
from backend.app.models import AppUser, Persona, HealthProfile, UserMemoryItem


class AccountOnboardingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(self.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(self.engine)
        self.principal = IngredientPrincipal("user-new", "CONSUMER")
        app = FastAPI()
        app.include_router(users.router)
        app.include_router(personas.router)
        def database():
            with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[current_principal] = lambda: self.principal
        self.client = TestClient(app)
        with self.sessions() as db:
            # Reference data intentionally differs from the entered user profile.
            db.add(Persona(id="REFERENCE-1", full_name="Reference person", archetype_code="CORP_OVERLOADED",
                archetype_name="Corporate", age=55, gender="perempuan", occupation="Reference occupation",
                work_district="SCBD", monthly_income_idr=10000000, activity_level="LIGHT", height_cm=150,
                weight_kg=90, bmi_value=40, bmi_category="reference", bmr_kcal=1800, tdee_kcal=2500,
                daily_caloric_target_kcal=2200, target_lunch_kcal=700, target_lunch_budget_idr=60000,
                health_goal="MAINTAIN", medical_conditions="HYPERTENSION", allergens="PEANUT"))
            db.commit()
        self.profile = {"age": 29, "sex": "M", "height_cm": 178, "weight_kg": 72,
            "occupation": "Engineer", "goal": "LOSE_WEIGHT", "allergies": [], "meal_budget_idr": 30000}
        self.selection = {"main_persona_id": "REFERENCE-1", "side_persona_ids": [], "profile": self.profile}

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def sync(self):
        response = self.client.post("/api/users/sync", json={"user_id": self.principal.user_id, "name": "New customer"})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_new_customer_completes_form_and_returns_without_repeating_onboarding(self):
        account = self.sync()
        self.assertFalse(account["onboarding_complete"])
        self.assertIsNone(account["main_persona_id"])
        self.assertIsNone(account["profile"])
        self.assertEqual(account["user"]["role"], "CONSUMER")
        response = self.client.post("/api/personas/users/user-new/assign", json=self.selection)
        self.assertEqual(response.status_code, 200, response.text)
        account = self.sync()
        self.assertTrue(account["onboarding_complete"])
        self.assertEqual(account["profile"]["age"], 29)
        self.assertEqual(account["profile"]["height_cm"], 178)
        self.assertEqual(account["profile"]["occupation"], "Engineer")
        self.assertFalse(account["profile"]["has_medical_condition"])
        self.assertEqual(account["profile"]["allergies"], [])
        with self.sessions() as db:
            facts = " ".join(db.scalars(select(UserMemoryItem.fact_text)))
            self.assertNotIn("HYPERTENSION", facts)
            self.assertNotIn("PEANUT", facts)
            db.get(AppUser, "user-new").streak_days = 9
            db.commit()
        self.sync()
        with self.sessions() as db:
            self.assertEqual(db.get(AppUser, "user-new").streak_days, 9)

    def test_explicit_dietary_answers_roundtrip_without_becoming_a_diagnosis(self):
        self.sync()
        selection = {**self.selection, "dietary_needs": ["I need to limit salt.", "I need food that is gentle on my stomach."],
            "dietary_guidance": "personal", "allergy_status": "undisclosed"}
        self.assertEqual(self.client.post("/api/personas/users/user-new/assign", json=selection).status_code, 200)
        account = self.sync()
        self.assertCountEqual(account["dietary_needs"], selection["dietary_needs"])
        self.assertEqual(account["dietary_guidance"], "personal")
        self.assertEqual(account["allergy_status"], "undisclosed")
        self.assertFalse(account["profile"]["has_medical_condition"])
        self.assertEqual(self.client.post("/api/personas/users/user-new/assign", json=self.selection).status_code, 200)
        self.assertCountEqual(self.sync()["dietary_needs"], selection["dietary_needs"])

    def test_undisclosed_answers_preserve_existing_allergies_and_unknown_state(self):
        account = self.sync()
        self.assertIsNone(account["dietary_needs"])
        self.assertIsNone(account["allergy_status"])
        known = {**self.selection, "profile": {**self.profile, "allergies": ["egg"], "has_medical_condition": True}, "allergy_status": "reported"}
        self.assertEqual(self.client.post("/api/personas/users/user-new/assign", json=known).status_code, 200)
        hidden = {**self.selection, "allergy_status": "undisclosed"}
        self.assertEqual(self.client.post("/api/personas/users/user-new/assign", json=hidden).status_code, 200)
        profile = self.sync()["profile"]
        self.assertEqual(profile["allergies"], ["egg"])
        self.assertTrue(profile["has_medical_condition"])
        self.assertEqual(self.client.get("/api/users/user-new/health-profile").json()["occupation"], "Engineer")

    def test_switching_accounts_never_reuses_the_previous_persona_or_profile(self):
        self.sync()
        self.client.post("/api/personas/users/user-new/assign", json=self.selection)
        self.principal = IngredientPrincipal("user-other", "CONSUMER")
        other = self.sync()
        self.assertFalse(other["onboarding_complete"])
        self.assertIsNone(other["profile"])
        self.assertIsNone(other["main_persona_id"])
        for path in ("/api/personas/users/user-new/personas", "/api/users/user-new/health-profile"):
            self.assertEqual(self.client.get(path).status_code, 403)

    def test_reference_persona_cannot_silently_seed_an_unentered_health_profile(self):
        self.sync()
        response = self.client.post("/api/personas/users/user-new/assign", json={"main_persona_id": "REFERENCE-1"})
        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.sync()["onboarding_complete"])

    def test_failure_after_profile_write_rolls_back_the_entire_onboarding(self):
        self.sync()
        with patch.object(UserMemoryItem, "__init__", side_effect=RuntimeError("Storage failure")):
            with self.assertRaises(RuntimeError):
                self.client.post("/api/personas/users/user-new/assign", json=self.selection)
        with self.sessions() as db:
            self.assertIsNone(db.get(HealthProfile, "user-new"))
            self.assertIsNone(db.get(AppUser, "user-new").main_persona_id)
        self.assertEqual(self.client.post("/api/personas/users/user-new/assign", json=self.selection).status_code, 200)

    def test_invalid_side_persona_changes_nothing(self):
        self.sync()
        response = self.client.post("/api/personas/users/user-new/assign", json={**self.selection, "side_persona_ids": ["missing"]})
        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.sync()["onboarding_complete"])

    def test_incomplete_customer_cannot_skip_onboarding_to_place_an_order(self):
        self.sync()
        with patch("backend.app.api.users.crud.create_order") as create:
            response = self.client.post("/api/users/user-new/orders", json={"merchant_id": "test", "total_idr": 25000, "items": []})
        self.assertEqual(response.status_code, 409)
        create.assert_not_called()
