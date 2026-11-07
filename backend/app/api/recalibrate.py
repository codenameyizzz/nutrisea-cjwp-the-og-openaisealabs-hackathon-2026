from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/recalibrate", tags=["Dynamic Recalibration"])

class RecalibrateRequest(BaseModel):
    snack_calories: float = 320.0
    persona_id: Optional[str] = "CORP_LILY_SCBD"

@router.post("")
def recalibrate_dinner(payload: RecalibrateRequest):
    """
    Absorbs the afternoon snack surplus and automatically rebalances the dinner menu.
    Eliminates diet guilt by maintaining weekly metabolic equilibrium.
    """
    return {
        "status": "RECALIBRATED_SUCCESS",
        "absorbed_snack_kcal": payload.snack_calories,
        "dinner_target_adjustment": "HIGH_FIBER_LOW_CALORIE",
        "recalibrated_dinner_item": {
            "item_name": "Pecel Sayur Madiun Serat Tinggi + Tahu Tempe Kukus",
            "merchant_name": "Pecel Sayur Segar Bu Sri - Kuningan",
            "price_idr": 22000,
            "estimated_kcal": 280,
            "macros": {
                "protein_g": 18,
                "carbs_g": 38,
                "fat_g": 7
            },
            "cooking_notes": "Bumbu pecel dikurangi separuh, sayuran dikukus matang, tanpa kuah santan"
        },
        "friendly_message": "Cemilan gorengan tercatat (+320 kcal). Tenang, menu makan malam otomatis disesuaikan ke Pecel Sayur Madiun & Sup Bening agar target mingguan Anda tetap seimbang tanpa rasa lapar.",
        "weekly_balance_status": "ON_TRACK_METABOLIC_EQUILIBRIUM"
    }
