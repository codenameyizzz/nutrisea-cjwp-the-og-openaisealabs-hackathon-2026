"""Plan and insert a FatSecret SQLite snapshot without updating existing rows.

The caller owns transactions. Planning is read-only. Exact identity matches only;
missing local metadata and ambiguous aliases are retained for review.
"""
import hashlib
import json
import math
import sqlite3
from collections import Counter, defaultdict
from contextlib import closing
from pathlib import Path
from uuid import UUID, uuid5

from pydantic import ValidationError
from sqlalchemy import inspect, select
from ..models.ingredient import Ingredient, IngredientAlias
from ..models.ingredient_source import IngredientSourceFood, IngredientSourceServing
from ..schemas.ingredients import IngredientWrite, display_text, normalize

NAMESPACE = UUID("fe0dfed2-b26e-482e-a82e-56cf1c2d51aa")
SOURCE_TABLES = (IngredientSourceFood.__table__, IngredientSourceServing.__table__)
TABLES = (Ingredient.__table__, IngredientAlias.__table__, *SOURCE_TABLES)


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":"), allow_nan=False, default=str).encode()).hexdigest()


def source_key(value):
    value = str(value or "")
    if not value.isascii() or not value.isdigit() or len(value) > 80:
        raise ValueError("Invalid numeric source identifier")
    return "fatsecret:" + value


def read_source(path):
    path = Path(path).resolve(strict=True)
    batch = hashlib.sha256(path.read_bytes()).hexdigest()
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only=ON")
        db.execute("PRAGMA trusted_schema=OFF")
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity check failed")
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("SQLite contains orphaned source references")
        for table in ("ingredients", "servings", "nutrition"):
            row = db.execute("SELECT type FROM sqlite_master WHERE name=?", (table,)).fetchone()
            if row is None or row[0] != "table":
                raise ValueError("Expected a physical source table: " + table)
        foods = [dict(r) for r in db.execute("SELECT * FROM ingredients ORDER BY food_id")]
        servings = [dict(r) for r in db.execute("SELECT * FROM servings ORDER BY serving_id")]
        nutrition = {str(r["serving_id"]): dict(r) for r in db.execute("SELECT * FROM nutrition")}
    food_ids = {str(f["food_id"]) for f in foods}
    serving_ids = {str(s["serving_id"]) for s in servings}
    if len(food_ids) != len(foods) or len(serving_ids) != len(servings):
        raise ValueError("Duplicate source identifiers")
    if set(nutrition) != serving_ids:
        raise ValueError("Each serving must have exactly one nutrition record")
    for food in foods:
        source_key(food["food_id"])
        if not isinstance(food.get("nama_fatsecret"), str) or not food["nama_fatsecret"].strip():
            raise ValueError("Source food name is missing")
        if len(food["nama_fatsecret"]) > 300 or len(food.get("food_url") or "") > 1000:
            raise ValueError("Source food exceeds supported field length")
    for serving in servings:
        source_key(serving["serving_id"])
        if str(serving["food_id"]) not in food_ids:
            raise ValueError("Serving has no source food")
        amount = serving.get("metric_serving_amount")
        if not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount <= 0:
            raise ValueError("Invalid metric portion amount")
        if serving.get("metric_serving_unit") not in ("g", "ml"):
            raise ValueError("Unsupported metric serving unit; review before import")
        for key, value in nutrition[str(serving["serving_id"])].items():
            if key != "serving_id" and value is not None:
                if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                    raise ValueError("Invalid nutrient value: " + key)
    # Reject nonfinite values or unsupported source payloads before touching Aiven.
    digest([foods, servings, nutrition])
    if hashlib.sha256(path.read_bytes()).hexdigest() != batch:
        raise ValueError("Source snapshot changed during inspection; use a closed SQLite export")
    return {"batch_sha256": batch, "foods": foods, "servings": servings, "nutrition": nutrition}


def read_existing(connection):
    names = set(inspect(connection).get_table_names())
    if not {"ingredients", "ingredient_aliases", "menu_ingredients"}.issubset(names):
        raise ValueError("Ingredient base schema is missing; do not run unrelated migrations automatically")
    return {table.name: [dict(r) for r in connection.execute(select(table)).mappings()]
            if table.name in names else [] for table in TABLES}


def make_plan(source, existing):
    insertions = {t.name: [] for t in TABLES}
    review, conflicts = [], []
    counts = Counter()
    catalog = {r["id"]: r for r in existing["ingredients"]}
    identities = defaultdict(set)
    for row in catalog.values():
        identities[normalize(row["name"])].add(row["id"])
        identities[row["normalized_name"]].add(row["id"])
    for row in existing["ingredient_aliases"]:
        identities[normalize(row["alias"])].add(row["ingredient_id"])
    foods_existing = {r["source_key"]: r for r in existing["ingredient_source_foods"]}
    servings_existing = {r["source_key"]: r for r in existing["ingredient_source_servings"]}
    source_units = defaultdict(set)
    for serving in source["servings"]:
        source_units[str(serving["food_id"])].add(serving["metric_serving_unit"])
    blocked_foods = set()
    for food in source["foods"]:
        key = source_key(food["food_id"])
        fingerprint = digest(food)
        if key in foods_existing:
            if foods_existing[key]["content_sha256"] != fingerprint:
                conflicts.append({"source_key": key, "reason": "source_food_changed_existing_preserved"})
                blocked_foods.add(key)
            else:
                counts["source_foods_unchanged"] += 1
            continue
        ingredient_id = None
        reason = None
        try:
            local_name = food.get("nama_indonesia")
            category = food.get("kategori")
            if not local_name or not category:
                raise ValueError("missing_local_name_or_category")
            if food.get("food_type") != "Generic" or food.get("brand_name"):
                raise ValueError("branded_source_requires_review")
            units = source_units[str(food["food_id"])]
            if len(units) != 1:
                raise ValueError("missing_or_mixed_portion_units")
            default_unit = "ml" if units == {"ml"} else "gram"
            aliases = [display_text(food["nama_fatsecret"])]
            data = IngredientWrite(name=local_name, category=category, default_unit=default_unit, aliases=aliases)
            matched = identities[normalize(data.name)] | identities[normalize(aliases[0])]
            if len(matched) > 1:
                raise ValueError("ambiguous_name_or_alias")
            if matched:
                ingredient_id = next(iter(matched))
                counts["existing_ingredients_linked"] += 1
                # Existing names, categories, aliases, units and active flags stay intact.
            else:
                ingredient_id = str(uuid5(NAMESPACE, key))
                if ingredient_id in catalog:
                    raise ValueError("generated_id_collision")
                row = {"id": ingredient_id, "name": data.name, "normalized_name": normalize(data.name),
                       "category": data.category, "default_unit": data.default_unit, "is_active": True}
                insertions["ingredients"].append(row)
                catalog[ingredient_id] = row
                identities[normalize(data.name)].add(ingredient_id)
                for alias in aliases:
                    if normalize(alias) != normalize(data.name):
                        insertions["ingredient_aliases"].append({
                            "id": str(uuid5(NAMESPACE, key + ":alias:" + normalize(alias))),
                            "ingredient_id": ingredient_id, "alias": alias, "normalized_alias": normalize(alias)})
                        identities[normalize(alias)].add(ingredient_id)
        except ValueError as error:
            reason = "invalid_catalog_metadata" if isinstance(error, ValidationError) else str(error)[:300]
            review.append({"source_key": key, "source_name": food["nama_fatsecret"], "reason": reason})
        insertions["ingredient_source_foods"].append({
            "source_key": key, "ingredient_id": ingredient_id, "source_name": food["nama_fatsecret"],
            "source_url": food.get("food_url"), "link_status": "linked" if ingredient_id else "needs_review",
            "review_reason": reason, "raw_food": food, "content_sha256": fingerprint,
            "batch_sha256": source["batch_sha256"]})
    for serving in source["servings"]:
        key = source_key(serving["serving_id"])
        food_key = source_key(serving["food_id"])
        nutrients = {k:v for k,v in source["nutrition"][str(serving["serving_id"] )].items() if k != "serving_id"}
        fingerprint = digest({"serving": serving, "nutrients": nutrients})
        if food_key in blocked_foods:
            conflicts.append({"source_key": key, "reason": "parent_source_food_changed"})
            continue
        if key in servings_existing:
            row = servings_existing[key]
            if row["content_sha256"] != fingerprint or row["food_source_key"] != food_key:
                conflicts.append({"source_key": key, "reason": "source_serving_changed_existing_preserved"})
            else:
                counts["source_servings_unchanged"] += 1
            continue
        insertions["ingredient_source_servings"].append({
            "source_key": key, "food_source_key": food_key, "raw_serving": serving, "nutrients": nutrients,
            "content_sha256": fingerprint, "batch_sha256": source["batch_sha256"]})
    return {"batch_sha256": source["batch_sha256"], "source_counts": {
        "foods": len(source["foods"]), "servings": len(source["servings"])},
        "insert_counts": {name: len(rows) for name,rows in insertions.items()},
        "unchanged": dict(counts), "needs_review": review, "conflicts": conflicts, "rows": insertions}


def apply_plan(connection, plan):
    """INSERT only. Caller locks/imports in a transaction and handles rollback."""
    if plan["conflicts"]:
        raise ValueError("Source conflicts found; existing data preserved, import aborted")
    for table in TABLES:
        rows = plan["rows"][table.name]
        if rows:
            connection.execute(table.insert(), rows)


def assert_existing_preserved(before, after):
    for table in TABLES:
        pk = list(table.primary_key.columns)[0].name
        current = {row[pk]: row for row in after[table.name]}
        for row in before[table.name]:
            if row != current.get(row[pk]):
                raise RuntimeError("Existing row changed; rolling back import: " + table.name)
