import json
import os
from fastapi import APIRouter, Query
from typing import Optional, Dict, Any
from ..personas.engine import PersonaSynthesizer
from ..ai.planner import MealPlannerAgent
from ..core.guardrails import validate_meal_safety

router = APIRouter(prefix="/api/recommend", tags=["Recommendation"])
engine = PersonaSynthesizer()
planner = MealPlannerAgent()

def load_seed_catalog():
    catalog_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "seed_catalog.json")
    if os.path.exists(catalog_path):
        with open(catalog_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/lunch")
def get_lunch_recommendation(persona_id: Optional[str] = Query(None)):
    persona = engine.get_persona(persona_id)
    catalog = load_seed_catalog()

    # Filter candidates with clinical guardrails
    safe_candidates = []
    for dish in catalog:
        check = validate_meal_safety(dish, persona["constraints"])
        if check["is_safe"]:
            safe_candidates.append(dish)

    recommendation = planner.plan_lunch(persona, safe_candidates or catalog)
    return recommendation

@router.post("/swap")
def swap_recommendation(rejected_item: str, persona_id: Optional[str] = None):
    persona = engine.get_persona(persona_id)
    catalog = load_seed_catalog()
    # Choose alternative dish different from rejected
    alternatives = [d for d in catalog if d["item_name"] != rejected_item]
    next_best = alternatives[0] if alternatives else catalog[0]
    engine.record_meal_swap(rejected_item, next_best["item_name"])
    return planner.plan_lunch(persona, [next_best])