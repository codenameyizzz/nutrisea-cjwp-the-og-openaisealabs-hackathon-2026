from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.ingredient_auth import current_principal
from .preferences import personalized_recommendation
router = APIRouter(prefix="/api/recommend", tags=["Recommendation"])

@router.get("/lunch")
def get_lunch_recommendation(principal=Depends(current_principal), db: Session = Depends(get_db)):
    return personalized_recommendation(principal=principal, db=db)

@router.post("/swap")
def swap_recommendation(rejected_item: str, principal=Depends(current_principal), db: Session = Depends(get_db)):
    result = personalized_recommendation(principal=principal, db=db)
    choices = [d for d in result["candidates"] if rejected_item not in (d["id"], d["name"])]
    result.update(dish=choices[0] if choices else None, candidates=choices, candidate_ids=[d["id"] for d in choices], status="ok" if choices else "no_candidates")
    return result
