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

    def analyze_plate(self, image_base64: str, image_mime_type: str = "image/jpeg") -> Dict[str, Any]:
        if not image_base64 or not settings.OPENAI_API_KEY:
            return self.unavailable()

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
                                    "url": f"data:{image_mime_type};base64,{image_base64}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            result = json.loads(response.choices[0].message.content)
            if not isinstance(result, dict):
                return self.unavailable()
            result.update(analysis_source="ai", analysis_status="success")
            result["friendly_rebalance_note"] = "Hasil ini merupakan perkiraan dan belum dicatat sebagai makanan Anda."
            return result
        except Exception as error:
            logger.warning("Vision analysis unavailable: %s", type(error).__name__)
            return self.unavailable()

    @staticmethod
    def unavailable():
        return {
            "analysis_source": "unavailable",
            "analysis_status": "unavailable",
            "detected_dish": None,
            "qualitative_kcal_estimate": None,
            "confidence_rating": None,
            "nutritional_density_flags": [],
            "friendly_rebalance_note": "Foto belum berhasil dianalisis. Tidak ada makanan yang dicatat. Silakan coba lagi.",
        }
