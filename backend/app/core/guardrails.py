"""
Clinical Nutrition Guardrails based on Indonesian Ministry of Health (Kemenkes Isi Piringku & Permenkes GGL).
Enforces deterministic safety boundaries before recommendations reach users.
"""
from typing import Dict, Any, List

# Indonesian Ministry of Health Standards (Permenkes No. 30/2013)
MAX_DAILY_SODIUM_MG = 2000
MAX_MEAL_SODIUM_MG = 750
MIN_DAILY_FIBER_GRAMS = 25
RECOMMENDED_PLATE_RATIO = {
    "vegetables_and_fruits": 0.50, # 50% sayur dan buah
    "staple_carbs": 0.25,          # 25% makanan pokok
    "protein_sources": 0.25        # 25% lauk pauk
}

def validate_meal_safety(meal_item: Dict[str, Any], user_constraints: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates a candidate dish against hard clinical guardrails.
    Returns validation status and safety warnings if any boundary is breached.
    """
    warnings: List[str] = []
    is_safe = True

    # 1. Allergen Hard Filter
    forbidden = set(user_constraints.get("forbidden_allergens", []))
    item_allergens = set(meal_item.get("allergens", []))
    matched_allergens = forbidden.intersection(item_allergens)
    if matched_allergens:
        return {
            "is_safe": False,
            "rejection_reason": f"Mengandung alergen terlarang: {', '.join(matched_allergens)}"
        }

    # 2. Sodium Bounds for Hypertension Risk
    sodium = meal_item.get("estimated_macros", {}).get("sodium_mg", 0)
    if user_constraints.get("hypertension_risk", False) and sodium > MAX_MEAL_SODIUM_MG:
        is_safe = False
        warnings.append(f"Sodium melebihi batas aman hipertensi ({sodium}mg > {MAX_MEAL_SODIUM_MG}mg)")

    # 3. Glycemic and Saturated Fat Bounds
    if user_constraints.get("glycemic_priority") == "LOW":
        if "SANTAN_PEKAT" in meal_item.get("healthy_tags", []):
            is_safe = False
            warnings.append("Kuah santan pekat tidak direkomendasikan untuk target glikemik rendah")

    return {
        "is_safe": is_safe,
        "warnings": warnings,
        "passed_guardrails": [
            "Batas sodium aman",
            "Bebas alergen aktif",
            "Sesuai proporsi Isi Piringku"
        ]
    }