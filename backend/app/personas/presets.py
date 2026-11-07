"""
Validated Consumer Persona Presets for Hackathon Live Demo & Evaluation.
Enables instant persona switching to test clinical bounds and personalized AI reasoning.
"""
from typing import Dict, Any

PERSONA_PRESETS: Dict[str, Dict[str, Any]] = {
    "CORP_LILY_SCBD": {
        "persona_id": "CORP_LILY_SCBD",
        "name": "Lily (Corporate Professional)",
        "archetype": "High-Intent, Low-Bandwidth Urban Desk Worker",
        "district": "SCBD",
        "biometrics": {
            "age": 28,
            "gender": "FEMALE",
            "activity_level": "SEDENTARY",
            "bmi_category": "NORMAL",
            "calculated_tdee": 1750,
            "target_daily_budget_kcal": 1450,
            "lunch_target_kcal": "420-500 kcal"
        },
        "constraints": {
            "radius_km": 2.5,
            "forbidden_allergens": ["PEANUTS"],
            "glycemic_priority": "MODERATE_TO_LOW",
            "prevent_sugar_crash": True,
            "hypertension_risk": False
        },
        "behavioral_weights": {
            "speed_of_decision": 0.95,
            "culinary_adventurousness": 0.40,
            "preferred_cuisines": ["JAWA_WARTEG", "SUNDA_LALAPAN", "SOTO_BENING"]
        }
    },
    "PREV_BUDI_KUNINGAN": {
        "persona_id": "PREV_BUDI_KUNINGAN",
        "name": "Budi (Preventive Health Starter)",
        "archetype": "Health-Anxious, Habit-Struggling Manager",
        "district": "Kuningan",
        "biometrics": {
            "age": 36,
            "gender": "MALE",
            "activity_level": "LIGHT_ACTIVE",
            "bmi_category": "OVERWEIGHT_MILD",
            "calculated_tdee": 1950,
            "target_daily_budget_kcal": 1600,
            "lunch_target_kcal": "450-550 kcal"
        },
        "constraints": {
            "radius_km": 3.0,
            "forbidden_allergens": [],
            "glycemic_priority": "LOW",
            "prevent_sugar_crash": True,
            "hypertension_risk": True,
            "max_sodium_per_meal_mg": 700,
            "avoid_saturated_fat": True
        },
        "behavioral_weights": {
            "speed_of_decision": 0.80,
            "culinary_adventurousness": 0.30,
            "preferred_cuisines": ["SOTO_KUDUS_BENING", "PECEL_MADIUN", "PADANG_AYAM_POP"]
        }
    },
    "FIT_RIAN_PALMERAH": {
        "persona_id": "FIT_RIAN_PALMERAH",
        "name": "Rian (Budget Fitness Enthusiast)",
        "archetype": "Macro-Focused, High-Protein Value Hunter",
        "district": "Palmerah",
        "biometrics": {
            "age": 23,
            "gender": "MALE",
            "activity_level": "MODERATE_ACTIVE",
            "bmi_category": "ATHLETIC",
            "calculated_tdee": 2200,
            "target_daily_budget_kcal": 1900,
            "lunch_target_kcal": "600-700 kcal"
        },
        "constraints": {
            "radius_km": 2.5,
            "forbidden_allergens": [],
            "glycemic_priority": "BALANCED",
            "prevent_sugar_crash": False,
            "hypertension_risk": False,
            "min_protein_grams_per_meal": 35
        },
        "behavioral_weights": {
            "speed_of_decision": 0.85,
            "culinary_adventurousness": 0.60,
            "preferred_cuisines": ["WARTEG_COMBO_PROTEIN", "AYAM_BAKAR_DOUBLE_TEMPE"]
        }
    }
}

# Alias for backward compatibility
PERSONA_PRESETS["CORP_DIAN_SCBD"] = PERSONA_PRESETS["CORP_LILY_SCBD"]
