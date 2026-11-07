from fastapi import APIRouter, HTTPException, Depends
from ..core.ingredient_auth import current_principal
from ..core.database import get_db
from ..services.profile_actions import effective_profile
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..personas.engine import PersonaSynthesizer
from ..personas.presets import PERSONA_PRESETS

router = APIRouter(prefix="/api/profile", tags=["Profile"])
engine = PersonaSynthesizer()

class SwitchPersonaRequest(BaseModel):
    persona_id: str

@router.get("")
def get_current_profile(principal=Depends(current_principal), db=Depends(get_db)):
    return effective_profile(db, principal.user_id)

@router.get("/presets")
def list_presets():
    return [
        {
            "id": pid,
            "name": p["name"],
            "archetype": p["archetype"],
            "district": p["district"]
        }
        for pid, p in PERSONA_PRESETS.items()
    ]

@router.post("/switch")
def switch_persona(payload: SwitchPersonaRequest, principal=Depends(current_principal)):
    raise HTTPException(410, "Use authenticated persona assignment during onboarding.")
