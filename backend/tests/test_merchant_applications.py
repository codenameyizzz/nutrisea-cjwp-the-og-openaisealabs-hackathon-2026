import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine, select, func, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import merchant_applications, ingredients, merchant
from backend.app.core.database import Base, get_db
from backend.app.core.ingredient_auth import IngredientPrincipal, current_principal
from backend.app.models import Merchant, Restaurant, AppUser, UserRole
from backend.app.models.merchant_application import MerchantApplication


class MerchantApplicationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(self.engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(self.engine)
        self.principal = IngredientPrincipal("applicant", "CONSUMER")
        self.grant = patch("backend.app.api.merchant_applications.grant_merchant_access")
        self.grant_mock = self.grant.start()
        self.addCleanup(self.grant.stop)
        self.app = FastAPI()
        for router in (merchant_applications.router, merchant_applications.admin_router, ingredients.router, merchant.router):
            self.app.include_router(router)
        def db():
            with self.sessions() as session:
                yield session
        self.app.dependency_overrides[get_db] = db
        self.app.dependency_overrides[current_principal] = lambda: self.principal
        self.client = TestClient(self.app)
        self.payload = {"business_name": "Warung Uji", "owner_name": "Pemilik Uji", "contact_email": "uji@example.test",
                        "contact_phone": "081234567890", "area": "Kuningan", "address": "Jalan Uji nomor 12", "cuisine_type": "Masakan rumahan"}

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def submit(self):
        response = self.client.post("/api/merchant-applications/me", json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["application"]

    def review(self, application, decision="APPROVED", reason=""):
        self.principal = IngredientPrincipal("reviewer", "SHOPEE_ADMIN")
        return self.client.post(f"/api/admin/merchant-applications/{application['id']}/review", json={
            "decision": decision, "reason": reason, "expected_updated_at": application["updated_at"]})

    def test_submit_is_pending_and_grants_no_merchant_access(self):
        self.assertIsNone(self.client.get("/api/merchant-applications/me").json()["application"])
        application = self.submit()
        self.assertEqual(application["status"], "PENDING")
        self.assertIsNone(application["merchant_id"])
        self.assertFalse(self.client.get("/api/ingredients/access").json()["can_edit_menus"])
        self.assertEqual(self.client.get("/api/merchant/dishes").status_code, 403)
        self.assertEqual(self.client.post("/api/merchant-applications/me", json=self.payload).status_code, 409)

    def test_approval_creates_owned_merchant_and_initial_outlet_once(self):
        application = self.submit()
        response = self.review(application)
        self.assertEqual(response.status_code, 200, response.text)
        approved = response.json()["application"]
        self.assertEqual(approved["status"], "APPROVED")
        self.assertEqual(self.review(application).json()["application"]["merchant_id"], approved["merchant_id"])
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Merchant)), 1)
            self.assertEqual(db.scalar(select(func.count()).select_from(Restaurant)), 1)
            outlet = db.scalar(select(Restaurant))
            self.assertEqual(outlet.merchant_id, approved["merchant_id"])
            self.assertFalse(outlet.is_verified_hygiene)
            self.assertFalse(outlet.is_open)
            self.assertEqual(db.get(MerchantApplication, application["id"]).reviewed_by, "reviewer")
        self.assertEqual(self.review(application, "REJECTED", "Changed mind").status_code, 409)

    def test_approved_database_assignment_cannot_enrich_consumer_session(self):
        application = self.submit()
        merchant_id = self.review(application).json()["application"]["merchant_id"]
        self.app.dependency_overrides.pop(current_principal)
        with patch("backend.app.core.ingredient_auth.verify_session", return_value=IngredientPrincipal("applicant", "CONSUMER")):
            headers = {"Authorization": "Bearer test-token"}
            access = self.client.get("/api/ingredients/access", headers=headers).json()
            self.assertEqual(access["role"], "CONSUMER")
            self.assertEqual(access["merchant_ids"], [])
            self.assertFalse(access["can_edit_menus"])
            outlets = self.client.get("/api/merchant/outlets", headers=headers)
            self.assertEqual(outlets.status_code, 403)
        with patch("backend.app.core.ingredient_auth.verify_session", return_value=IngredientPrincipal("applicant", "MERCHANT_ADMIN", (merchant_id,))):
            self.assertEqual(self.client.get("/api/merchant/outlets", headers=headers).status_code, 200)
        with patch("backend.app.core.ingredient_auth.verify_session", return_value=IngredientPrincipal("other", "CONSUMER")):
            self.assertFalse(self.client.get("/api/ingredients/access", headers=headers).json()["can_edit_menus"])

    def test_approval_publishes_access_to_clerk_without_assigning_database_role(self):
        with self.sessions() as db:
            db.add(AppUser(id="applicant", name="Applicant", role=UserRole.CONSUMER))
            db.commit()
        self.assertEqual(self.review(self.submit()).status_code, 200)
        with self.sessions() as db:
            self.assertEqual(db.get(AppUser, "applicant").role, UserRole.CONSUMER)
            merchant_id = db.scalar(select(MerchantApplication.merchant_id))
        self.grant_mock.assert_called_once_with("applicant", merchant_id)

    def test_clerk_failure_is_retryable_without_creating_another_merchant(self):
        from fastapi import HTTPException
        application = self.submit()
        self.grant_mock.side_effect = HTTPException(503, "Clerk unavailable")
        self.assertEqual(self.review(application).status_code, 503)
        with self.sessions() as db:
            row = db.get(MerchantApplication, application["id"])
            self.assertEqual(row.status, "APPROVED")
            merchant_id = row.merchant_id
        self.grant_mock.side_effect = None
        self.assertEqual(self.review(application).status_code, 200)
        self.grant_mock.assert_called_with("applicant", merchant_id)
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Merchant)), 1)

    def test_only_admin_can_list_and_review(self):
        application = self.submit()
        self.assertEqual(self.client.get("/api/admin/merchant-applications").status_code, 403)
        self.assertEqual(self.client.post(f"/api/admin/merchant-applications/{application['id']}/review", json={
            "decision": "APPROVED", "expected_updated_at": application["updated_at"]}).status_code, 403)

    def test_applicant_cannot_read_another_application(self):
        self.submit()
        self.principal = IngredientPrincipal("other", "CONSUMER")
        self.assertIsNone(self.client.get("/api/merchant-applications/me").json()["application"])
        self.assertEqual(self.client.get("/api/merchant-applications/applicant").status_code, 404)

    def test_rejection_reason_required_and_reapplication_supported(self):
        application = self.submit()
        self.assertEqual(self.review(application, "REJECTED").status_code, 422)
        rejected = self.review(application, "REJECTED", "Alamat perlu dilengkapi")
        self.assertEqual(rejected.status_code, 200)
        self.principal = IngredientPrincipal("applicant", "CONSUMER")
        self.payload["address"] = "Jalan Uji nomor 123, Jakarta"
        resubmitted = self.submit()
        self.assertEqual(resubmitted["id"], application["id"])
        self.assertIsNone(resubmitted["review_reason"])
        self.assertEqual(self.review(application).status_code, 409)  # Stale admin snapshot.
        self.assertEqual(self.review(resubmitted).status_code, 200)

    def test_review_failure_rolls_back_merchant_and_application_together(self):
        application = self.submit()
        self.principal = IngredientPrincipal("reviewer", "SHOPEE_ADMIN")
        with patch("backend.app.api.merchant_applications.Restaurant", side_effect=RuntimeError("Simulated failure")):
            with self.assertRaises(RuntimeError):
                self.review(application)
        with self.sessions() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Merchant)), 0)
            self.assertEqual(db.get(MerchantApplication, application["id"]).status, "PENDING")

    def test_cannot_submit_role_or_another_user_id(self):
        for extra in ({"user_id": "other"}, {"status": "APPROVED"}, {"merchant_id": "MTR-other"}, {"role": "SHOPEE_ADMIN"}):
            self.assertEqual(self.client.post("/api/merchant-applications/me", json={**self.payload, **extra}).status_code, 422)

    def test_blank_fields_and_invalid_contact_rejected(self):
        for changes in ({"business_name": "  "}, {"contact_email": "bad"}, {"contact_phone": "abcdefgh"}):
            self.assertEqual(self.client.post("/api/merchant-applications/me", json={**self.payload, **changes}).status_code, 422)

    def test_login_required(self):
        self.app.dependency_overrides.pop(current_principal)
        self.assertEqual(self.client.get("/api/merchant-applications/me").status_code, 401)
        self.assertEqual(self.client.post("/api/merchant-applications/me", json=self.payload).status_code, 401)

    def test_admin_can_filter_and_paginate_applications(self):
        application = self.submit()
        self.principal = IngredientPrincipal("reviewer", "SHOPEE_ADMIN")
        result = self.client.get("/api/admin/merchant-applications").json()
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["id"], application["id"])
        self.assertEqual(self.client.get("/api/admin/merchant-applications?page=2").json()["items"], [])
        self.assertEqual(self.client.get("/api/admin/merchant-applications?status=APPROVED").json()["total"], 0)
