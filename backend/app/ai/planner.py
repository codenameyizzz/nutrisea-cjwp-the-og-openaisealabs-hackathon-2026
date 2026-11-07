import json
import logging
from typing import Dict, Any, List
from ..core.config import settings
from .client import get_openai_client
from .prompts import MEAL_PLANNER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

def is_api_key_configured() -> bool:
    key = settings.OPENAI_API_KEY or ""
    if not key or "your_google_ai" in key or "..." in key or key.startswith("mock"):
        return False
    return True

def get_fallback_recommendation(candidate_dishes: List[Dict[str, Any]]) -> Dict[str, Any]:
    first_dish = candidate_dishes[0] if candidate_dishes else {
        "item_name": "Paket Sehat Ayam Bakar Dada + Sayur Bening Bayam",
        "merchant_name": "Warteg Berkah Mandiri - Kuningan",
        "discounted_price": 25600,
        "has_promo": True,
        "healthy_tags": ["MINYAK_BARU", "SAYUR_BENING", "TANPA_SANTAN"],
        "estimated_macros": {"kcal": 410, "protein_g": 36, "sodium_mg": 580},
        "default_cooking_notes": "Nasi setengah porsi, sambal dipisah, tanpa kuah santan"
    }
    return {
        "source": "deterministic",
        "recommendation_id": "REC-MOCK-001",
        "selected_merchant": {
            "merchant_name": first_dish.get("merchant_name", "Warteg Berkah Mandiri"),
            "distance_km": 0.8
        },
        "menu_item": {
            "item_name": first_dish.get("item_name"),
            "price_idr": first_dish.get("discounted_price"),
            "cooking_notes": first_dish.get("default_cooking_notes")
        },
        "justification_chips": [
            "Hemat 20% Promo Hari Ini",
            f"Tinggi Protein ({first_dish.get('estimated_macros', {}).get('protein_g', 36)}g)",
            "Bebas Kacang"
        ],
        "balance_impact": {
            "consumed_kcal": first_dish.get("estimated_macros", {}).get("kcal", 410),
            "remaining_daily_kcal": 540
        }
    }

class MealPlannerAgent:
    """
    Deterministic Meal Planner generating 1-Click ShopeeFood recommendations with clinical guardrails.
    """
    def __init__(self):
        self.client = get_openai_client()
        self.model = settings.OPENAI_MODEL

    def plan_lunch(self, persona: Dict[str, Any], candidate_dishes: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not is_api_key_configured():
            return get_fallback_recommendation(candidate_dishes)

        prompt_payload = {
            "user_persona": persona,
            "candidate_dishes": candidate_dishes
        }

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": MEAL_PLANNER_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(prompt_payload)}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            result = json.loads(response.choices[0].message.content)
            result["source"] = "openai"
            return result
        except Exception as e:
            logger.error(f"Meal planning LLM call failed: {e}")
            return get_fallback_recommendation(candidate_dishes)
