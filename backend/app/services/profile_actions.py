"""Validated proposals stored in the existing action journal; no schema migration."""
import re
from datetime import datetime, timedelta, timezone, date
from fastapi import HTTPException
from ..models.user_action import UserActionLog
from ..models.health_profile import HealthProfile
from ..models.user_memory import UserMemoryItem
from .explicit_preferences import parse_preference, preferences, SOURCE
from .allergens import normalize_allergen, normalize_allergens

KIND = "PROFILE_CHANGE"
JAKARTA = timezone(timedelta(hours=7))

def now():
    return datetime.now(timezone.utc)

def day_end():
    return (now().astimezone(JAKARTA) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

def age_from_birth_date(value):
    born = date.fromisoformat(value)
    today = now().astimezone(JAKARTA).date()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

def validate(field, value):
    if field == "meal_budget_idr":
        if type(value) is not int or not 5000 <= value <= 10000000:
            raise HTTPException(422, "Budget must be between Rp5,000 and Rp10,000,000.")
    elif field == "birth_date":
        try:
            if not 1 <= age_from_birth_date(value) <= 120: raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(422, "Use a valid YYYY-MM-DD birth date (age 1-120).")
    elif field == "reduce_fried_food" or re.fullmatch(r"excluded_food:(ayam|ikan|sapi|kambing|udang|telur|tahu|tempe|kacang|nasi)", field) or re.fullmatch(r"allergy:[a-z ]{2,40}", field):
        if type(value) is not bool: raise HTTPException(422, "Invalid setting value.")
    else:
        raise HTTPException(422, "Unsupported setting.")

def parse_allergy_statement(message):
    text = " ".join(message.lower().replace("’", "'").strip().rstrip(".!").split())
    text = re.sub(r"\bim\b", "i'm", text)
    text = re.sub(r"\bive\b", "i've", text)
    # Only complete first-person statements qualify; questions and quoted or
    # third-party statements must not create restrictions on this account.
    uncertain = text.startswith("i think ")
    if uncertain:
        text = text[len("i think "):]
    assertion = re.fullmatch(r"i(?: am|'m| may be| might be| could be) al{1,2}ergic to ([a-z ]{2,40})", text)
    reaction = re.fullmatch(r"i(?:(?: have|'ve) (?:developed|had)|(?: am|'m) having) (?:an? )?al{1,2}ergic reaction (?:to|after eating) ([a-z ]{2,40})", text)
    indonesian = re.fullmatch(r"(?:saya|aku) (mungkin )?alergi(?: terhadap)? ([a-z ]{2,40})", text)
    match = assertion or reaction or indonesian
    if not match:
        return None
    food = indonesian[2] if indonesian else match[1]
    if any(word in food.split() for word in ("today", "hari", "not", "no", "tidak", "bukan", "dan", "and", "or", "if", "but")):
        return None
    possible = uncertain or reaction is not None or bool(indonesian and indonesian[1]) or bool(re.search(r"\b(?:may|might|could)\b", text))
    return {"allergen": normalize_allergen(food), "certainty": "possible" if possible else "self_reported"}


def parse_change(message):
    text = message.strip().rstrip(".!")
    budget = re.fullmatch(r"(?:my (?:usual )?(?:lunch |meal )?budget (?:is(?: now)?|=)|(?:budget|anggaran)(?: makan siang| makan)?(?: saya)?(?: sekarang| kini)?(?: adalah| jadi| menjadi)?)[ :]*rp?\s*([0-9][0-9.,]*)(?:\s*(rb|ribu|k))?", text, re.I)
    if budget:
        raw = budget[1].replace(",", "").replace(".", "")
        value = int(raw) * (1000 if budget[2] else 1)
        validate("meal_budget_idr", value)
        return "meal_budget_idr", value
    if re.fullmatch(r"no rice today", text, re.I): return "excluded_food:nasi", True
    english_pref = re.fullmatch(r"I (don't like|do not like|like) (chicken|fish|beef|shrimp|eggs|tofu|tempeh|peanuts)(?: anymore)?", text, re.I)
    if english_pref:
        food = {"chicken": "ayam", "fish": "ikan", "beef": "sapi", "shrimp": "udang", "eggs": "telur", "tofu": "tahu", "tempeh": "tempe", "peanuts": "kacang"}[english_pref[2].lower()]
        return "excluded_food:" + food, english_pref[1].lower() != "like"
    pref = parse_preference(message)
    if pref: return "excluded_food:" + pref[0], pref[1]
    if re.fullmatch(r"(?:I(?: am|'m) trying to eat less fried food|I want to eat less fried food|saya (?:ingin|mau|sedang mencoba) (?:mengurangi|kurangi) (?:gorengan|makanan goreng))", text, re.I):
        return "reduce_fried_food", True
    allergy = parse_allergy_statement(message)
    if allergy:
        return "allergy:" + allergy["allergen"], True
    birth = re.fullmatch(r"(?:my (?:birth date|date of birth) is|tanggal lahir saya(?: adalah)?) (\d{4}-\d{2}-\d{2})", text, re.I)
    if birth:
        validate("birth_date", birth[1]); return "birth_date", birth[1]
    return None

def canonical_value(db, uid, profile, field):
    if field == "meal_budget_idr": return profile.meal_budget_idr
    if field.startswith("allergy:"): return normalize_allergen(field[8:]) in normalize_allergens(profile.allergies)
    if field.startswith("excluded_food:"): return field[14:] in preferences(db, uid)
    return (profile.learned_palate or {}).get(field, False if field == "reduce_fried_food" else None)

def records(db, uid):
    return db.query(UserActionLog).filter_by(user_id=uid, action_type=KIND).order_by(UserActionLog.created_at.asc(), UserActionLog.id.asc()).all()

def public(row):
    return {"action_id": row.id, **row.payload}

def pending(db, uid):
    return [public(r) for r in records(db, uid) if r.payload.get("status") == "pending" and datetime.fromisoformat(r.payload["expires_at"]) > now()]

def propose(db, uid, field, value, *, certainty=None):
    if field.startswith("allergy:"):
        field = "allergy:" + normalize_allergen(field[8:])
    validate(field, value)
    from ..db import crud
    user = crud.get_user(db, uid)
    if (field.startswith("allergy:") or field == "birth_date") and (not user or not user.consent_health_data):
        raise HTTPException(403, "Enable health-data consent before saving health statements in chat.")
    profile = db.query(HealthProfile).filter_by(user_id=uid).with_for_update().first()
    if profile is None: raise HTTPException(409, "Please complete your profile first.")
    for row in records(db, uid):
        if row.payload.get("field") == field and row.payload.get("status") == "pending":
            row.payload = {**row.payload, "status": "superseded"}
    row = UserActionLog(user_id=uid, action_type=KIND, payload={
        "field": field, "old_value": canonical_value(db, uid, profile, field), "proposed_value": value,
        "scope": "pending_confirmation", "today_only": field == "excluded_food:nasi", "status": "pending", "source": "explicit_statement",
        "expires_at": (now() + timedelta(minutes=15)).isoformat(),
        "temporary_until": day_end().isoformat(),
        **({"certainty": certainty if certainty in ("possible", "self_reported") else "self_reported"} if field.startswith("allergy:") else {}),
    })
    db.add(row); db.flush()
    return public(row)

def effective_profile(db, uid):
    profile = db.query(HealthProfile).filter_by(user_id=uid).first()
    state = {"meal_budget_idr": profile.meal_budget_idr if profile else None,
             "allergies": normalize_allergens(profile.allergies) if profile else [],
             "excluded_foods": preferences(db, uid),
             "reduce_fried_food": bool((profile.learned_palate or {}).get("reduce_fried_food")) if profile else False,
             "goal": profile.goal.value if profile else None,
             "age": profile.age if profile else None, "temporary_until": None}
    birth = (profile.learned_palate or {}).get("birth_date") if profile else None
    if birth: state["age"] = age_from_birth_date(birth)
    for row in records(db, uid):
        p = row.payload; field = p.get("field", "")
        active_today = p.get("status") == "applied" and p.get("scope") == "today"
        precaution = p.get("status") == "pending" and (field.startswith("allergy:") or field == "reduce_fried_food")
        if not (active_today or precaution) or datetime.fromisoformat(p["temporary_until"]) <= now(): continue
        value = p["proposed_value"]
        if field.startswith("allergy:") and value:
            state["allergies"] = normalize_allergens(state["allergies"] + [field[8:]])
        elif field.startswith("excluded_food:"):
            food = field[14:]; state["excluded_foods"] = [x for x in state["excluded_foods"] if x != food] + ([food] if value else [])
        elif field in ("meal_budget_idr", "reduce_fried_food"):
            state[field] = value
        state["temporary_until"] = p["temporary_until"]
    cutoff = now() - timedelta(days=7)
    dismissals = db.query(UserActionLog).filter(UserActionLog.user_id == uid,
        UserActionLog.action_type == "DISMISS_SUGGESTION", UserActionLog.created_at >= cutoff).count()
    state["advice_style"] = "quiet" if dismissals >= 3 else "standard"
    state["advice_style_source"] = "provisional_recent_dismissals" if dismissals >= 3 else "default"
    return state

def decide(db, uid, action_id, choice):
    if choice not in ("permanent", "today", "reject"): raise HTTPException(422, "Invalid choice.")
    # Lock the profile first everywhere to serialize competing updates without deadlocks.
    profile = db.query(HealthProfile).filter_by(user_id=uid).with_for_update().first()
    row = db.query(UserActionLog).filter_by(id=action_id, user_id=uid, action_type=KIND).with_for_update().first()
    if not row: raise HTTPException(404, "Proposal not found.")
    p = row.payload
    if p.get("status") != "pending": raise HTTPException(409, "This proposal has already been processed.")
    if datetime.fromisoformat(p["expires_at"]) <= now(): raise HTTPException(410, "This proposal expired. Please request the change again.")
    field, value = p["field"], p["proposed_value"]
    validate(field, value)
    if choice != "reject" and (field.startswith("allergy:") or field == "birth_date"):
        from ..db import crud
        if not crud.get_user(db, uid).consent_health_data:
            raise HTTPException(403, "Health-data consent is required.")
    if choice == "permanent" and p.get("today_only"):
        raise HTTPException(422, "This request is explicitly for today only.")
    if choice != "reject":
        if profile is None: raise HTTPException(409, "Your profile is not ready.")
        if canonical_value(db, uid, profile, field) != p["old_value"]: raise HTTPException(409, "Your profile changed. Please request a new proposal.")
        if choice == "today" and field == "birth_date": raise HTTPException(422, "A birth date cannot be changed for one day.")
        if choice == "permanent":
            if field == "meal_budget_idr": profile.meal_budget_idr = value
            elif field.startswith("allergy:"):
                profile.allergies = normalize_allergens([*(profile.allergies or []), field[8:]])
            elif field.startswith("excluded_food:"):
                food = field[14:]
                db.query(UserMemoryItem).filter(UserMemoryItem.user_id == uid, UserMemoryItem.source == SOURCE,
                    UserMemoryItem.fact_text.in_([f"Tidak suka {food}.", f"Suka {food}."])).delete(synchronize_session=False)
                db.add(UserMemoryItem(user_id=uid, category="preference", source=SOURCE, confidence=1,
                    fact_text=f"{'Tidak suka' if value else 'Suka'} {food}."))
            else:
                profile.learned_palate = {**(profile.learned_palate or {}), field: value}
                if field == "birth_date": profile.age = age_from_birth_date(value)
            # Derived facts never outrank the canonical record. Keep them as superseded evidence.
            for memory in db.query(UserMemoryItem).filter_by(user_id=uid).all():
                relevant = (field == "meal_budget_idr" and re.search(r"budget|anggaran", memory.fact_text, re.I)) or (field == "reduce_fried_food" and re.search(r"goreng|fried", memory.fact_text, re.I))
                if relevant and memory.source in ("onboarding_persona", "chat_interaction", "implicit_swap", "order_history"):
                    memory.source = "superseded_derived"
    for other in (records(db, uid) if choice != "reject" else []):
        if other.id != row.id and other.payload.get("field") == field and other.payload.get("status") == "applied" and other.payload.get("scope") == "today":
            other.payload = {**other.payload, "status": "superseded"}
    row.payload = {**p, "status": "rejected" if choice == "reject" else "applied", "scope": choice}
    db.flush()
    return public(row)
