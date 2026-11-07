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
    if not candidate_dishes:
        return {"source": "deterministic", "status": "no_candidates", "menu_item": None}
    dish = candidate_dishes[0]
    return {"source": "deterministic", "menu_item": {"item_id": dish.get("item_id"),
            "item_name": dish.get("item_name"), "price_idr": dish.get("discounted_price"),
            "cooking_notes": dish.get("default_cooking_notes")}}


class MealPlannerAgent:
    """
    Deterministic Meal Planner generating 1-Click ShopeeFood recommendations with clinical guardrails.
    """
    def __init__(self):
        self.client = get_openai_client()
        self.model = settings.OPENAI_MODEL

    def plan_lunch(self, persona: Dict[str, Any], candidate_dishes: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not candidate_dishes or not is_api_key_configured():
            return get_fallback_recommendation(candidate_dishes)

        prompt_payload = {
            "user_persona": persona,
            "candidate_dishes": candidate_dishes
        }

        try:
            response = self.client.with_options(timeout=8.0, max_retries=0).chat.completions.create(
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
            logger.warning("Meal planner unavailable: %s", type(e).__name__)
            return get_fallback_recommendation(candidate_dishes)
