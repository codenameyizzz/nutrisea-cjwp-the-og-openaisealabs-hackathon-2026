"""Explicit onboarding answers stored separately from reference-persona facts."""
import json
import uuid

from ..models import UserMemoryItem

SOURCE = "onboarding_dietary_needs"
FIELDS = ("dietary_needs", "dietary_guidance", "allergy_status")


def read_onboarding_details(db, user_id):
    result = dict.fromkeys(FIELDS)
    rows = db.query(UserMemoryItem).filter(
        UserMemoryItem.user_id == user_id, UserMemoryItem.source == SOURCE
    ).order_by(UserMemoryItem.created_at, UserMemoryItem.id).all()
    for row in rows:
        if row.category not in result:
            continue
        try:
            value = json.loads(row.fact_text)
        except (ValueError, TypeError):
            continue
        if row.category == "dietary_needs" and isinstance(value, str):
            result[row.category] = (result[row.category] or []) + [value]
        else:
            result[row.category] = value
    return result


def save_onboarding_details(db, user_id, values):
    # The caller owns the transaction; omitted fields preserve existing answers.
    for field in FIELDS:
        if field not in values:
            continue
        db.query(UserMemoryItem).filter(
            UserMemoryItem.user_id == user_id, UserMemoryItem.source == SOURCE,
            UserMemoryItem.category == field,
        ).delete()
        value = values[field]
        entries = value if field == "dietary_needs" and value else [value]
        for entry in entries:
            db.add(UserMemoryItem(id=str(uuid.uuid4()), user_id=user_id,
                category=field, fact_text=json.dumps(entry, ensure_ascii=False),
                confidence=1, source=SOURCE))
