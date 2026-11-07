import json
import os
from pathlib import Path
import time
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

if os.getenv("NUTRISEA_TESTING") != "1":
    raise RuntimeError("Use python scripts/run_backend_tests.py; never run against the configured database")

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api import ingredients, merchant
from backend.app.core.config import settings
from backend.app.core.database import Base, get_db
from backend.app.core.ingredient_auth import IngredientPrincipal, current_principal, verify_session
from backend.app.db import crud
from backend.app.models import Merchant, Restaurant, MenuItem
from backend.app.models.ingredient import Ingredient, MenuIngredient
from backend.app.services.ingredients import recipe_version


class IngredientApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        event.listen(self.engine, "connect", lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)  # Disposable SQLite only; never migration or connected PostgreSQL.
        self.sessions = sessionmaker(self.engine)
        self.db = self.sessions()
        self.app = FastAPI()
        self.app.include_router(ingredients.router)
        self.app.include_router(ingredients.menu_router)
        self.app.include_router(merchant.router)
        def test_db():
            session = self.sessions()
            try:
                yield session
            finally:
                session.rollback()
                session.close()
        self.app.dependency_overrides[get_db] = test_db
        self.principal = IngredientPrincipal("test-admin", "SHOPEE_ADMIN")
        self.app.dependency_overrides[current_principal] = lambda: self.principal
        self.client = TestClient(self.app)
        for key in ("TEST-MERCHANT-A", "TEST-MERCHANT-B"):
            self.db.add(Merchant(id=key, name=key, area="Test"))
        self.db.commit()
        self.menu = crud.upsert_menu_item(self.db, {
            "id": "TEST-MENU", "name": "Menu uji", "merchant_id": "TEST-MERCHANT-A",
            "base_price_idr": 10000, "discounted_price_idr": 10000, "kcal": 100, "tags": ["TEST_TAG"],
        })

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def create(self, name="Bawang Merah", **values):
        res = self.client.post("/api/ingredients", json={"name": name, **values})
        self.assertEqual(res.status_code, 201, res.text)
        return res.json()

    def recipe(self):
        res = self.client.get("/api/dishes/TEST-MENU/ingredients")
        self.assertEqual(res.status_code, 200, res.text)
        return res.json()

    def test_case_insensitive_search_prefix_substring_alias_ranking(self):
        substring = self.create("Daun Bawang")
        prefix = self.create("Bawang Putih", aliases=["Garlic"])
        exact = self.create("Bawang")
        result = self.client.get("/api/ingredients", params={"search": "BAWANG", "limit": 8})
        self.assertEqual([v["id"] for v in result.json()["items"]], [exact["id"], prefix["id"], substring["id"]])
        self.assertEqual(self.client.get("/api/ingredients?search=garL").json()["items"][0]["id"], prefix["id"])
        self.assertEqual(self.client.get("/api/ingredients?search=b").json()["total"], 3)

    def test_search_wildcards_and_sql_injection_are_literal(self):
        self.create()
        special = self.create("Bumbu 100%_!")
        for value in ["%", "_", "!"]:
            self.assertEqual(self.client.get("/api/ingredients", params={"search": value}).json()["items"][0]["id"], special["id"])
        self.assertEqual(self.client.get("/api/ingredients", params={"search": "' OR 1=1 --"}).json()["total"], 0)

    def test_search_pagination_order_and_alias_deduplication(self):
        self.create("Bawang B", aliases=["ba", "bawang bumbu"])
        self.create("Bawang A")
        result = self.client.get("/api/ingredients?search=bawang&limit=1&page=1").json()
        self.assertEqual(result["items"][0]["name"], "Bawang A")
        self.assertEqual(result["total"], 2)
        self.assertTrue(result["has_more"])
        self.assertEqual(self.client.get("/api/ingredients?search=bawang&limit=1&page=2").json()["items"][0]["name"], "Bawang B")

    def test_duplicate_normalized_name_and_alias_input(self):
        self.create("  Bawang   Merah ")
        self.assertEqual(self.client.post("/api/ingredients", json={"name": "BAWANG MERAH"}).status_code, 409)
        self.assertEqual(self.client.post("/api/ingredients", json={"name": "Garam", "aliases": ["salt", "SALT"]}).status_code, 422)

    def test_input_validation(self):
        for body in [{"name": " "}, {"name": "X", "default_unit": "bad"}, {"name": "X", "category": " "}, {"name": "x" * 151}]:
            self.assertEqual(self.client.post("/api/ingredients", json=body).status_code, 422)
        for query in ["limit=0", "limit=51", "page=0", "search=" + "x" * 81]:
            self.assertEqual(self.client.get("/api/ingredients?" + query).status_code, 422)
        self.assertEqual(self.client.get("/api/ingredients", params={"search": "\x00"}).status_code, 422)
        for name in ["\x00", "\ufb04" * 100]:
            self.assertEqual(self.client.post("/api/ingredients", json={"name": name}).status_code, 422)

    def test_auth_missing_and_consumer_forbidden(self):
        self.app.dependency_overrides.pop(current_principal)
        self.assertEqual(self.client.post("/api/ingredients", json={"name": "X"}).status_code, 401)
        self.app.dependency_overrides[current_principal] = lambda: IngredientPrincipal("user", "CONSUMER")
        self.assertEqual(self.client.post("/api/ingredients", json={"name": "X"}).status_code, 403)
        self.assertEqual(self.client.get("/api/ingredients/manage").status_code, 403)
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json={"items": [], "version": recipe_version([])}).status_code, 403)

    def test_deactivate_preserves_relationship_and_reactivate(self):
        ingredient = self.create()
        body = {"items": [{"ingredient_id": ingredient["id"], "quantity": "3.125", "unit": "gram"}], "version": self.recipe()["version"]}
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json=body).status_code, 200)
        self.assertEqual(self.client.delete("/api/ingredients/" + ingredient["id"]).status_code, 200)
        self.assertEqual(self.client.get("/api/ingredients?search=bawang").json()["items"], [])
        self.assertEqual(len(self.recipe()["items"]), 1)
        self.assertFalse(self.recipe()["items"][0]["is_active"])
        self.assertEqual(self.client.get("/api/ingredients/manage").json()["total"], 1)
        self.assertEqual(self.client.put("/api/ingredients/" + ingredient["id"], json={"name": "Bawang Merah", "is_active": True}).status_code, 200)

    def test_update_aliases_repeatedly_and_unique_rename(self):
        first = self.create(aliases=["shallot"])
        other = self.create("Garam")
        for _ in range(2):
            self.assertEqual(self.client.put("/api/ingredients/" + first["id"], json={"name": "Bawang Baru", "aliases": ["shallot", "onion"]}).status_code, 200)
        self.assertEqual(self.client.put("/api/ingredients/" + other["id"], json={"name": "BAWANG BARU"}).status_code, 409)

    def test_recipe_reference_quantity_unit_and_duplicate_validation(self):
        item = self.create()
        line = {"ingredient_id": item["id"], "quantity": "1", "unit": "gram"}
        for invalid in [dict(line, quantity="0"), dict(line, quantity="NaN"), dict(line, quantity="1.0001"), dict(line, unit="bad"), dict(line, ingredient_id="bad")]:
            self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json={"items": [invalid], "version": self.recipe()["version"]}).status_code, 422)
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json={"items": [line, line], "version": self.recipe()["version"]}).status_code, 422)
        invalid = dict(line, ingredient_id="00000000-0000-4000-8000-000000000000")
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json={"items": [invalid], "version": self.recipe()["version"]}).status_code, 422)

    def test_recipe_replace_clear_and_version_conflict(self):
        item = self.create()
        version = self.recipe()["version"]
        body = {"items": [{"ingredient_id": item["id"], "quantity": "2.5", "unit": "pcs"}], "version": version}
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json=body).status_code, 200)
        self.assertEqual(Decimal(self.recipe()["items"][0]["quantity"]), Decimal("2.5"))
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json=body).status_code, 409)
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json={"items": [], "version": self.recipe()["version"]}).status_code, 200)
        self.assertEqual(self.recipe()["items"], [])

    def test_merchant_ownership_and_inactive_reference(self):
        item = self.create()
        self.client.delete("/api/ingredients/" + item["id"])
        body = {"items": [{"ingredient_id": item["id"], "quantity": "1", "unit": "gram"}], "version": self.recipe()["version"]}
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json=body).status_code, 422)
        self.principal = IngredientPrincipal("partner", "MERCHANT_ADMIN", ("TEST-MERCHANT-B",))
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU/ingredients", json=body).status_code, 403)
        self.assertEqual(self.client.delete("/api/merchant/dishes/TEST-MENU").status_code, 403)
        self.assertEqual(self.client.get("/api/merchant/dishes").json()["data"], [])

    def test_atomic_menu_update_rollback_and_omitted_recipe(self):
        data = {"name": "Changed", "price": 12000, "tags": [], "ingredients": {"items": [{"ingredient_id": "00000000-0000-4000-8000-000000000000", "quantity": "1", "unit": "gram"}], "version": recipe_version([])}}
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU", json=data).status_code, 422)
        self.db.expire_all()
        self.assertEqual(self.db.get(MenuItem, "TEST-MENU").name, "Menu uji")
        self.assertEqual(len(self.db.get(MenuItem, "TEST-MENU").tags), 1)
        item = self.create()
        data["ingredients"]["items"][0]["ingredient_id"] = item["id"]
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU", json=data).status_code, 200)
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU", json={"name": "Updated again", "price": 13000}).status_code, 200)
        self.assertEqual(len(self.recipe()["items"]), 1)
        self.db.expire_all()
        self.assertEqual(len(self.db.get(MenuItem, "TEST-MENU").tags), 0)

    def test_menu_create_with_ingredients_collision_and_deactivate(self):
        item = self.create()
        data = {"name": "Created menu", "price": 10000, "merchant_id": "TEST-MERCHANT-A", "ingredients": {"items": [{"ingredient_id": item["id"], "quantity": "1", "unit": "pcs"}], "version": recipe_version([])}}
        res = self.client.post("/api/merchant/dishes", json=data)
        self.assertEqual(res.status_code, 201, res.text)
        menu_id = res.json()["dish"]["id"]
        self.assertLessEqual(len(menu_id), 32)
        self.assertEqual(len(self.client.get(f"/api/dishes/{menu_id}/ingredients").json()["items"]), 1)
        data["id"] = menu_id
        self.assertEqual(self.client.post("/api/merchant/dishes", json=data).status_code, 409)
        self.assertEqual(self.client.delete(f"/api/merchant/dishes/{menu_id}").status_code, 200)
        self.assertEqual(len(self.client.get(f"/api/dishes/{menu_id}/ingredients").json()["items"]), 1)

    def test_database_checks_uniqueness_and_foreign_key(self):
        item = self.create()
        self.db.add(MenuIngredient(menu_item_id="TEST-MENU", ingredient_id=item["id"], quantity=0, unit="gram"))
        with self.assertRaises(IntegrityError): self.db.commit()
        self.db.rollback()
        self.db.add(MenuIngredient(menu_item_id="TEST-MENU", ingredient_id="missing", quantity=1, unit="gram"))
        with self.assertRaises(IntegrityError): self.db.commit()
        self.db.rollback()
        self.db.add(Ingredient(name="Dup", normalized_name="bawang merah"))
        with self.assertRaises(IntegrityError): self.db.commit()
        self.db.rollback()

    def test_cross_merchant_update_and_outlet_are_rejected(self):
        self.db.add(Restaurant(id="TEST-OUTLET-B", merchant_id="TEST-MERCHANT-B", name="Test outlet", brand_name="Test", area="Test"))
        self.db.commit()
        self.principal = IngredientPrincipal("partner", "MERCHANT_ADMIN", ("TEST-MERCHANT-A",))
        self.assertEqual(self.client.get("/api/merchant/outlets?merchant_id=TEST-MERCHANT-B").status_code, 403)
        self.assertEqual(self.client.post("/api/merchant/outlets/TEST-OUTLET-B/toggle-status").status_code, 403)
        response = self.client.put("/api/merchant/dishes/TEST-MENU", json={"name": "Changed", "price": 12000, "restaurant_id": "TEST-OUTLET-B"})
        self.assertEqual(response.status_code, 422)
        self.principal = IngredientPrincipal("partner", "MERCHANT_ADMIN", ("TEST-MERCHANT-B",))
        self.assertEqual(self.client.put("/api/merchant/dishes/TEST-MENU", json={"name": "Changed", "price": 12000}).status_code, 403)

    def test_missing_schema_returns_explicit_503_without_creating_tables(self):
        other = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        def empty_db():
            with sessionmaker(other)() as db: yield db
        self.app.dependency_overrides[get_db] = empty_db
        res = self.client.get("/api/ingredients?search=ba")
        self.assertEqual(res.status_code, 503)
        self.assertIn("persetujuan", res.json()["detail"])
        with other.connect() as connection:
            self.assertEqual(connection.execute(text("SELECT count(*) FROM sqlite_master WHERE type='table'")).scalar(), 0)
        other.dispose()


class ClerkVerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    def setUp(self):
        self.issuer = patch.object(settings, "CLERK_ISSUER", "https://test.clerk.accounts.dev")
        self.issuer.start()
        self.jwks = patch("backend.app.core.ingredient_auth.jwks_client", return_value=SimpleNamespace(
            get_signing_key_from_jwt=lambda _: SimpleNamespace(key=self.key.public_key())))
        self.jwks.start()
        self.addCleanup(self.issuer.stop); self.addCleanup(self.jwks.stop)
        self.metadata = patch("backend.app.core.ingredient_auth.public_metadata", side_effect=AssertionError("Authorization must not call Clerk's user API"))
        self.metadata_mock = self.metadata.start()
        self.addCleanup(self.metadata.stop)

    def token(self, **changes):
        now = int(time.time())
        data = {"iss": settings.CLERK_ISSUER, "sub": "test-user", "sid": "sess_test", "iat": now, "nbf": now - 1,
                "exp": now + 60, "azp": "http://localhost:3000", "metadata": {"role": "MERCHANT_ADMIN", "merchant_ids": ["TEST-MERCHANT-A"]}}
        data.update(changes)
        return jwt.encode(data, self.key, algorithm="RS256", headers={"kid": "test"})

    def test_valid_signature_and_server_managed_metadata(self):
        result = verify_session(self.token())
        self.assertEqual(result.merchant_ids, ("TEST-MERCHANT-A",))
        self.assertFalse(result.is_admin)
        self.assertTrue(verify_session(self.token(metadata={"role": "SHOPEE_ADMIN"})).is_admin)
        self.metadata_mock.assert_not_called()

    def test_empty_public_metadata_is_valid_consumer(self):
        principal = verify_session(self.token(metadata={}))
        self.assertEqual(principal.role, "CONSUMER")
        self.assertEqual(principal.merchant_ids, ())

    def test_missing_metadata_and_unsafe_role_cannot_grant_access(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as error:
            verify_session(self.token(metadata=None, unsafe_metadata={"role": "SHOPEE_ADMIN"}))
        self.assertEqual(error.exception.status_code, 401)
        self.assertFalse(verify_session(self.token(metadata={}, unsafe_metadata={"role": "SHOPEE_ADMIN"})).is_admin)

    def test_malformed_assignment_is_configuration_error(self):
        from fastapi import HTTPException
        for metadata in [{"role": "MERCHANT"}, {"role": "MERCHANT_ADMIN", "merchant_ids": "ALL"}]:
            with self.assertRaises(HTTPException) as err:
                verify_session(self.token(metadata=metadata))
            self.assertEqual(err.exception.status_code, 401)

    def test_invalid_signature_expired_issuer_party_and_claims(self):
        from fastapi import HTTPException
        for token in [self.token(exp=int(time.time()) - 60), self.token(iss="https://wrong.invalid"),
                      self.token(azp="https://evil.invalid"), self.token(sts="pending"), self.token(sid=None),
                      jwt.encode({"sub": "test"}, "test-key-that-is-long-enough-for-hs256", algorithm="HS256")]:
            with self.assertRaises(HTTPException) as err: verify_session(token)
            self.assertEqual(err.exception.status_code, 401)
        other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        claims = jwt.decode(self.token(), options={"verify_signature": False})
        with self.assertRaises(HTTPException): verify_session(jwt.encode(claims, other_key, algorithm="RS256"))


class MigrationSafetyTests(unittest.TestCase):
    def test_startup_defaults_to_no_ddl(self):
        from backend.app.main import app
        with patch.object(settings, "AUTO_CREATE_TABLES", False), patch("backend.app.main.create_all_tables") as create:
            with TestClient(app): pass
            create.assert_not_called()

    def test_legacy_create_all_never_provisions_ingredient_tables(self):
        from backend.app.core.database import create_all_tables
        with patch.object(Base.metadata, "create_all") as create:
            create_all_tables()
            tables = {t.name for t in create.call_args.kwargs["tables"]}
            self.assertIn("menu_item", tables)
            self.assertFalse(tables.intersection({"ingredients", "ingredient_aliases", "menu_ingredients"}))

    def test_postgres_model_ddl_matches_reviewable_migration_source(self):
        from sqlalchemy.schema import CreateTable
        from sqlalchemy.dialects import postgresql
        migration = (Path(__file__).resolve().parents[1] / "migrations" / "002_ingredient_system.sql").read_text()
        for name in ("ingredients", "ingredient_aliases", "menu_ingredients"):
            model = Base.metadata.tables[name]
            compiled = str(CreateTable(model).compile(dialect=postgresql.dialect()))
            self.assertIn("CREATE TABLE " + name, migration)
            self.assertIn("CREATE TABLE " + name, compiled)
            for constraint in model.constraints:
                if constraint.name:
                    self.assertIn(constraint.name, migration)
        self.assertIn("menu_item_id VARCHAR(32)", migration)
        self.assertNotRegex(migration, r"(?im)^\s*(ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\s")
