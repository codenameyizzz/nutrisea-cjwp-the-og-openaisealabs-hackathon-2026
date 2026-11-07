from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..ai.vision import PlateVisionClassifier

router = APIRouter(prefix="/api/scan", tags=["Vision Scanner"])
classifier = PlateVisionClassifier()

class ScanPhotoRequest(BaseModel):
    image_base64: Optional[str] = None

@router.post("")
def scan_meal_photo(payload: ScanPhotoRequest):
    result = classifier.analyze_plate(payload.image_base64 or "")
    return result