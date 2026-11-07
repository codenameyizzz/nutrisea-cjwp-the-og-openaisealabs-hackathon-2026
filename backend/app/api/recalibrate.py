from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.ingredient_auth import current_principal
from .preferences import personalized_recommendation
router = APIRouter(prefix="/api/recalibrate", tags=["Dynamic Recalibration"])

@router.post("")
def recalibrate_dinner(principal=Depends(current_principal), db: Session = Depends(get_db)):
    return {"status": "NO_AUTOMATIC_RECALIBRATION", "message": "Perubahan target membutuhkan catatan konsumsi yang dikonfirmasi.",
            "recommendation": personalized_recommendation(principal=principal, db=db)}
