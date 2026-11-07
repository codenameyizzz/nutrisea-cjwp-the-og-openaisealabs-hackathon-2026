from fastapi import APIRouter
from pydantic import BaseModel
from typing import Literal, Optional
from ..ai.vision import PlateVisionClassifier

router = APIRouter(prefix="/api/scan", tags=["Vision Scanner"])
classifier = PlateVisionClassifier()

class ScanPhotoRequest(BaseModel):
    image_base64: Optional[str] = None
    image_mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"

@router.post("")
def scan_meal_photo(payload: ScanPhotoRequest):
    result = classifier.analyze_plate(payload.image_base64 or "", payload.image_mime_type)
    return result
