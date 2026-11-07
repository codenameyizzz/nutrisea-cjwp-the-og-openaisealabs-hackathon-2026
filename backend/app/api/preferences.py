"""Authenticated preference updates and recommendations from the live catalog."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.ingredient_auth import current_principal
from ..db import crud
from ..models.menu_item import MenuItem
from ..services.explicit_preferences import preferences, save_preference, matches_preference
from ..services.recommendation_scorer import passes_hard_filters
from .dishes import serialize_dish
from ..ai.planner import MealPlannerAgent

router = APIRouter(prefix="/api/preferences", tags=["Adaptive preferences"])


class PreferenceMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.post("")
def update_preferences(payload: PreferenceMessage, principal=Depends(current_principal), db: Session = Depends(get_db)):
    changed = save_preference(db, principal.user_id, payload.message)
    return {"recognized": changed, "status": "saved" if changed else "not_recognized",
            "excluded_foods": preferences(db, principal.user_id), "user_id": principal.user_id}


@router.get("")
def read_preferences(principal=Depends(current_principal), db: Session = Depends(get_db)):
    return {"excluded_foods": preferences(db, principal.user_id), "user_id": principal.user_id}


@router.get("/recommendation")
def personalized_recommendation(principal=Depends(current_principal), db: Session = Depends(get_db)):
    excluded = preferences(db, principal.user_id)
    health = crud.get_health_profile(db, principal.user_id)
    # Reference personas describe examples, not this account's medical facts.
    profile = {
        "allergens": health.allergies or [] if health else [],
        "medical_conditions": [],
    }
    budget = health.meal_budget_idr if health else None
    items = db.query(MenuItem).filter(MenuItem.is_available.is_(True)).order_by(MenuItem.id).all()
    candidates = [serialize_dish(item, item.restaurant, item.merchant) for item in items
                  if item.merchant and item.merchant.is_open
                  and (item.restaurant is None or item.restaurant.is_open)]
    candidates = [d for d in candidates if passes_hard_filters(d, profile)
                  and matches_preference(d, excluded)
                  and (budget is None or d["discountedPrice"] <= budget)]
    selected = candidates[0] if candidates else None
    source = "deterministic"
    if candidates:
        planner_candidates = [{"item_id": d["id"], "item_name": d["name"],
                               "merchant_name": d["merchantName"], "discounted_price": d["discountedPrice"],
                               "default_cooking_notes": d["cookingNotes"],
                               "estimated_macros": {"kcal": d["macros"]["kcal"], "protein_g": d["macros"]["proteinG"]}}
                              for d in candidates]
        result = MealPlannerAgent().plan_lunch({"excluded_foods": excluded, "budget": budget}, planner_candidates)
        meal = result.get("selected_meal") or result.get("menu_item") or {}
        if not isinstance(meal, dict):
            meal = {}
        match = next((d for d in candidates if d["id"] == meal.get("item_id")), None)
        if match is None:
            name_matches = [d for d in candidates if d["name"] == meal.get("item_name")]
            match = name_matches[0] if len(name_matches) == 1 else None
        if match:
            selected = match
            source = result.get("source", "deterministic")
    return {"status": "ok" if candidates else "no_candidates", "source": source,
            "user_id": principal.user_id, "excluded_foods": excluded,
            "candidate_ids": [d["id"] for d in candidates],
            "dish": selected,
            "reason": ("Pilihan dari katalog tersedia dan preferensi tersimpan. "
                       + (f"Harga menu maksimal Rp {budget:,}; belum termasuk ongkir." if budget is not None
                          else "Anggaran belum diatur."))
                      if candidates else "Belum ada menu sesuai batasan dan preferensi Anda."}
