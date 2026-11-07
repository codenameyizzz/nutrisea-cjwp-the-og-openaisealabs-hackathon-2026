"""Catalog search and atomic recipe persistence. No startup DDL or seed data."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import case, inspect, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..models import MenuItem
from ..models.ingredient import Ingredient, IngredientAlias, MenuIngredient
from ..schemas.ingredients import IngredientWrite, normalize

TABLES = {"ingredients", "ingredient_aliases", "menu_ingredients"}


def ensure_schema(db: Session):
    if not TABLES.issubset(set(inspect(db.connection()).get_table_names())):
        raise HTTPException(503, "Fitur bahan belum tersedia. Migrasi database menunggu persetujuan dan penerapan.")


def serialize_ingredient(item: Ingredient):
    return {"id": item.id, "name": item.name, "category": item.category,
            "default_unit": item.default_unit, "is_active": item.is_active,
            "aliases": [a.alias for a in item.aliases]}


def search_ingredients(db: Session, search: str, limit: int, page: int, include_inactive=False):
    query = db.query(Ingredient).options(selectinload(Ingredient.aliases))
    if not include_inactive:
        query = query.filter(Ingredient.is_active.is_(True))
    value = normalize(search)
    if "\x00" in value:
        raise HTTPException(422, "Karakter pencarian tidak valid")
    ordering = []
    if value:
        escaped = value.replace("!", "!!").replace("%", "!%").replace("_", "!_")
        prefix, substring = escaped + "%", "%" + escaped + "%"
        alias = lambda condition: select(IngredientAlias.id).where(
            IngredientAlias.ingredient_id == Ingredient.id, condition
        ).exists()
        query = query.filter(or_(Ingredient.normalized_name.like(substring, escape="!"),
                                 alias(IngredientAlias.normalized_alias.like(substring, escape="!"))))
        ordering.append(case(
            (Ingredient.normalized_name == value, 0),
            (alias(IngredientAlias.normalized_alias == value), 1),
            (Ingredient.normalized_name.like(prefix, escape="!"), 2),
            (alias(IngredientAlias.normalized_alias.like(prefix, escape="!")), 3), else_=4))
    total = query.count()
    items = query.order_by(*ordering, Ingredient.normalized_name, Ingredient.id).offset((page - 1) * limit).limit(limit).all()
    return {"items": [serialize_ingredient(i) for i in items], "total": total,
            "page": page, "limit": limit, "has_more": page * limit < total}


def get_ingredient(db: Session, ingredient_id: str, lock=False):
    query = db.query(Ingredient).filter(Ingredient.id == ingredient_id)
    if lock:
        query = query.with_for_update()
    item = query.first()
    if not item:
        raise HTTPException(404, "Bahan tidak ditemukan")
    return item


def write_ingredient(db: Session, data: IngredientWrite, ingredient_id=None):
    item = get_ingredient(db, ingredient_id, lock=True) if ingredient_id else Ingredient()
    item.name, item.normalized_name = data.name, normalize(data.name)
    item.category, item.default_unit, item.is_active = data.category, data.default_unit, data.is_active
    try:
        db.add(item)
        # Flush alias deletion before inserting replacements under the unique key.
        item.aliases.clear()
        db.flush()
        item.aliases = [IngredientAlias(alias=a, normalized_alias=normalize(a)) for a in data.aliases
                        if normalize(a) != item.normalized_name]
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Nama bahan sudah digunakan") from None
    return serialize_ingredient(item)


def menu_rows(db: Session, menu_id: str):
    return db.query(MenuIngredient).filter(MenuIngredient.menu_item_id == menu_id).order_by(MenuIngredient.ingredient_id).all()


def recipe_version(rows):
    values = [(r.ingredient_id, format(r.quantity.normalize(), "f"), r.unit) for r in rows]
    return hashlib.sha256(json.dumps(values, separators=(",", ":")).encode()).hexdigest()


def serialize_recipe(db: Session, menu_id: str):
    rows = menu_rows(db, menu_id)
    return {"items": [{"ingredient_id": r.ingredient_id, "name": r.ingredient.name,
                       "category": r.ingredient.category, "default_unit": r.ingredient.default_unit,
                       "is_active": r.ingredient.is_active, "quantity": str(r.quantity), "unit": r.unit}
                      for r in rows], "version": recipe_version(rows)}


def replace_recipe(db: Session, menu_id: str, items, version: str):
    """Caller locks the parent menu row and owns the transaction/commit."""
    rows = menu_rows(db, menu_id)
    if recipe_version(rows) != version:
        raise HTTPException(409, "Komposisi telah berubah. Muat ulang menu sebelum menyimpan.")
    ids = [str(x.ingredient_id) for x in items]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Bahan tidak boleh duplikat")
    # Lock ingredient rows too: deactivation waits until this transaction completes.
    catalog = {x.id: x for x in db.query(Ingredient).filter(Ingredient.id.in_(ids)).order_by(Ingredient.id).with_for_update().all()} if ids else {}
    existing = {r.ingredient_id: r for r in rows}
    for data in items:
        key = str(data.ingredient_id)
        if key not in catalog:
            raise HTTPException(422, "Referensi bahan tidak ditemukan")
        if not catalog[key].is_active:
            old = existing.get(key)
            # Preserve existing inactive lines, but do not add or edit them.
            if not old or old.quantity != data.quantity or old.unit != data.unit:
                raise HTTPException(422, "Bahan nonaktif hanya dapat dipertahankan atau dihapus")
    for key, row in existing.items():
        if key not in ids:
            db.delete(row)
    for data in items:
        key = str(data.ingredient_id)
        row = existing.get(key)
        if not row:
            row = MenuIngredient(menu_item_id=menu_id, ingredient_id=key)
            db.add(row)
        row.quantity, row.unit = data.quantity, data.unit
    db.flush()


def get_menu(db: Session, menu_id: str, lock=False):
    query = db.query(MenuItem).filter(MenuItem.id == menu_id)
    if lock:
        query = query.with_for_update()
    menu = query.first()
    if not menu:
        raise HTTPException(404, "Menu tidak ditemukan")
    return menu
