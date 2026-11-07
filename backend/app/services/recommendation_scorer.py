from typing import Dict, Any, List, Optional, Tuple
import math
import random
import re
from .allergens import normalize_allergens

FALLBACK_NEUTRAL_VALUE = 0.50
VARIANCE_MIN = 0.85
VARIANCE_MAX = 1.00
MAX_MEAL_SODIUM_HYPERTENSION_MG = 750


def passes_hard_filters(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> bool:
    """
    Hard filters: Excludes unavailable items and known allergy or medical restrictions.
    High recommendation scores cannot override these restrictions.
    """
    if item.get("is_available") is False or item.get("isAvailable") is False:
        return False

    if not profile:
        return True

    # 1. Allergen Hard Filter
    raw_allergens = profile.get("allergens") or []
    user_allergens = normalize_allergens(raw_allergens)

    if user_allergens:
        if item.get("allergenCoverage") != "complete":
            return False
        item_allergens = normalize_allergens(item.get("allergens"))
        item_name = str(item.get("name") or item.get("item_name") or "").lower()
        for allergen in user_allergens:
            if allergen in item_allergens:
                return False
            if allergen == "kacang" and "kacang" in item_name:
                return False
            if allergen == "udang" and "udang" in item_name:
                return False
            if allergen == "seafood" and any(x in item_name for x in ["udang", "cumi", "kepiting"]):
                return False
            if allergen == "telur" and re.search(r"\b(?:egg|eggs|telur)\b", item_name):
                return False

    # 2. Medical condition guardrails (e.g. Hypertension sodium cap)
    raw_conditions = profile.get("medical_conditions") or profile.get("medicalConditions") or []
    user_conditions = []
    if isinstance(raw_conditions, list):
        user_conditions = [str(c).upper().strip() for c in raw_conditions if c and str(c).upper() != "NONE"]
    elif isinstance(raw_conditions, str) and raw_conditions.upper() != "NONE":
        user_conditions = [c.upper().strip() for c in raw_conditions.split(",") if c.strip()]

    has_hypertension = any("HYPERTENSION" in c or "HIPERTENSI" in c for c in user_conditions)
    macros = item.get("macros") or item.get("estimated_macros") or {}
    sodium_mg = macros.get("sodium_mg") or macros.get("sodiumMg") or item.get("sodium_mg") or 0
    if has_hypertension and sodium_mg > MAX_MEAL_SODIUM_HYPERTENSION_MG:
        return False

    return True


def compute_primary_persona_fit(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Tuple[float, bool]:
    primary_id = profile.get("primary_persona_id") or profile.get("primaryPersonaId") if profile else None
    if not primary_id or not str(primary_id).strip():
        return FALLBACK_NEUTRAL_VALUE, True

    personas = item.get("personas") or item.get("matched_personas") or item.get("matchedPersonas")
    if personas is None:
        return FALLBACK_NEUTRAL_VALUE, True

    is_matched = str(primary_id).strip() in personas
    return 1.0 if is_matched else 0.0, False


def compute_secondary_persona_fit(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Tuple[float, bool]:
    side_ids = profile.get("secondary_persona_ids") or profile.get("secondaryPersonaIds") or profile.get("side_persona_ids") if profile else None
    if not side_ids or not isinstance(side_ids, list) or len(side_ids) == 0:
        return FALLBACK_NEUTRAL_VALUE, True

    personas = item.get("personas") or item.get("matched_personas") or item.get("matchedPersonas")
    if personas is None:
        return FALLBACK_NEUTRAL_VALUE, True

    matched_count = sum(1 for sid in side_ids if sid in personas)
    score = min(1.0, max(0.0, matched_count / len(side_ids)))
    return score, False


def compute_budget_fit(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Tuple[float, bool]:
    target_budget = profile.get("target_budget") or profile.get("targetBudget") or profile.get("target_lunch_budget_idr") if profile else None
    if target_budget is None or target_budget <= 0:
        return FALLBACK_NEUTRAL_VALUE, True

    price = item.get("discounted_price_idr") or item.get("discountedPrice") or item.get("base_price_idr") or item.get("basePrice") or item.get("price_idr")
    if price is None or price <= 0:
        return FALLBACK_NEUTRAL_VALUE, True

    if price <= target_budget:
        return 1.0, False

    excess = price - target_budget
    max_excess = target_budget * 0.50
    score = max(0.0, 1.0 - excess / max_excess)
    return round(score, 4), False


def compute_goal_alignment(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Tuple[float, bool]:
    goal = profile.get("health_goal") or profile.get("healthGoal") or profile.get("archetype_code") or profile.get("archetypeCode") if profile else None
    if not goal or not str(goal).strip():
        return FALLBACK_NEUTRAL_VALUE, True

    g = str(goal).lower()
    macros = item.get("macros") or item.get("estimated_macros") or {}
    protein = float(macros.get("protein_g") or macros.get("proteinG") or item.get("protein_g") or 0)
    kcal = int(macros.get("kcal") or item.get("kcal") or 0)
    fat = float(macros.get("fat_g") or macros.get("fatG") or item.get("fat_g") or 0)
    sodium = int(macros.get("sodium_mg") or macros.get("sodiumMg") or item.get("sodium_mg") or 0)
    category = str(item.get("category") or "").lower()

    if any(x in g for x in ["otot", "muscle", "fitness", "budget_fitness"]):
        if protein >= 25 or category == "protein":
            return 1.0, False
        if protein >= 18:
            return 0.75, False
        if protein >= 12:
            return 0.50, False
        return 0.20, False

    if any(x in g for x in ["turun", "defisit", "diet", "rendah-kalori"]):
        if (kcal > 0 and kcal <= 350) or category == "rendah-kalori":
            return 1.0, False
        if kcal <= 450:
            return 0.75, False
        if kcal <= 550:
            return 0.50, False
        return 0.20, False

    if any(x in g for x in ["gerd", "maag", "lambung", "digestive"]):
        if category == "lambung" or (fat > 0 and fat <= 12):
            return 1.0, False
        if fat <= 18:
            return 0.60, False
        return 0.20, False

    if any(x in g for x in ["ideal", "preventive", "overloaded", "sehat"]):
        if kcal <= 500 and sodium <= 550 and protein >= 15:
            return 1.0, False
        if sodium <= 750:
            return 0.70, False
        return 0.40, False

    return FALLBACK_NEUTRAL_VALUE, False


def compute_nutrition_fit(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Tuple[float, bool]:
    target_kcal = profile.get("target_lunch_kcal") or profile.get("targetLunchKcal") if profile else None
    if target_kcal is None or target_kcal <= 0:
        return FALLBACK_NEUTRAL_VALUE, True

    macros = item.get("macros") or item.get("estimated_macros") or {}
    item_kcal = macros.get("kcal") or item.get("kcal")
    if item_kcal is None or item_kcal <= 0:
        return FALLBACK_NEUTRAL_VALUE, True

    diff = abs(item_kcal - target_kcal)
    if diff <= 0.10 * target_kcal:
        return 1.0, False

    max_diff = target_kcal * 0.50
    score = max(0.0, 1.0 - diff / max_diff)
    return round(score, 4), False


def compute_preference_fit(item: Dict[str, Any], profile: Optional[Dict[str, Any]] = None) -> Tuple[float, bool]:
    tags_raw = profile.get("preferred_tags") or profile.get("preferredTags") if profile else None
    tags = []
    if isinstance(tags_raw, list):
        tags = [str(t).lower().strip() for t in tags_raw if t]
    elif isinstance(tags_raw, str):
        tags = [t.lower().strip() for t in tags_raw.split(",") if t.strip()]

    if not tags:
        return FALLBACK_NEUTRAL_VALUE, True

    healthy_tags = item.get("healthy_tags") or item.get("healthyTags") or []
    item_text = " ".join([
        str(item.get("name") or item.get("item_name") or ""),
        str(item.get("category") or ""),
        " ".join(healthy_tags)
    ]).lower()

    matches = sum(1 for t in tags if t in item_text)
    if matches >= 2:
        return 1.0, False
    if matches == 1:
        return 0.75, False
    return 0.20, False


def compute_query_relevance(item: Dict[str, Any], query: Optional[str] = None) -> Tuple[float, bool]:
    if query is None or not query.strip():
        return 0.0, False

    q = query.strip().lower()
    name = str(item.get("name") or item.get("item_name") or "").lower()
    category = str(item.get("category") or "").lower()
    merchant = str(item.get("merchant_name") or item.get("merchantName") or item.get("restaurantName") or "").lower()
    healthy_tags = item.get("healthy_tags") or item.get("healthyTags") or []
    tags_str = " ".join(healthy_tags).lower()

    if q in name:
        return 1.0, True

    tokens = q.split()
    if not tokens:
        return FALLBACK_NEUTRAL_VALUE, True

    matched = sum(1 for t in tokens if t in name or t in tags_str or t in category or t in merchant)
    if matched == len(tokens):
        return 0.90, True
    elif matched > 0:
        score = 0.40 + 0.50 * (matched / len(tokens))
        return round(score, 4), True

    return 0.0, True


def score_menu_item(
    item: Dict[str, Any],
    profile: Optional[Dict[str, Any]] = None,
    search_query: Optional[str] = None,
    variance: Optional[float] = None
) -> Dict[str, Any]:
    missing_vars = []

    p_score, p_miss = compute_primary_persona_fit(item, profile)
    if p_miss: missing_vars.append("P")

    s_score, s_miss = compute_secondary_persona_fit(item, profile)
    if s_miss: missing_vars.append("S")

    b_score, b_miss = compute_budget_fit(item, profile)
    if b_miss: missing_vars.append("B")

    g_score, g_miss = compute_goal_alignment(item, profile)
    if g_miss: missing_vars.append("G")

    n_score, n_miss = compute_nutrition_fit(item, profile)
    if n_miss: missing_vars.append("N")

    f_score, f_miss = compute_preference_fit(item, profile)
    if f_miss: missing_vars.append("F")

    # Generate V in [0.85, 1.00] once per item
    if variance is not None:
        v = min(VARIANCE_MAX, max(VARIANCE_MIN, variance))
    else:
        v = VARIANCE_MIN + random.random() * (VARIANCE_MAX - VARIANCE_MIN)

    q_score, has_query = compute_query_relevance(item, search_query)

    if not has_query:
        # Equation 1: No active search query
        # R(u, m) = (0.25P + 0.10S + 0.15B + 0.25G + 0.15N + 0.10F) Ã— V
        raw_score = (
            0.25 * p_score +
            0.10 * s_score +
            0.15 * b_score +
            0.25 * g_score +
            0.15 * n_score +
            0.10 * f_score
        )
    else:
        # Equation 2: Active search query
        # R(u, m) = (0.20P + 0.05S + 0.10B + 0.20G + 0.10N + 0.05F + 0.30Q) Ã— V
        raw_score = (
            0.20 * p_score +
            0.05 * s_score +
            0.10 * b_score +
            0.20 * g_score +
            0.10 * n_score +
            0.05 * f_score +
            0.30 * q_score
        )

    final_score = round(raw_score * v, 4)

    return {
        "p": p_score,
        "s": s_score,
        "b": b_score,
        "g": g_score,
        "n": n_score,
        "f": f_score,
        "q": q_score if has_query else None,
        "v": round(v, 4),
        "raw_score": round(raw_score, 4),
        "final_score": final_score,
        "has_search_query": has_query,
        "missing_variables": missing_vars
    }


def rank_recommendations(
    items: List[Dict[str, Any]],
    profile: Optional[Dict[str, Any]] = None,
    search_query: Optional[str] = None,
    variance_map: Optional[Dict[str, float]] = None,
    min_score: Optional[float] = None,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    if not items:
        return []

    # Assign stable V once per item
    v_map = variance_map or {}
    for it in items:
        item_id = str(it.get("id") or it.get("item_id") or "")
        if item_id not in v_map:
            v_map[item_id] = VARIANCE_MIN + random.random() * (VARIANCE_MAX - VARIANCE_MIN)

    scored_items = []
    for it in items:
        if not passes_hard_filters(it, profile):
            continue

        item_id = str(it.get("id") or it.get("item_id") or "")
        breakdown = score_menu_item(it, profile, search_query=search_query, variance=v_map.get(item_id))
        scored = dict(it)
        scored["recommendation_score"] = breakdown["final_score"]
        scored["score_breakdown"] = breakdown
        scored_items.append(scored)

    # Sort descending by recommendation_score
    scored_items.sort(key=lambda x: x["recommendation_score"], reverse=True)

    if min_score is not None:
        scored_items = [x for x in scored_items if x["recommendation_score"] >= min_score]

    if limit is not None and limit > 0:
        scored_items = scored_items[:limit]

    return scored_items
