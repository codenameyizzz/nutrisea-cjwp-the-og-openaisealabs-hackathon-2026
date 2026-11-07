"""Database-backed ingredient provenance, separate from heuristic clinical rules.

Only persisted recipes create MENU -> INGREDIENT edges. Source portions never
replace menu macros and are not evidence of an allergy or a complete recipe.
"""
from urllib.parse import urlsplit

import networkx as nx
from fastapi import HTTPException
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from ..models.ingredient import Ingredient, MenuIngredient
from ..models.ingredient_source import IngredientSourceFood, IngredientSourceServing
from .ingredients import get_ingredient, get_menu

TABLES = {"ingredients", "menu_ingredients", "ingredient_source_foods", "ingredient_source_servings"}
# Vitamin/mineral units not specified in the scraped SQLite export stay unknown.
NUTRIENT_UNITS = {
    "calories": "kcal", "carbohydrate": "g", "protein": "g", "fat": "g",
    "saturated_fat": "g", "polyunsaturated_fat": "g", "monounsaturated_fat": "g",
    "trans_fat": "g", "cholesterol": "mg", "sodium": "mg", "potassium": "mg",
    "fiber": "g", "sugar": "g",
}


def ensure_source_schema(db: Session):
    if not TABLES.issubset(set(inspect(db.connection()).get_table_names())):
        raise HTTPException(503, "Referensi nutrisi belum tersedia. Terapkan migrasi sumber bahan terlebih dahulu.")


def safe_source_url(value):
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        host = url.hostname or ""
        if url.scheme == "https" and not url.username and not url.password and (
            host == "fatsecret.com" or host.endswith(".fatsecret.com")
        ):
            return value
    except ValueError:
        pass
    return None


def serialize_serving(row: IngredientSourceServing):
    raw = row.raw_serving
    return {
        "source_key": row.source_key,
        "description": raw.get("serving_description"),
        "metric_amount": raw.get("metric_serving_amount"),
        "metric_unit": raw.get("metric_serving_unit"),
        "measurement_description": raw.get("measurement_description"),
        "number_of_units": raw.get("number_of_units"),
        "source_url": safe_source_url(raw.get("serving_url")),
        "nutrients": row.nutrients,
        "nutrient_units": {key: NUTRIENT_UNITS.get(key) for key in row.nutrients},
        "unit_unverified_fields": [key for key in row.nutrients if key not in NUTRIENT_UNITS],
        "content_sha256": row.content_sha256,
    }


def source_records(db: Session, ingredient_ids: list[str]):
    foods = db.scalars(select(IngredientSourceFood).where(
        IngredientSourceFood.ingredient_id.in_(ingredient_ids),
        IngredientSourceFood.link_status == "linked",
    ).order_by(IngredientSourceFood.source_key)).all()
    servings = db.scalars(select(IngredientSourceServing).where(
        IngredientSourceServing.food_source_key.in_([food.source_key for food in foods]),
    ).order_by(IngredientSourceServing.source_key)).all() if foods else []
    by_food = {food.source_key: [] for food in foods}
    for serving in servings:
        by_food[serving.food_source_key].append(serialize_serving(serving))
    result = []
    for food in foods:
        portions = sorted(by_food[food.source_key], key=lambda row: (
            row["metric_amount"] != 100, row["metric_unit"] != "g", row["source_key"]))
        result.append({
            "source_key": food.source_key, "ingredient_id": food.ingredient_id,
            "source_name": food.source_name, "source_url": safe_source_url(food.source_url),
            "content_sha256": food.content_sha256, "batch_sha256": food.batch_sha256,
            "imported_at": food.imported_at.isoformat(), "servings": portions,
        })
    return result


def ingredient_nutrition(db: Session, ingredient_id: str):
    item = get_ingredient(db, ingredient_id)
    sources = source_records(db, [ingredient_id])
    return {
        "ingredient": {"id": item.id, "name": item.name, "is_active": item.is_active},
        "status": "source_reference" if sources else "no_source",
        "basis": "per_source_serving", "sources": sources,
        "note": "Nilai mengikuti porsi dan bentuk bahan pada sumber. Belum memverifikasi resep atau total nutrisi menu.",
    }


def catalog_stats(db: Session):
    count = lambda model: db.scalar(select(func.count()).select_from(model))
    sources = count(IngredientSourceFood)
    linked = db.scalar(select(func.count()).select_from(IngredientSourceFood).where(
        IngredientSourceFood.link_status == "linked"))
    recipes = count(MenuIngredient)
    return {
        "basis": "persisted_catalog_and_recipes", "ingredients": count(Ingredient),
        "source_foods": sources, "source_servings": count(IngredientSourceServing),
        "linked_source_foods": linked, "sources_needing_review": sources - linked,
        "recipe_edges": recipes,
        "menus_with_recipe": db.scalar(select(func.count(func.distinct(MenuIngredient.menu_item_id)))),
        "clinical_rules_added": 0,
    }


def evidence_graph(db: Session, *, ingredient_id=None, menu_id=None):
    graph = nx.DiGraph()
    recipes = []
    if menu_id is not None:
        menu = get_menu(db, menu_id)
        graph.add_node("MENU:" + menu.id, type="MENU", label=menu.name)
        recipes = db.scalars(select(MenuIngredient).where(MenuIngredient.menu_item_id == menu_id)).all()
        items = [row.ingredient for row in recipes]
    else:
        items = [get_ingredient(db, ingredient_id)]
    for item in items:
        graph.add_node("CATALOG_INGREDIENT:" + item.id, type="INGREDIENT", label=item.name,
                       ingredient_id=item.id, is_active=item.is_active)
    for row in recipes:
        graph.add_edge("MENU:" + menu_id, "CATALOG_INGREDIENT:" + row.ingredient_id,
                       relation="RECIPE_CONTAINS", quantity=str(row.quantity), unit=row.unit,
                       evidence="persisted_menu_ingredients")
    sources = source_records(db, [item.id for item in items])
    for food in sources:
        food_node = "SOURCE_FOOD:" + food["source_key"]
        graph.add_node(food_node, type="SOURCE_FOOD", label=food["source_name"],
                       source_url=food["source_url"], batch_sha256=food["batch_sha256"],
                       content_sha256=food["content_sha256"])
        graph.add_edge("CATALOG_INGREDIENT:" + food["ingredient_id"], food_node,
                       relation="HAS_SOURCE_RECORD", evidence="imported_source_mapping")
        for serving in food["servings"]:
            serving_node = "SOURCE_SERVING:" + serving["source_key"]
            graph.add_node(serving_node, type="SOURCE_SERVING", label=serving["description"], **serving)
            graph.add_edge(food_node, serving_node, relation="HAS_SERVING", evidence="source_food_id")
    return {
        "basis": "persisted_catalog_and_recipes",
        "recipe_status": ("recorded_completeness_unverified" if recipes else "recipe_missing") if menu_id else "not_applicable",
        "nutrition_status": "source_reference_only", "menu_nutrition_recomputed": False,
        "coverage": {"recipe_ingredients": len(recipes), "ingredients_with_source": len({r["ingredient_id"] for r in sources})},
        "nodes": [{"id": key, **value} for key, value in graph.nodes(data=True)],
        "links": [{"source": source, "target": target, **value} for source, target, value in graph.edges(data=True)],
    }
