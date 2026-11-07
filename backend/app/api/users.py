from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.ingredient_auth import current_principal, IngredientPrincipal
from ..db import crud
from ..db.models import AppUser, HealthProfile, MealLog, RewardLedger, UserRole

router = APIRouter(prefix="/api/users", tags=["Users & Clinical Profiles (PostgreSQL)"])

# ---------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------
class UserSyncPayload(BaseModel):
    user_id: str = Field(..., description="Clerk User ID or Demo Persona ID")
    name: str
    email: Optional[str] = None
    role: Optional[str] = Field(None, description="Legacy input, ignored; role is resolved from server-managed account access")
    consent_health_data: bool = True

class UpdateRolePayload(BaseModel):
    role: str = Field(..., description="'CONSUMER' | 'MERCHANT' | 'SHOPEE_ADMIN'")

class HealthProfilePayload(BaseModel):
    age: int = Field(26, ge=18, le=100)
    sex: str = Field("F", description="'F' / 'M' / 'perempuan' / 'laki-laki'")
    height_cm: float = Field(160.0, ge=120.0, le=230.0)
    weight_kg: float = Field(52.0, ge=30.0, le=250.0)
    activity_level: str = Field("LIGHT", description="'SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE'")
    goal: str = Field("MAINTAIN", description="'LOSE_WEIGHT', 'MAINTAIN', 'GAIN_MUSCLE'")
    allergies: List[str] = Field(default_factory=list)
    meal_budget_idr: int = Field(35000, ge=5000)
    has_medical_condition: bool = False
    max_dinner_cut_pct: Optional[int] = 25

class MealLogPayload(BaseModel):
    source: str = Field("MANUAL", description="'ORDER', 'PHOTO', 'MANUAL'")
    meal_type: str = Field("LUNCH", description="'BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'")
    label: str
    kcal: int
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    sodium_mg: int = 0
    order_id: Optional[int] = None
    food_category: Optional[str] = None
    cooking_style: Optional[str] = None
    portion_factor: float = 1.0
    confidence: Optional[float] = None

class OrderCreatePayload(BaseModel):
    merchant_id: str
    total_idr: int
    items: List[Dict[str, Any]] # [{"item_id": "DISH-01", "qty": 1, "price_idr": 25600}]
    kitchen_notes: Optional[str] = None
    recommendation_id: Optional[str] = None
    is_healthy_pick: bool = True


def normalize_role(role_str: Optional[str]) -> Optional[UserRole]:
    if not role_str:
        return None
    cleaned = role_str.upper().strip()
    if cleaned in ("MERCHANT", "MERCHANT_ADMIN", "RESTO"):
        return UserRole.MERCHANT_ADMIN
    if cleaned in ("SHOPEE_ADMIN", "ADMIN", "SUPERADMIN"):
        return UserRole.SHOPEE_ADMIN
    if cleaned in ("CONSUMER", "USER", "CUSTOMER"):
        return UserRole.CONSUMER
    if hasattr(UserRole, cleaned):
        return getattr(UserRole, cleaned)
    return None


# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@router.post("/sync")
def sync_user(payload: UserSyncPayload, db: Session = Depends(get_db), principal: IngredientPrincipal = Depends(current_principal)):
    """
    Syncs or registers a user from Clerk Auth into PostgreSQL.
    """
    if payload.user_id != principal.user_id:
        raise HTTPException(403, "Tidak dapat menyinkronkan akun pengguna lain")
    role_enum = UserRole(principal.role)

    user = crud.upsert_user(
        db=db,
        user_id=payload.user_id,
        name=payload.name,
        email=payload.email,
        role=role_enum,
        consent_health_data=payload.consent_health_data
    )
    return {
        "status": "synchronized",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "consent_health_data": user.consent_health_data,
            "created_at": user.created_at.isoformat()
        }
    }


@router.post("/{user_id}/role")
def update_role(user_id: str, payload: UpdateRolePayload, db: Session = Depends(get_db), principal: IngredientPrincipal = Depends(current_principal)):
    """
    Legacy mirror endpoint: only accepts the caller's already assigned role.
    """
    role_enum = normalize_role(payload.role)
    if not role_enum:
        raise HTTPException(status_code=400, detail=f"Invalid role '{payload.role}'. Must be CONSUMER, MERCHANT, or SHOPEE_ADMIN.")

    if user_id != principal.user_id or role_enum.value != principal.role:
        raise HTTPException(403, "Peran akun hanya dapat ditetapkan oleh pengelola")

    user = crud.update_user_role(db, user_id, role_enum)
    return {
        "status": "updated",
        "user_id": user.id,
        "role": user.role.value
    }


@router.get("/{user_id}")
def get_user_dashboard(user_id: str, db: Session = Depends(get_db)):
    """
    Fetches full user data, clinical profile, today's meal logs, and SeaBank balance.
    """
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = crud.get_health_profile(db, user_id)
    meal_logs = crud.get_user_meal_logs_today(db, user_id)
    rewards_total = crud.get_total_rewards(db, user_id)

    profile_dict = None
    if profile:
        profile_dict = {
            "age": profile.age,
            "sex": profile.sex.value,
            "height_cm": float(profile.height_cm),
            "weight_kg": float(profile.weight_kg),
            "activity_level": profile.activity_level.value,
            "goal": profile.goal.value,
            "allergies": profile.allergies,
            "meal_budget_idr": profile.meal_budget_idr,
            "has_medical_condition": profile.has_medical_condition,
            "bmr_kcal": profile.bmr_kcal,
            "tdee_kcal": profile.tdee_kcal,
            "kcal_target": profile.kcal_target,
            "kcal_floor": profile.kcal_floor,
            "max_dinner_cut_pct": profile.max_dinner_cut_pct
        }

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value
        },
        "health_profile": profile_dict,
        "seabank_wellness_balance_idr": rewards_total,
        "today_meal_logs_count": len(meal_logs),
        "today_meal_logs": [
            {
                "id": m.id,
                "label": m.label,
                "meal_type": m.meal_type.value,
                "source": m.source.value,
                "kcal": m.kcal,
                "protein_g": float(m.protein_g),
                "logged_at": m.logged_at.isoformat()
            }
            for m in meal_logs
        ]
    }


@router.get("/{user_id}/health-profile")
def get_profile(user_id: str, db: Session = Depends(get_db)):
    profile = crud.get_health_profile(db, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Health profile not found for user")
    return {
        "user_id": profile.user_id,
        "age": profile.age,
        "sex": profile.sex.value,
        "height_cm": float(profile.height_cm),
        "weight_kg": float(profile.weight_kg),
        "activity_level": profile.activity_level.value,
        "goal": profile.goal.value,
        "allergies": profile.allergies,
        "meal_budget_idr": profile.meal_budget_idr,
        "has_medical_condition": profile.has_medical_condition,
        "bmr_kcal": profile.bmr_kcal,
        "tdee_kcal": profile.tdee_kcal,
        "kcal_target": profile.kcal_target,
        "kcal_floor": profile.kcal_floor,
        "max_dinner_cut_pct": profile.max_dinner_cut_pct
    }


@router.post("/{user_id}/health-profile")
def save_profile(user_id: str, payload: HealthProfilePayload, db: Session = Depends(get_db)):
    """
    Saves or updates clinical health profile and computes Mifflin-St Jeor metabolic guardrails.
    """
    # Ensure user exists first
    user = crud.get_user(db, user_id)
    if not user:
        crud.upsert_user(db, user_id=user_id, name="NutriSea User", consent_health_data=True)

    profile = crud.upsert_health_profile(db, user_id, payload.model_dump())
    return {
        "status": "saved",
        "profile": {
            "user_id": profile.user_id,
            "age": profile.age,
            "sex": profile.sex.value,
            "height_cm": float(profile.height_cm),
            "weight_kg": float(profile.weight_kg),
            "bmr_kcal": profile.bmr_kcal,
            "tdee_kcal": profile.tdee_kcal,
            "kcal_target": profile.kcal_target,
            "kcal_floor": profile.kcal_floor,
            "meal_budget_idr": profile.meal_budget_idr
        }
    }


@router.get("/{user_id}/meal-logs")
def get_meal_logs(user_id: str, db: Session = Depends(get_db)):
    logs = crud.get_user_meal_logs_today(db, user_id)
    total_kcal = sum(m.kcal for m in logs)
    total_prot = sum(float(m.protein_g) for m in logs)
    return {
        "user_id": user_id,
        "date": "today",
        "consumed_calories": total_kcal,
        "consumed_protein_g": round(total_prot, 1),
        "entries": [
            {
                "id": m.id,
                "label": m.label,
                "meal_type": m.meal_type.value,
                "source": m.source.value,
                "kcal": m.kcal,
                "protein_g": float(m.protein_g),
                "carbs_g": float(m.carbs_g),
                "fat_g": float(m.fat_g),
                "sodium_mg": m.sodium_mg,
                "logged_at": m.logged_at.isoformat()
            }
            for m in logs
        ]
    }


@router.post("/{user_id}/meal-logs")
def add_meal_log(user_id: str, payload: MealLogPayload, db: Session = Depends(get_db)):
    entry = crud.log_meal(
        db=db,
        user_id=user_id,
        source=payload.source,
        meal_type=payload.meal_type,
        label=payload.label,
        kcal=payload.kcal,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        sodium_mg=payload.sodium_mg,
        order_id=payload.order_id,
        food_category=payload.food_category,
        cooking_style=payload.cooking_style,
        portion_factor=payload.portion_factor,
        confidence=payload.confidence
    )
    return {"status": "logged", "id": entry.id, "label": entry.label, "kcal": entry.kcal}


@router.get("/{user_id}/rewards")
def get_user_rewards(user_id: str, db: Session = Depends(get_db)):
    balance = crud.get_total_rewards(db, user_id)
    history = db.query(RewardLedger).filter(RewardLedger.user_id == user_id).order_by(RewardLedger.created_at.desc()).all()
    return {
        "user_id": user_id,
        "total_reward_idr": balance,
        "currency": "IDR",
        "history": [
            {
                "id": r.id,
                "order_id": r.order_id,
                "amount_idr": r.amount_idr,
                "reason": r.reason,
                "created_at": r.created_at.isoformat()
            }
            for r in history
        ]
    }


@router.post("/{user_id}/orders")
def place_order(user_id: str, payload: OrderCreatePayload, db: Session = Depends(get_db)):
    """
    Persists order in PostgreSQL. If healthy pick, automatically credits SeaBank Wellness reward!
    """
    order = crud.create_order(
        db=db,
        user_id=user_id,
        merchant_id=payload.merchant_id,
        total_idr=payload.total_idr,
        items=payload.items,
        kitchen_notes=payload.kitchen_notes,
        recommendation_id=payload.recommendation_id,
        is_healthy_pick=payload.is_healthy_pick
    )

    reward_credited = None
    if payload.is_healthy_pick:
        reward = crud.award_seabank_reward(db=db, user_id=user_id, order_id=order.id, amount_idr=10000)
        reward_credited = reward.amount_idr

    return {
        "status": "CONFIRMED",
        "order_id": order.id,
        "total_idr": order.total_idr,
        "is_healthy_pick": order.is_healthy_pick,
        "seabank_wellness_reward_credited_idr": reward_credited,
        "kitchen_notes": order.kitchen_notes
    }


@router.get("/{user_id}/memories")
def get_user_memories_endpoint(user_id: str, db: Session = Depends(get_db)):
    """
    Returns stored Long-Term Memory (LTM) facts for a user.
    """
    memories = crud.get_user_memories(db=db, user_id=user_id)
    return {
        "status": "success",
        "user_id": user_id,
        "count": len(memories),
        "memories": [
            {
                "id": m.id,
                "category": m.category,
                "fact_text": m.fact_text,
                "confidence": float(m.confidence),
                "source": m.source,
                "created_at": m.created_at.isoformat()
            }
            for m in memories
        ]
    }

class UserMemoryPayload(BaseModel):
    category: str = Field(..., description="'preference', 'restriction', 'habit', 'goal', 'fact'")
    fact_text: str
    confidence: float = 0.90
    source: str = "manual_entry"

@router.post("/{user_id}/memories")
def add_user_memory_endpoint(user_id: str, payload: UserMemoryPayload, db: Session = Depends(get_db)):
    """
    Explicitly adds a Long-Term Memory item for a user.
    """
    mem = crud.save_user_memory(
        db=db,
        user_id=user_id,
        category=payload.category,
        fact_text=payload.fact_text,
        confidence=payload.confidence,
        source=payload.source
    )
    return {
        "status": "saved",
        "memory": {
            "id": mem.id,
            "category": mem.category,
            "fact_text": mem.fact_text,
            "confidence": float(mem.confidence),
            "source": mem.source
        }
    }
