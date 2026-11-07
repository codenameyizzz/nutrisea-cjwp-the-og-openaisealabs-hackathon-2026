import copy
import os
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from uuid import uuid4

if os.getenv("NUTRISEA_TESTING") != "1":
    raise RuntimeError("Use python scripts/run_backend_tests.py with isolated SQLite")

from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.core.database import Base, get_db
from backend.app.api import ingredient_sources
from backend.app.models import MenuItem, Merchant
from backend.app.models.ingredient import Ingredient, IngredientAlias, MenuIngredient
from backend.app.models.ingredient_source import IngredientSourceFood, IngredientSourceServing
from backend.app.services.ingredient_import import (
    apply_plan, assert_existing_preserved, make_plan, read_existing, read_source,
)


def source_fixture():
    return {
        "batch_sha256": "a" * 64,
        "foods": [{"food_id": "10", "nama_indonesia": "Tempe", "nama_fatsecret": "Tempeh",
                   "kategori": "Protein Nabati", "food_type": "Generic", "brand_name": None,
                   "food_url": "https://foods.fatsecret.com/calories-nutrition/generic/tempeh"}],
        "servings": [
            {"serving_id": "100", "food_id": "10", "serving_description": "100 g",
             "metric_serving_amount": 100, "metric_serving_unit": "g"},
            {"serving_id": "101", "food_id": "10", "serving_description": "1 oz",
             "metric_serving_amount": 28.35, "metric_serving_unit": "g"},
        ],
        "nutrition": {
            "100": {"serving_id": "100", "calories": 175, "protein": 21.41, "sugar": None, "sodium": 50},
            "101": {"serving_id": "101", "calories": 50, "protein": 6.07, "sugar": None, "sodium": 14},
        },
    }


class IngredientDataTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", poolclass=StaticPool,
                                    connect_args={"check_same_thread": False})
        event.listen(self.engine, "connect", lambda db, _: db.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        self.source = source_fixture()

    def tearDown(self):
        self.engine.dispose()

    def import_source(self):
        with self.engine.begin() as connection:
            before = read_existing(connection)
            plan = make_plan(self.source, before)
            apply_plan(connection, plan)
            assert_existing_preserved(before, read_existing(connection))
            return plan

    def test_dry_run_is_read_only_and_reimport_is_noop(self):
        with self.engine.begin() as connection:
            before = read_existing(connection)
            plan = make_plan(self.source, before)
            self.assertEqual(before, read_existing(connection))
            self.assertEqual(plan["insert_counts"]["ingredients"], 1)
        self.import_source()
        repeat = self.import_source()
        self.assertFalse(any(repeat["insert_counts"].values()))
        self.assertEqual(repeat["unchanged"]["source_servings_unchanged"], 2)

    def test_existing_inactive_catalog_alias_and_menu_unchanged(self):
        item_id = str(uuid4())
        with Session(self.engine) as db:
            db.add(Ingredient(id=item_id, name="Tempe lokal", normalized_name="tempe lokal",
                              category="Pilihan merchant", default_unit="pcs", is_active=False))
            db.add(Merchant(id="M", name="Merchant", area="Test"))
            db.flush()
            db.add(IngredientAlias(ingredient_id=item_id, alias="Tempeh", normalized_alias="tempeh"))
            db.add(MenuItem(id="MENU", name="Tempe menu", merchant_id="M", kcal=999,
                            base_price_idr=10000, discounted_price_idr=10000,
                            protein_g=1, carbs_g=2, fat_g=3, sodium_mg=4))
            db.flush()
            db.add(MenuIngredient(menu_item_id="MENU", ingredient_id=item_id, quantity=2, unit="pcs"))
            db.commit()
        with self.engine.connect() as connection:
            before = read_existing(connection)
            menu_before = connection.execute(select(MenuItem.__table__)).mappings().all()
            recipe_before = connection.execute(select(MenuIngredient.__table__)).mappings().all()
        plan = self.import_source()
        self.assertEqual(plan["insert_counts"]["ingredients"], 0)
        self.assertEqual(plan["insert_counts"]["ingredient_aliases"], 0)
        with self.engine.connect() as connection:
            assert_existing_preserved(before, read_existing(connection))
            self.assertEqual(menu_before, connection.execute(select(MenuItem.__table__)).mappings().all())
            self.assertEqual(recipe_before, connection.execute(select(MenuIngredient.__table__)).mappings().all())
            self.assertEqual(connection.scalar(select(IngredientSourceFood.ingredient_id)), item_id)

    def test_changed_source_aborts_entire_plan(self):
        self.import_source()
        self.source["nutrition"]["100"]["calories"] = 999
        with self.engine.begin() as connection:
            before = read_existing(connection)
            plan = make_plan(self.source, before)
            self.assertEqual(len(plan["conflicts"]), 1)
            with self.assertRaises(ValueError):
                apply_plan(connection, plan)
            self.assertEqual(before, read_existing(connection))

    def test_transaction_failure_rolls_back_all_inserts(self):
        with self.assertRaises(RuntimeError):
            with self.engine.begin() as connection:
                apply_plan(connection, make_plan(self.source, read_existing(connection)))
                raise RuntimeError("simulate failure before commit")
        with self.engine.connect() as connection:
            self.assertTrue(all(not rows for rows in read_existing(connection).values()))

    def test_missing_metadata_keeps_raw_source_and_null_nutrients(self):
        self.source["foods"][0]["nama_indonesia"] = None
        plan = self.import_source()
        self.assertEqual(plan["insert_counts"]["ingredients"], 0)
        self.assertEqual(len(plan["needs_review"]), 1)
        with Session(self.engine) as db:
            food = db.get(IngredientSourceFood, "fatsecret:10")
            self.assertIsNone(food.ingredient_id)
            self.assertEqual(food.link_status, "needs_review")
            self.assertEqual(food.raw_food, self.source["foods"][0])
            serving = db.get(IngredientSourceServing, "fatsecret:100")
            self.assertIsNone(serving.nutrients["sugar"])
            self.assertEqual(serving.raw_serving["metric_serving_amount"], 100)

    def test_ambiguous_alias_is_reviewed_without_merging(self):
        with Session(self.engine) as db:
            for name in ("Bahan A", "Bahan B"):
                ingredient = Ingredient(name=name, normalized_name=name.lower())
                db.add(ingredient)
                db.flush()
                db.add(IngredientAlias(ingredient_id=ingredient.id, alias="Tempeh", normalized_alias="tempeh"))
            db.commit()
        plan = self.import_source()
        self.assertEqual(plan["needs_review"][0]["reason"], "ambiguous_name_or_alias")
        self.assertEqual(plan["insert_counts"]["ingredients"], 0)

    def test_ml_source_keeps_ml_catalog_unit(self):
        for row in self.source["servings"]:
            row["metric_serving_unit"] = "ml"
        self.import_source()
        with self.engine.connect() as connection:
            self.assertEqual(connection.scalar(select(Ingredient.default_unit)), "ml")

    def test_brand_mixed_units_and_invalid_metadata_are_reviewed(self):
        variants = [copy.deepcopy(self.source) for _ in range(3)]
        variants[0]["foods"][0]["brand_name"] = "Example brand"
        variants[1]["servings"][0]["metric_serving_unit"] = "ml"
        variants[2]["foods"][0]["kategori"] = "x" * 1000
        with self.engine.connect() as connection:
            for variant in variants:
                plan = make_plan(variant, read_existing(connection))
                self.assertEqual(plan["insert_counts"]["ingredients"], 0)
                self.assertEqual(len(plan["needs_review"]), 1)
                self.assertLessEqual(len(plan["needs_review"][0]["reason"]), 300)

    def test_sqlite_snapshot_read_only_and_invalid_portions_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "source.db"
            with closing(sqlite3.connect(path)) as db, db:
                db.executescript("""
                    CREATE TABLE ingredients (food_id TEXT PRIMARY KEY, nama_fatsecret TEXT);
                    CREATE TABLE servings (serving_id TEXT PRIMARY KEY, food_id TEXT,
                        metric_serving_amount REAL, metric_serving_unit TEXT);
                    CREATE TABLE nutrition (serving_id TEXT PRIMARY KEY, calories REAL, sugar REAL);
                    INSERT INTO ingredients VALUES ('1', 'Tempeh');
                    INSERT INTO servings VALUES ('2', '1', 100, 'g');
                    INSERT INTO nutrition VALUES ('2', 175, NULL);
                """)
            before = path.read_bytes()
            snapshot = read_source(path)
            self.assertEqual(path.read_bytes(), before)
            self.assertIsNone(snapshot["nutrition"]["2"]["sugar"])
            with closing(sqlite3.connect(path)) as db, db:
                db.execute("UPDATE servings SET metric_serving_amount=-1")
            with self.assertRaisesRegex(ValueError, "portion amount"):
                read_source(path)


class IngredientKnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", poolclass=StaticPool,
                                    connect_args={"check_same_thread": False})
        event.listen(self.engine, "connect", lambda db, _: db.execute("PRAGMA foreign_keys=ON"))
        Base.metadata.create_all(self.engine)
        with self.engine.begin() as connection:
            plan = make_plan(source_fixture(), read_existing(connection))
            apply_plan(connection, plan)
            self.ingredient_id = plan["rows"]["ingredients"][0]["id"]
        with Session(self.engine) as db:
            db.add(Merchant(id="M", name="Merchant", area="Test"))
            db.flush()
            db.add(MenuItem(id="MENU", name="Tempe tumis", merchant_id="M", kcal=999,
                            base_price_idr=10000, discounted_price_idr=10000,
                            protein_g=1, carbs_g=2, fat_g=3, sodium_mg=4))
            db.commit()
        self.app = FastAPI()
        self.app.include_router(ingredient_sources.router)
        def test_db():
            with Session(self.engine) as db:
                yield db
        self.app.dependency_overrides[get_db] = test_db
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_nutrition_preserves_each_portion_nulls_and_unknown_units(self):
        with Session(self.engine) as db:
            row = db.get(IngredientSourceServing, "fatsecret:100")
            row.nutrients = {**row.nutrients, "calcium": 1}
            db.commit()
        response = self.client.get(f"/api/ingredients/{self.ingredient_id}/nutrition")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        portions = payload["sources"][0]["servings"]
        self.assertEqual([row["metric_amount"] for row in portions], [100, 28.35])
        self.assertEqual([row["nutrients"]["calories"] for row in portions], [175, 50])
        self.assertIsNone(portions[0]["nutrients"]["sugar"])
        self.assertIsNone(portions[0]["nutrient_units"]["calcium"])
        self.assertEqual(portions[0]["nutrient_units"]["sodium"], "mg")
        self.assertEqual(payload["basis"], "per_source_serving")

    def test_graph_only_links_persisted_recipe_never_dish_name(self):
        before = self.client.get("/api/graph/catalog/menus/MENU").json()
        self.assertEqual(before["recipe_status"], "recipe_missing")
        self.assertEqual(before["links"], [])
        self.assertEqual(len(before["nodes"]), 1)
        with Session(self.engine) as db:
            db.add(MenuIngredient(menu_item_id="MENU", ingredient_id=self.ingredient_id, quantity=2, unit="pcs"))
            db.commit()
        after = self.client.get("/api/graph/catalog/menus/MENU").json()
        self.assertEqual(after["recipe_status"], "recorded_completeness_unverified")
        relations = {link["relation"] for link in after["links"]}
        self.assertEqual(relations, {"RECIPE_CONTAINS", "HAS_SOURCE_RECORD", "HAS_SERVING"})
        recipe = next(link for link in after["links"] if link["relation"] == "RECIPE_CONTAINS")
        self.assertEqual(recipe["quantity"], "2.000")
        self.assertEqual(recipe["unit"], "pcs")
        self.assertFalse(after["menu_nutrition_recomputed"])
        with Session(self.engine) as db:
            self.assertEqual(db.get(MenuItem, "MENU").kcal, 999)

    def test_stats_and_ingredient_graph_report_reference_coverage(self):
        stats = self.client.get("/api/graph/catalog/stats").json()
        self.assertEqual(stats["ingredients"], 1)
        self.assertEqual(stats["source_servings"], 2)
        self.assertEqual(stats["recipe_edges"], 0)
        self.assertEqual(stats["clinical_rules_added"], 0)
        graph = self.client.get(f"/api/graph/catalog/ingredients/{self.ingredient_id}").json()
        self.assertEqual(len(graph["nodes"]), 4)
        self.assertEqual(len(graph["links"]), 3)
        self.assertEqual(graph["coverage"]["ingredients_with_source"], 1)

    def test_no_source_and_missing_records_are_explicit(self):
        item_id = str(uuid4())
        with Session(self.engine) as db:
            db.add(Ingredient(id=item_id, name="Bahan lain", normalized_name="bahan lain"))
            db.commit()
        response = self.client.get(f"/api/ingredients/{item_id}/nutrition")
        self.assertEqual(response.json()["status"], "no_source")
        self.assertEqual(response.json()["sources"], [])
        self.assertEqual(self.client.get(f"/api/ingredients/{uuid4()}/nutrition").status_code, 404)
        self.assertEqual(self.client.get("/api/ingredients/not-a-uuid/nutrition").status_code, 422)
        self.assertEqual(self.client.get("/api/graph/catalog/menus/unknown").status_code, 404)

    def test_untrusted_source_url_is_not_returned_as_a_link(self):
        with Session(self.engine) as db:
            food = db.get(IngredientSourceFood, "fatsecret:10")
            food.source_url = "javascript:alert(1)"
            db.commit()
        result = self.client.get(f"/api/ingredients/{self.ingredient_id}/nutrition").json()
        self.assertIsNone(result["sources"][0]["source_url"])

    def test_missing_migration_returns_503_without_creating_tables(self):
        IngredientSourceServing.__table__.drop(self.engine)
        self.assertEqual(self.client.get("/api/graph/catalog/stats").status_code, 503)


if __name__ == "__main__":
    unittest.main()
