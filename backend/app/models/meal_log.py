import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Numeric,
    DateTime,
    ForeignKey,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow, JsonColumn

class MealSource(str, enum.Enum):
    ORDER = "ORDER"
    PHOTO = "PHOTO"
    MANUAL = "MANUAL"

class MealTypeEnum(str, enum.Enum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    SNACK = "SNACK"
    DINNER = "DINNER"

class MealLog(Base):
    __tablename__ = "meal_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(SAEnum(MealSource, name="meal_source_enum"), nullable=False)
    meal_type = Column(SAEnum(MealTypeEnum, name="meal_type_enum"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    label = Column(String(200), nullable=False) # e.g. "2x Bakwan Sayur Goreng"
    food_category = Column(String(60), nullable=True)
    cooking_style = Column(String(60), nullable=True) # e.g. "GORENGAN / MINYAK TINGGI"
    nutri_grade = Column(String(5), default="C", nullable=True) # e.g. 'A', 'B', 'C', 'D' NutriScore
    density_flags = Column(JsonColumn(), default=list, nullable=False) # e.g. ["TINGGI LEMAK JENUH", "GULA SEDERHANA"]
    rebalance_note = Column(Text, nullable=True) # e.g. "Camilan sore terdeteksi (+320 kcal). AI otomatis menyeimbangkan..."
    image_url = Column(String(500), nullable=True)
    portion_factor = Column(Numeric(3, 2), default=1.00, nullable=False)
    confidence = Column(Numeric(3, 2), nullable=True)
    kcal = Column(Integer, nullable=False)
    protein_g = Column(Numeric(5, 1), default=0.0, nullable=False)
    carbs_g = Column(Numeric(5, 1), default=0.0, nullable=False)
    fat_g = Column(Numeric(5, 1), default=0.0, nullable=False)
    sodium_mg = Column(Integer, default=0, nullable=False)
    logged_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("AppUser", back_populates="meal_logs")
    order = relationship("Order", back_populates="meal_log")
