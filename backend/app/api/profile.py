from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..personas.engine import PersonaSynthesizer
from ..personas.presets import PERSONA_PRESETS

router = APIRouter(prefix="/api/profile", tags=["Profile"])
engine = PersonaSynthesizer()

class SwitchPersonaRequest(BaseModel):
    persona_id: str

@router.get("")
def get_current_profile(persona_id: Optional[str] = None):
    target = persona_id or engine.active_persona_id
    if target not in PERSONA_PRESETS:
        raise HTTPException(status_code=404, detail="Persona not found")
    return engine.get_persona(target)

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
def switch_persona(payload: SwitchPersonaRequest):
    if payload.persona_id not in PERSONA_PRESETS:
        raise HTTPException(status_code=400, detail="Invalid persona ID")
    engine.active_persona_id = payload.persona_id
    return {"status": "success", "active_persona": engine.get_persona(payload.persona_id)}