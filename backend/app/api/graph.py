"""Account-scoped personal graph projections; template graph remains reference data."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from ..core.ingredient_auth import current_principal
from ..core.database import get_db
from ..db import crud
from ..services.knowledge_graph import nutrigraph_engine
from ..services.profile_actions import effective_profile, parse_change, propose
from .preferences import personalized_recommendation
router = APIRouter(prefix="/api/graph", tags=["Knowledge Graph"])

def owner(identifier, principal, db):
    user = crud.get_user(db, principal.user_id)
    if identifier != principal.user_id and (not user or identifier != user.main_persona_id):
        raise HTTPException(404, "Personal graph not found")

@router.get("/stats")
def stats(): return nutrigraph_engine.get_stats()

@router.get("/persona/{persona_id}")
def personal(persona_id: str, principal=Depends(current_principal), db=Depends(get_db)):
    owner(persona_id, principal, db)
    return {"user_id": principal.user_id, "profile": effective_profile(db, principal.user_id), "clinical_verified": False}

@router.get("/recommend/{persona_id}")
def recommend(persona_id: str, top_k: int = Query(5, ge=1, le=20), max_budget: Optional[int] = None, principal=Depends(current_principal), db=Depends(get_db)):
    owner(persona_id, principal, db)
    result = personalized_recommendation(principal=principal, db=db)
    dishes = [d for d in result["candidates"] if max_budget is None or d["discountedPrice"] <= max_budget][:top_k]
    return {"user_id": principal.user_id, "recommendations": dishes, "total_returned": len(dishes), "clinical_verified": False}

@router.get("/check-dish/{persona_id}/{food_id}")
@router.get("/explain/{persona_id}/{food_id}")
def check(persona_id: str, food_id: str, principal=Depends(current_principal), db=Depends(get_db)):
    owner(persona_id, principal, db)
    result = personalized_recommendation(principal=principal, db=db)
    dish = next((d for d in result["candidates"] if d["id"] == food_id), None)
    return {"user_id": principal.user_id, "food_id": food_id, "dish": dish, "eligible": dish is not None,
            "is_safe": False, "severity": "UNKNOWN", "clinical_verified": False,
            "reason": "Recipe coverage and cross-contact are not verified. Eligibility is not allergy safety certification."}

@router.get("/visualize/{persona_id}")
def visualize(persona_id: str, max_dishes: int = Query(4, ge=1, le=10), focus_dish_id: Optional[str] = None, principal=Depends(current_principal), db=Depends(get_db)):
    owner(persona_id, principal, db)
    state = effective_profile(db, principal.user_id)
    root = "USER:" + principal.user_id
    nodes = [{"id": root, "label": "Profil Anda", "type": "PERSONA", "color": "#B9371C", "data": state}]
    edges = []
    for allergy in state["allergies"]:
        key = root + ":ALLERGY:" + allergy
        nodes.append({"id": key, "label": allergy, "type": "ALLERGEN", "color": "#A12B25"})
        edges.append({"source": root, "target": key, "relation": "CURRENT_RESTRICTION"})
    rec = personalized_recommendation(principal=principal, db=db)
    dishes = rec["candidates"]
    if focus_dish_id: dishes = sorted(dishes, key=lambda d: d["id"] != focus_dish_id)
    for dish in dishes[:max_dishes]:
        nodes.append({"id": dish["id"], "label": dish["name"], "type": "DISH", "color": "#557364", "data": dish})
        edges.append({"source": root, "target": dish["id"], "relation": "ELIGIBLE_NOT_CLINICALLY_VERIFIED"})
    return {"resolved_persona_id": principal.user_id, "nodes": nodes, "edges": edges, "clinical_verified": False}

class MemoryIngestRequest(BaseModel):
    persona_id: str
    fact_text: str = Field(max_length=2000)
    category: str = "preference"

@router.post("/memory/add")
def add_memory(payload: MemoryIngestRequest, principal=Depends(current_principal), db=Depends(get_db)):
    owner(payload.persona_id, principal, db)
    change = parse_change(payload.fact_text)
    if not change: raise HTTPException(422, "Use an explicit supported profile statement in chat.")
    result = propose(db, principal.user_id, *change); db.commit()
    return {"status": "pending_confirmation", "pending_action": result}

class CoachingRequest(BaseModel):
    persona_id: str
    food_id: str
    user_query: Optional[str] = None

@router.post("/coach")
def coach(payload: CoachingRequest, principal=Depends(current_principal), db=Depends(get_db)):
    return check(payload.persona_id, payload.food_id, principal, db)
