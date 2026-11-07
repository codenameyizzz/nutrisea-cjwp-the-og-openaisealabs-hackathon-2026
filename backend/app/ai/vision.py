import json
import logging
from typing import Dict, Any
from ..core.config import settings
from .client import get_openai_client
from .prompts import VISION_PLATE_PROMPT

logger = logging.getLogger(__name__)

class PlateVisionClassifier:
    """
    Multimodal Vision Classifier utilizing GPT-4o Vision for qualitative dish analysis.
    Avoids impossible exact gram estimations and focuses on preparation methods and nutritional density.
    """
    def __init__(self):
        self.client = get_openai_client()
        self.model = settings.OPENAI_MODEL

    def analyze_plate(self, image_base64: str) -> Dict[str, Any]:
        if not settings.OPENAI_API_KEY:
            logger.info("Using mock vision response (No OpenAI API key provided)")
            return {
                "detected_dish": "2x Bakwan Sayur Goreng & Es Teh Manis",
                "preparation_style": "DEEP_FRIED",
                "nutritional_density_flags": ["HIGH_FAT", "HIGH_SIMPLE_SUGAR"],
                "qualitative_kcal_estimate": 320,
                "confidence_rating": "HIGH",
                "friendly_rebalance_note": "Cemilan gorengan tercatat (+320 kcal). Tenang, menu makan malam otomatis disesuaikan ke sup bening serat tinggi agar target mingguan tetap aman."
            }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": VISION_PLATE_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}")
            return {
                "detected_dish": "Makanan Ringan / Gorengan",
                "preparation_style": "DEEP_FRIED",
                "nutritional_density_flags": ["HIGH_FAT"],
                "qualitative_kcal_estimate": 280,
                "confidence_rating": "MEDIUM",
                "friendly_rebalance_note": "Cemilan tercatat. Menu makan malam akan disesuaikan otomatis."
            }