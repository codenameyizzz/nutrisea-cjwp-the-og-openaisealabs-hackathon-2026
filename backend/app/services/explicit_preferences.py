"""Small, deterministic vocabulary for durable food preferences, not allergies."""
import re
from sqlalchemy.orm import Session
from ..models.user_memory import UserMemoryItem
from ..db import crud

SOURCE = "explicit_food_preference"
FOODS = "ayam|ikan|sapi|kambing|udang|telur|tahu|tempe|kacang"


def parse_preference(message: str):
    # Full sentences only: questions, quoted speech, temporal requests and
    # medical restrictions must not silently become durable preferences.
    match = re.fullmatch(
        rf"\s*(?:saya|aku)\s+(tidak suka|nggak suka|tidak menyukai|suka lagi|suka)\s+({FOODS})(?:\s+lagi)?[.!]?\s*",
        message, re.IGNORECASE,
    )
    if not match:
        return None
    return match[2].lower(), match[1].lower() in ("tidak suka", "nggak suka", "tidak menyukai")


def preferences(db: Session, user_id: str):
    rows = db.query(UserMemoryItem).filter_by(user_id=user_id, source=SOURCE).all()
    return sorted({r.fact_text.removeprefix("Tidak suka ").rstrip(".")
                   for r in rows if r.fact_text.startswith("Tidak suka ")})


def save_preference(db: Session, user_id: str, message: str):
    parsed = parse_preference(message)
    if parsed is None:
        return False
    food, excluded = parsed
    if not crud.get_user(db, user_id):
        crud.upsert_user(db, user_id=user_id, name="NutriSea User", consent_health_data=False)
    # Update the same preference slot so latest explicit correction wins.
    rows = db.query(UserMemoryItem).filter(
        UserMemoryItem.user_id == user_id,
        UserMemoryItem.source == SOURCE,
        UserMemoryItem.fact_text.in_([f"Tidak suka {food}.", f"Suka {food}."]),
    ).all()
    for row in rows:
        db.delete(row)
    db.add(UserMemoryItem(user_id=user_id, category="preference",
                          fact_text=f"{'Tidak suka' if excluded else 'Suka'} {food}.",
                          source=SOURCE, confidence=1.0))
    db.commit()
    return True


def matches_preference(dish: dict, excluded: list[str]):
    # This filters named foods, not hidden ingredients or allergen safety.
    name = dish.get("item_name") or dish.get("name") or ""
    return not any(re.search(rf"\b{re.escape(food)}\b", name, re.I) for food in excluded)
