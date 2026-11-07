from sqlalchemy import Column, String, Numeric, Integer, Text, DateTime
from ..core.database import Base
from .base import utcnow

class Persona(Base):
    """
    Persona Master Entity (120 Urban Worker Personas).
    Stores empirical biometrics, clinical guardrails, economic targets, and pain points.
    """
    __tablename__ = "persona"

    id = Column(String(64), primary_key=True, index=True) # e.g. 'BUDG_LILY_MENTENG_001'
    full_name = Column(String(100), nullable=False)
    archetype_code = Column(String(50), nullable=False, index=True) # e.g. 'BUDGET_FITNESS'
    archetype_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    occupation = Column(String(100), nullable=False)
    work_district = Column(String(50), nullable=False, index=True) # e.g. 'Menteng', 'SCBD'
    monthly_income_idr = Column(Integer, nullable=False)
    activity_level = Column(String(30), nullable=False)
    height_cm = Column(Numeric(5, 1), nullable=False)
    weight_kg = Column(Numeric(5, 1), nullable=False)
    bmi_value = Column(Numeric(4, 1), nullable=False)
    bmi_category = Column(String(30), nullable=False)
    bmr_kcal = Column(Integer, nullable=False)
    tdee_kcal = Column(Integer, nullable=False)
    daily_caloric_target_kcal = Column(Integer, nullable=False)
    target_lunch_kcal = Column(Integer, nullable=False)
    target_lunch_budget_idr = Column(Integer, nullable=False)
    health_goal = Column(String(50), nullable=False)
    medical_conditions = Column(String(100), default="NONE", nullable=False)
    allergens = Column(String(100), default="NONE", nullable=False)
    preferred_tags = Column(String(255), default="", nullable=False)
    preferred_cuisines = Column(String(255), default="", nullable=False)
    order_time_lunch = Column(String(20), default="12:00", nullable=False)
    weekly_order_frequency = Column(Integer, default=5, nullable=False)
    avg_scroll_duration_minutes = Column(Integer, default=20, nullable=False)
    target_decision_seconds = Column(Integer, default=90, nullable=False)
    primary_functional_job = Column(Text, nullable=True)
    primary_emotional_job = Column(Text, nullable=True)
    biggest_pain_point = Column(Text, nullable=True)
    seabank_wellness_affinity = Column(String(30), default="MEDIUM", nullable=False)
    streak_loyalty_potential_days = Column(Integer, default=21, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
