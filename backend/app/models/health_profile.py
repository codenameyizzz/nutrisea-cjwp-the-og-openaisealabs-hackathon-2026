import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow, JsonColumn

class UserSex(str, enum.Enum):
    M = "M"
    F = "F"

class ActivityLevel(str, enum.Enum):
    SEDENTARY = "SEDENTARY"
    LIGHT = "LIGHT"
    MODERATE = "MODERATE"
    ACTIVE = "ACTIVE"

class HealthGoal(str, enum.Enum):
    LOSE_WEIGHT = "LOSE_WEIGHT"
    MAINTAIN = "MAINTAIN"
    GAIN_MUSCLE = "GAIN_MUSCLE"

class HealthProfile(Base):
    __tablename__ = "health_profile"

    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), primary_key=True)
    age = Column(Integer, nullable=False)
    sex = Column(SAEnum(UserSex, name="user_sex_enum"), nullable=False)
    height_cm = Column(Numeric(5, 1), nullable=False)
    weight_kg = Column(Numeric(5, 1), nullable=False)
    occupation = Column(String(100), nullable=True) # e.g. "Mahasiswa, desainer", "Corporate Desk Worker"
    activity_level = Column(SAEnum(ActivityLevel, name="activity_level_enum"), default=ActivityLevel.LIGHT, nullable=False)
    goal = Column(SAEnum(HealthGoal, name="health_goal_enum"), default=HealthGoal.MAINTAIN, nullable=False)
    allergies = Column(JsonColumn(), default=list, nullable=False) # e.g. ["kacang", "seafood"]
    meal_budget_idr = Column(Integer, default=35000, nullable=False)
    has_medical_condition = Column(Boolean, default=False, nullable=False)
    bmr_kcal = Column(Integer, nullable=False)
    tdee_kcal = Column(Integer, nullable=False)
    kcal_target = Column(Integer, nullable=False)
    kcal_floor = Column(Integer, nullable=False)
    target_protein_g = Column(Integer, default=75, nullable=False)
    target_carbs_g = Column(Integer, default=200, nullable=False)
    sodium_cap_mg = Column(Integer, default=2000, nullable=False)
    max_dinner_cut_pct = Column(Integer, default=25, nullable=False)
    learned_palate = Column(JsonColumn(), default=dict, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("AppUser", back_populates="health_profile")
