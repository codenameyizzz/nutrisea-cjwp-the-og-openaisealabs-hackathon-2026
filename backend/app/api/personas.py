from typing import Optional, List, Dict, Any, Literal, Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_
import uuid

from ..core.database import get_db
from ..core.ingredient_auth import current_principal
from ..models import Persona, AppUser, UserMemoryItem, HealthProfile, UserRole
from .users import HealthProfilePayload
from ..db import crud
from ..services.onboarding_details import save_onboarding_details, FIELDS as ONBOARDING_FIELDS

router = APIRouter(prefix="/api/personas", tags=["Personas & Dual-Tier Memory"])

# ---------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------
class UserPersonasPayload(BaseModel):
    main_persona_id: str = Field(..., description="ID of the Main Persona (Persona Utama)")
    side_persona_ids: List[str] = Field(default_factory=list, description="IDs of 3 Side Personas (Persona Pendamping)")
    name: Optional[str] = Field(None, description="Full name from Clerk auth")
    email: Optional[str] = Field(None, description="Email address from Clerk auth")
    role: Optional[str] = Field(None, description="Legacy input, ignored; permissions come from the Clerk session")
    profile: Optional[HealthProfilePayload] = None
    dietary_needs: Optional[List[Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[^\x00-\x1f]+$")]]] = Field(None, max_length=12)
    dietary_guidance: Optional[Literal["professional", "personal", "undisclosed"]] = None
    allergy_status: Optional[Literal["reported", "none", "undisclosed"]] = None

class OnboardingAnswersPayload(BaseModel):
    q1_goal: Optional[str] = Field(None, description="Q1: Main goal when choosing food")
    q2_concern: Optional[str] = Field(None, description="Q2: Current food-related concern")
    q3_dietary_needs: Optional[str] = Field(None, description="Q3: Dietary needs or restrictions")
    q3_follow_up: Optional[str] = Field(None, description="Q3 Follow-up: Healthcare guidance vs personal preference")
    q4_lunch_priority: Optional[str] = Field(None, description="Q4: What matters most when choosing lunch")
    q5_budget: Optional[str] = Field(None, description="Q5: Usual budget for one lunch")
    q6_activity: Optional[str] = Field(None, description="Q6: How active is your usual day")
    q7_age_range: Optional[str] = Field(None, description="Q7: Age range")
    q8_difficulty: Optional[str] = Field(None, description="Q8: What makes choosing lunch difficult")
    work_district: Optional[str] = Field(None, description="Optional preferred district")

class PersonaResponse(BaseModel):
    id: str
    full_name: str
    archetype_code: str
    archetype_name: str
    age: int
    gender: str
    occupation: str
    work_district: str
    monthly_income_idr: int
    activity_level: str
    height_cm: float
    weight_kg: float
    bmi_value: float
    bmi_category: str
    bmr_kcal: int
    tdee_kcal: int
    daily_caloric_target_kcal: int
    target_lunch_kcal: int
    target_lunch_budget_idr: int
    health_goal: str
    medical_conditions: str
    allergens: str
    preferred_tags: str
    preferred_cuisines: str
    order_time_lunch: str
    weekly_order_frequency: int
    avg_scroll_duration_minutes: int
    target_decision_seconds: int
    primary_functional_job: Optional[str] = None
    primary_emotional_job: Optional[str] = None
    biggest_pain_point: Optional[str] = None
    seabank_wellness_affinity: str
    streak_loyalty_potential_days: int

# ---------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------
@router.get("", response_model=List[PersonaResponse])
def get_all_personas(
    search: Optional[str] = Query(None, description="Search by name, occupation, or district"),
    district: Optional[str] = Query(None, description="Filter by district (e.g. SCBD, Menteng, Kuningan)"),
    archetype: Optional[str] = Query(None, description="Filter by archetype code (e.g. BUDGET_FITNESS, CORP_OVERLOADED)"),
    limit: int = Query(120, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Returns actual persona records from PostgreSQL 'persona' table.
    Supports filtering and search.
    """
    query = db.query(Persona)
    
    if district:
        query = query.filter(Persona.work_district.ilike(f"%{district.strip()}%"))
        
    if archetype:
        query = query.filter(Persona.archetype_code == archetype.strip())
        
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Persona.full_name.ilike(s),
                Persona.occupation.ilike(s),
                Persona.work_district.ilike(s),
                Persona.archetype_name.ilike(s),
                Persona.id.ilike(s)
            )
        )
        
    personas = query.order_by(Persona.archetype_code, Persona.id).limit(limit).all()
    return personas


@router.get("/archetypes")
def get_archetypes(db: Session = Depends(get_db)):
    """
    Returns archetype groups and counts.
    """
    personas = db.query(Persona).all()
    archetypes = {}
    for p in personas:
        if p.archetype_code not in archetypes:
            archetypes[p.archetype_code] = {
                "code": p.archetype_code,
                "name": p.archetype_name,
                "count": 0,
                "districts": set()
            }
        archetypes[p.archetype_code]["count"] += 1
        archetypes[p.archetype_code]["districts"].add(p.work_district)
        
    # convert sets to sorted lists
    for code in archetypes:
        archetypes[code]["districts"] = sorted(list(archetypes[code]["districts"]))
        
    return list(archetypes.values())


@router.get("/{persona_id}", response_model=PersonaResponse)
def get_persona_detail(persona_id: str, db: Session = Depends(get_db)):
    """
    Returns single persona detail by ID.
    """
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found")
    return persona


@router.post("/users/{user_id}/assign")
def assign_user_personas(
    user_id: str,
    payload: UserPersonasPayload,
    db: Session = Depends(get_db),
    principal=Depends(current_principal),
):
    """
    Sets user's Main Persona and 3 Side Personas, and initializes Odysseus Long-Term Memory (LTM).
    """
    if user_id != principal.user_id:
        raise HTTPException(403, "Tidak dapat mengubah persona pengguna lain")
    role_enum = UserRole(principal.role)

    # Validate the selected reference personas before changing any account data.
    main_p = db.get(Persona, payload.main_persona_id)
    if not main_p:
        raise HTTPException(400, "Persona utama tidak ditemukan")
    sides = payload.side_persona_ids
    if len(sides) > 3 or len(set(sides)) != len(sides) or payload.main_persona_id in sides:
        raise HTTPException(422, "Pilih maksimal tiga persona pendamping yang berbeda")
    if any(db.get(Persona, side_id) is None for side_id in sides):
        raise HTTPException(422, "Persona pendamping tidak ditemukan")
    hp = crud.get_health_profile(db, user_id)
    if payload.profile is None and hp is None:
        raise HTTPException(422, "Lengkapi data diri sebelum menyimpan persona")

    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        user = AppUser(
            id=user_id,
            name=payload.name or "Pengguna NutriSea",
            email=payload.email,
            role=role_enum,
            main_persona_id=payload.main_persona_id,
            side_persona_ids=payload.side_persona_ids,
            consent_health_data=True
        )
        db.add(user)
    else:
        if payload.name:
            user.name = payload.name
        if payload.email:
            user.email = payload.email
        user.role = role_enum  # Display mirror only; never an authorization source.
        user.main_persona_id = payload.main_persona_id
        user.side_persona_ids = payload.side_persona_ids

    # Account, entered biometrics, assignment and memories share one transaction.
    # Reference persona biometrics/medical conditions never become user facts.
    db.flush()
    if payload.profile is not None:
        profile_values = payload.profile.model_dump()
        if hp is not None:
            if payload.allergy_status == "undisclosed":
                profile_values["allergies"] = hp.allergies
            if "has_medical_condition" not in payload.profile.model_fields_set:
                profile_values["has_medical_condition"] = hp.has_medical_condition
        hp = crud.upsert_health_profile(db, user_id, profile_values, commit=False)
    save_onboarding_details(db, user_id, {
        field: getattr(payload, field) for field in ONBOARDING_FIELDS if field in payload.model_fields_set
    })

    # Initialize Odysseus Long-Term Memory (LTM) facts for this user
    # 1. Clear old auto-generated persona baseline facts
    db.query(UserMemoryItem).filter(
        UserMemoryItem.user_id == user_id,
        UserMemoryItem.source == "onboarding_persona"
    ).delete()

    # 2. Add durable LTM facts
    memories = [
        UserMemoryItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category="goal",
            fact_text=f"Target kalori harian: {hp.kcal_target} kcal dengan budget makan Rp {hp.meal_budget_idr:,}".replace(",", "."),
            confidence=0.95,
            source="onboarding_persona"
        ),
        UserMemoryItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category="preference",
            fact_text=f"Gaya olahan favorit: {main_p.preferred_tags or 'Minyak Baru, Sayur Bening'}. Arketipe: {main_p.archetype_name}",
            confidence=0.90,
            source="onboarding_persona"
        )
    ]

    if hp.has_medical_condition:
        memories.append(UserMemoryItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category="restriction",
            fact_text="Pengguna menyatakan memiliki kondisi medis; ikuti batasan yang dikonfirmasi pengguna.",
            confidence=0.98,
            source="onboarding_persona"
        ))

    if hp.allergies:
        memories.append(UserMemoryItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category="restriction",
            fact_text=f"Alergen yang dimasukkan pengguna: {', '.join(hp.allergies)}.",
            confidence=1.00,
            source="onboarding_persona"
        ))

    # Add Side Personas to LTM
    if payload.side_persona_ids:
        side_ps = db.query(Persona).filter(Persona.id.in_(payload.side_persona_ids)).all()
        side_names = [f"{sp.full_name} ({sp.archetype_name})" for sp in side_ps]
        memories.append(UserMemoryItem(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category="habit",
            fact_text=f"Persona pendamping adaptif: {', '.join(side_names)}.",
            confidence=0.85,
            source="onboarding_persona"
        ))

    for m in memories:
        db.add(m)

    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "user_id": user.id,
        "main_persona": {
            "id": main_p.id,
            "full_name": main_p.full_name,
            "archetype_name": main_p.archetype_name,
            "target_lunch_kcal": main_p.target_lunch_kcal,
            "target_lunch_budget_idr": main_p.target_lunch_budget_idr
        },
        "side_persona_ids": user.side_persona_ids,
        "ltm_memories_count": len(memories)
    }


@router.get("/users/{user_id}/personas")
def get_user_personas(user_id: str, db: Session = Depends(get_db), principal=Depends(current_principal)):
    """
    Fetches the user's active Main Persona, Side Personas, and Long-Term Memory (LTM).
    """
    if user_id != principal.user_id:
        raise HTTPException(403, "Tidak dapat membaca persona pengguna lain")
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    main_p = None
    if user.main_persona_id:
        main_p = db.query(Persona).filter(Persona.id == user.main_persona_id).first()

    side_ps = []
    if user.side_persona_ids:
        side_ps = db.query(Persona).filter(Persona.id.in_(user.side_persona_ids)).all()

    ltm_items = db.query(UserMemoryItem).filter(UserMemoryItem.user_id == user_id).order_by(UserMemoryItem.created_at.desc()).all()

    return {
        "user_id": user.id,
        "main_persona_id": user.main_persona_id,
        "main_persona": main_p,
        "side_persona_ids": user.side_persona_ids or [],
        "side_personas": side_ps,
        "ltm_memories": [
            {
                "id": m.id,
                "category": m.category,
                "fact_text": m.fact_text,
                "confidence": float(m.confidence),
                "source": m.source
            }
            for m in ltm_items
        ]
    }


@router.post("/match")
def match_onboarding_persona(payload: OnboardingAnswersPayload, db: Session = Depends(get_db)):
    """
    Evaluates the 8-question onboarding questionnaire grounded in persona_onboarding_questions.txt
    to dynamically diagnose the user's primary archetype and assign the best-matching
    Main Persona and 3 adaptive Side Personas from the 120 Indonesian urban personas dataset.
    """
    scores = {
        "CORP_OVERLOADED": 0.0,
        "PREVENTIVE_HEALTH": 0.0,
        "BUDGET_FITNESS": 0.0,
        "DIGESTIVE_GERD": 0.0
    }

    # Q1. Main goal (Primary classification, weight 3.5)
    q1 = (payload.q1_goal or "").lower()
    if "energy steady" in q1 or "balanced meal" in q1:
        scores["CORP_OVERLOADED"] += 3.5
    elif "future health" in q1 or "healthier" in q1:
        scores["PREVENTIVE_HEALTH"] += 3.5
    elif "muscle" in q1 or "fitness" in q1:
        scores["BUDGET_FITNESS"] += 3.5
    elif "gentle on my stomach" in q1:
        scores["DIGESTIVE_GERD"] += 3.5

    # Q2. Current concern (Primary classification, weight 3.5)
    q2 = (payload.q2_concern or "").lower()
    if "sleepy" in q2 or "sluggish" in q2 or "too full" in q2:
        scores["CORP_OVERLOADED"] += 3.5
    elif "salt, sugar" in q2 or "fat" in q2:
        scores["PREVENTIVE_HEALTH"] += 3.5
    elif "protein" in q2 or "spending too much" in q2:
        scores["BUDGET_FITNESS"] += 3.5
    elif "stomach discomfort" in q2 or "acidity" in q2 or "heartburn" in q2:
        scores["DIGESTIVE_GERD"] += 3.5

    # Q3. Dietary needs & restrictions (weight 2.5)
    q3 = (payload.q3_dietary_needs or "").lower()
    if any(k in q3 for k in ["salt", "sugar", "glucose", "cholesterol", "saturated fat"]):
        scores["PREVENTIVE_HEALTH"] += 2.5
    elif "gentle on my stomach" in q3:
        scores["DIGESTIVE_GERD"] += 2.5

    # Q4. Lunch priority (weight 2.0)
    q4 = (payload.q4_lunch_priority or "").lower()
    if "quick recommendation" in q4 or "don't have to browse" in q4:
        scores["CORP_OVERLOADED"] += 2.0
    elif "long-term health" in q4:
        scores["PREVENTIVE_HEALTH"] += 2.0
    elif "protein" in q4 or "affordable price" in q4:
        scores["BUDGET_FITNESS"] += 2.0
    elif "upset my stomach" in q4 or "avoid ingredients" in q4:
        scores["DIGESTIVE_GERD"] += 2.0

    # Q5. Budget
    q5 = (payload.q5_budget or "").lower()
    if "under" in q5 or "25,000" in q5:
        scores["BUDGET_FITNESS"] += 1.5
    elif "45,000" in q5 or "more than" in q5:
        scores["CORP_OVERLOADED"] += 1.0

    # Q6. Daily activity
    q6 = (payload.q6_activity or "").lower()
    if "moderate" in q6 or "regular exercise" in q6 or "very active" in q6:
        scores["BUDGET_FITNESS"] += 1.5
    elif "mostly sitting" in q6:
        scores["CORP_OVERLOADED"] += 1.0

    # Q8. Difficulty choosing lunch (weight 2.0)
    q8 = (payload.q8_difficulty or "").lower()
    if "too many options" in q8 or "too much time deciding" in q8:
        scores["CORP_OVERLOADED"] += 2.0
    elif "unsure whether" in q8 or "balanced" in q8:
        scores["PREVENTIVE_HEALTH"] += 2.0
    elif "costs more" in q8:
        scores["BUDGET_FITNESS"] += 2.0
    elif "stomach discomfort" in q8 or "worried a meal" in q8:
        scores["DIGESTIVE_GERD"] += 2.0

    # Sort archetypes
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    primary_code = ranked[0][0]
    secondary_code = ranked[1][0] if ranked[1][1] > 0 else (
        "PREVENTIVE_HEALTH" if primary_code != "PREVENTIVE_HEALTH" else "CORP_OVERLOADED"
    )

    max_possible = 14.5
    confidence_pct = min(99, max(75, int((ranked[0][1] / max_possible) * 100) if ranked[0][1] > 0 else 88))

    # Target budget estimation
    target_budget = 35000
    if "under" in q5:
        target_budget = 24000
    elif "25,000–rp35,000" in q5 or "25,000-rp35,000" in q5:
        target_budget = 30000
    elif "35,001–rp45,000" in q5:
        target_budget = 40000
    elif "more than" in q5 or "45,000" in q5:
        target_budget = 55000

    # Query all candidates in primary archetype
    query = db.query(Persona).filter(Persona.archetype_code == primary_code)
    if payload.work_district:
        dist_match = query.filter(Persona.work_district.ilike(f"%{payload.work_district.strip()}%")).all()
        primary_candidates = dist_match if dist_match else query.all()
    else:
        primary_candidates = query.all()

    if not primary_candidates:
        primary_candidates = db.query(Persona).all()

    # Score candidates within primary archetype by budget proximity & medical conditions
    def candidate_score(p: Persona) -> float:
        s = 100.0
        budget_diff = abs(p.target_lunch_budget_idr - target_budget)
        s -= min(30.0, (budget_diff / target_budget) * 30.0)
        conds = (p.medical_conditions or "").upper()
        if "salt" in q3 and any(k in conds for k in ["HYPERTENSION", "HIPERTENSI"]):
            s += 20.0
        if "stomach" in q3 and any(k in conds for k in ["GERD", "GASTRITIS", "MAAG"]):
            s += 25.0
        if "sugar" in q3 and any(k in conds for k in ["DIABETES", "PREDIABETES", "GLUKOSA"]):
            s += 20.0
        if "cholesterol" in q3 and any(k in conds for k in ["CHOLESTEROL", "DISLIPIDEMIA", "KOLESTEROL"]):
            s += 20.0
        return s

    primary_candidates.sort(key=candidate_score, reverse=True)
    main_persona = primary_candidates[0]

    # Select 3 Side Personas
    other_archetypes = [a for a in ["CORP_OVERLOADED", "PREVENTIVE_HEALTH", "BUDGET_FITNESS", "DIGESTIVE_GERD"] if a != primary_code]
    side_candidates = []
    
    # 1. Candidate from secondary archetype
    sec_cands = db.query(Persona).filter(Persona.archetype_code == secondary_code, Persona.id != main_persona.id).all()
    if sec_cands:
        sec_cands.sort(key=lambda p: abs(p.target_lunch_budget_idr - target_budget))
        side_candidates.append(sec_cands[0])

    # 2. Candidates from remaining
    for arc in other_archetypes:
        if len(side_candidates) >= 3:
            break
        if arc == secondary_code:
            continue
        cands = db.query(Persona).filter(Persona.archetype_code == arc, Persona.id != main_persona.id).all()
        if cands:
            cands.sort(key=lambda p: abs(p.target_lunch_budget_idr - target_budget))
            side_candidates.append(cands[0])

    if len(side_candidates) < 3:
        all_remaining = db.query(Persona).filter(
            Persona.id != main_persona.id,
            ~Persona.id.in_([s.id for s in side_candidates])
        ).limit(3 - len(side_candidates)).all()
        side_candidates.extend(all_remaining)

    archetype_labels = {
        "CORP_OVERLOADED": "The Overloaded Corporate Professional",
        "PREVENTIVE_HEALTH": "The Preventive Health Starter",
        "BUDGET_FITNESS": "The Budget-Conscious Fitness Enthusiast",
        "DIGESTIVE_GERD": "The Digestive & Gentle Palate Fighter"
    }

    archetype_reasons = {
        "CORP_OVERLOADED": "Fokus pada efisiensi keputusan makan siang cepat, energi kerja stabil tanpa kantuk/sluggishness, dan pencegahan food coma di jam kantor.",
        "PREVENTIVE_HEALTH": "Fokus pada pencegahan risiko kesehatan jangka panjang dengan mengontrol asupan natrium/garam, gula, dan lemak jenuh.",
        "BUDGET_FITNESS": "Fokus pada pemenuhan target protein tinggi dan kebugaran aktif dengan batas budget makan siang yang terjangkau.",
        "DIGESTIVE_GERD": "Fokus pada hidangan ramah lambung, bebas asam/pedas ekstrem (capsaicin), dan metode masak yang lembut untuk mencegah asam lambung naik."
    }

    return {
        "primary_archetype": {
            "code": primary_code,
            "name": archetype_labels.get(primary_code, primary_code),
            "score": round(ranked[0][1], 1),
            "confidence_percent": confidence_pct
        },
        "secondary_archetype": {
            "code": secondary_code,
            "name": archetype_labels.get(secondary_code, secondary_code),
            "score": round(ranked[1][1], 1)
        },
        "main_persona": main_persona,
        "side_personas": side_candidates[:3],
        "rationale": archetype_reasons.get(primary_code, "Profil persona ini paling selaras dengan prioritas dan rutinitas harian Anda."),
        "dietary_safeguards": {
            "selected_restriction": payload.q3_dietary_needs or "None",
            "is_medical_guidance": "healthcare" in (payload.q3_follow_up or "").lower()
        }
    }
