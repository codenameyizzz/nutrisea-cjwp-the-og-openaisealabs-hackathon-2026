"""Role synchronization must never let clients grant themselves permissions."""
import unittest
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import users, admin, personas
from backend.app.core.config import settings
from backend.app.core.database import Base, get_db
from backend.app.core.ingredient_auth import IngredientPrincipal, current_principal, public_metadata, grant_merchant_access
from backend.app.models import AppUser


class AccountAccessTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(self.engine)
        app = FastAPI()
        app.include_router(users.router)
        app.include_router(admin.router)
        app.include_router(personas.router)
        def db():
            with self.sessions() as session:
                yield session
        self.principal = IngredientPrincipal("test-user", "CONSUMER")
        app.dependency_overrides[get_db] = db
        app.dependency_overrides[current_principal] = lambda: self.principal
        self.app = app
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_sync_ignores_client_role_and_persists_authoritative_role(self):
        response = self.client.post("/api/users/sync", json={
            "user_id": "test-user", "name": "Test", "role": "SHOPEE_ADMIN"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["role"], "CONSUMER")
        with self.sessions() as db:
            self.assertEqual(db.get(AppUser, "test-user").role.value, "CONSUMER")

    def test_role_escalation_and_other_account_sync_denied(self):
        for role in ("MERCHANT", "SHOPEE_ADMIN"):
            self.assertEqual(self.client.post("/api/users/test-user/role", json={"role": role}).status_code, 403)
        self.assertEqual(self.client.post("/api/users/sync", json={"user_id": "other", "name": "Test"}).status_code, 403)
        self.assertEqual(self.client.post("/api/users/other/role", json={"role": "CONSUMER"}).status_code, 403)

    def test_admin_endpoints_reject_customer(self):
        self.assertEqual(self.client.get("/api/admin/overview").status_code, 403)

    def test_sync_requires_authentication(self):
        self.app.dependency_overrides.pop(current_principal)
        self.assertEqual(self.client.post("/api/users/sync", json={"user_id": "test-user", "name": "Test"}).status_code, 401)

    def test_merchant_role_is_mirrored_from_assignment(self):
        self.principal = IngredientPrincipal("test-user", "MERCHANT_ADMIN", ("TEST-MERCHANT",))
        response = self.client.post("/api/users/sync", json={"user_id": "test-user", "name": "Test", "role": "CONSUMER"})
        self.assertEqual(response.json()["user"]["role"], "MERCHANT_ADMIN")

    def test_persona_assignment_cannot_change_another_account(self):
        response = self.client.post("/api/personas/users/other/assign", json={
            "main_persona_id": "fake", "role": "SHOPEE_ADMIN"})
        self.assertEqual(response.status_code, 403)
        self.app.dependency_overrides.pop(current_principal)
        self.assertEqual(self.client.post("/api/personas/users/test-user/assign", json={
            "main_persona_id": "fake"}).status_code, 401)

    def test_checkout_requires_login_and_the_callers_own_account(self):
        payload = {"merchant_id": "MTR-test", "total_idr": 25000, "items": []}
        with patch("backend.app.api.users.crud.create_order") as create:
            self.assertEqual(self.client.post("/api/users/other/orders", json=payload).status_code, 403)
            self.app.dependency_overrides.pop(current_principal)
            self.assertEqual(self.client.post("/api/users/test-user/orders", json=payload).status_code, 401)
            create.assert_not_called()


class ClerkMetadataTests(unittest.TestCase):
    @patch.object(settings, "CLERK_SECRET_KEY", "test-secret")
    @patch("backend.app.core.ingredient_auth.httpx.get")
    def test_only_public_metadata_is_used(self, get):
        get.return_value = httpx.Response(200, request=httpx.Request("GET", "https://api.clerk.com"), json={
            "id": "test-user", "public_metadata": {}, "unsafe_metadata": {"role": "SHOPEE_ADMIN"}})
        self.assertEqual(public_metadata("test-user"), {})

    @patch.object(settings, "CLERK_SECRET_KEY", "test-secret")
    @patch("backend.app.core.ingredient_auth.httpx.get")
    def test_clerk_outage_fails_closed(self, get):
        from fastapi import HTTPException
        get.side_effect = httpx.ConnectError("Unavailable")
        with self.assertRaises(HTTPException) as error:
            public_metadata("test-user")
        self.assertEqual(error.exception.status_code, 503)


class ClerkMerchantPublicationTests(unittest.TestCase):
    @patch("backend.app.core.ingredient_auth.httpx.patch")
    @patch("backend.app.core.ingredient_auth.public_metadata")
    def test_merge_deduplicates_and_preserves_admin_role(self, metadata, update):
        metadata.return_value = {"role": "SHOPEE_ADMIN", "merchant_ids": ["MTR-existing", "MTR-new"]}
        update.return_value = httpx.Response(200, request=httpx.Request("PATCH", "https://api.clerk.com"))
        grant_merchant_access("test-user", "MTR-new")
        self.assertEqual(update.call_args.kwargs["json"], {"public_metadata": {
            "role": "SHOPEE_ADMIN", "merchant_ids": ["MTR-existing", "MTR-new"]}})

    @patch("backend.app.core.ingredient_auth.httpx.patch")
    @patch("backend.app.core.ingredient_auth.public_metadata", return_value={})
    def test_empty_metadata_is_assigned_merchant_and_clerk_failure_is_explicit(self, metadata, update):
        from fastapi import HTTPException
        update.side_effect = httpx.ConnectError("Unavailable")
        with self.assertRaises(HTTPException) as error:
            grant_merchant_access("test-user", "MTR-new")
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(update.call_args.kwargs["json"], {"public_metadata": {
            "role": "MERCHANT_ADMIN", "merchant_ids": ["MTR-new"]}})
