"""Authenticated preference updates and recommendations from the live catalog."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload
from ..core.database import get_db
from ..core.ingredient_auth import current_principal
from ..db import crud
from ..models.menu_item import MenuItem
from ..services.explicit_preferences import preferences, save_preference, matches_preference
from ..services.recommendation_scorer import passes_hard_filters
from .dishes import serialize_dish
from ..ai.planner import MealPlannerAgent
from ..services.profile_actions import effective_profile
import re
import logging
from time import perf_counter
from ..services.recommendation_scorer import rank_recommendations

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
    started = perf_counter()
    state = effective_profile(db, principal.user_id)
    excluded = state["excluded_foods"]
    health = crud.get_health_profile(db, principal.user_id)
    profile = {"allergens": state["allergies"], "medical_conditions": []}
    budget = state["meal_budget_idr"]
    if health is not None and not state["temporary_until"]:
        budget = health.meal_budget_idr
    items = db.query(MenuItem).options(selectinload(MenuItem.tags), selectinload(MenuItem.merchant), selectinload(MenuItem.restaurant)).filter(MenuItem.is_available.is_(True)).order_by(MenuItem.id).all()
    candidates = [serialize_dish(item, item.restaurant, item.merchant) for item in items
                  if item.merchant and item.merchant.is_open
                  and (item.restaurant is None or item.restaurant.is_open)]
    candidates = [d for d in candidates if passes_hard_filters(d, profile)
                  and matches_preference(d, excluded)
                  and (budget is None or d["discountedPrice"] <= budget)]
    user = crud.get_user(db, principal.user_id)
    score_profile = {**profile, "target_budget": budget, "health_goal": {"LOSE_WEIGHT": "turun", "MAINTAIN": "ideal", "GAIN_MUSCLE": "otot"}.get(state["goal"], state["goal"]),
        "primary_persona_id": user.main_persona_id if user else None,
        "secondary_persona_ids": user.side_persona_ids if user else [],
        "target_lunch_kcal": round(health.kcal_target * 0.4) if health and hasattr(health, "kcal_target") else None}
    candidates = rank_recommendations(candidates, score_profile, variance_map={d["id"]: 1.0 for d in candidates})
    if state["reduce_fried_food"]:
        candidates.sort(key=lambda d: bool(re.search(r"goreng|crispy|fried|katsu", d["name"], re.I)))
    selected = candidates[0] if candidates else None
    source = "deterministic"
    if candidates and not state["reduce_fried_food"]:
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
    logging.getLogger(__name__).info("recommendation rule=profile-v1 retrieved=%d eligible=%d selected=%s source=%s latency_ms=%d",
        len(items), len(candidates), selected["id"] if selected else None, source, (perf_counter() - started) * 1000)
    return {"status": "ok" if candidates else "no_candidates", "source": source,
            "user_id": principal.user_id, "excluded_foods": excluded,
            "candidate_ids": [d["id"] for d in candidates], "candidates": candidates, "effective_profile": state,
            "dish": selected,
            "reason": ("Selected from the available catalog using your current preferences. "
                       + (f"Meal budget: Rp{budget:,}, excluding delivery." if budget is not None
                          else "No budget has been set."))
                      if candidates else "No dishes meet your current restrictions and preferences. Unknown recipe information cannot establish allergy safety."}
