import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    Boolean,
    ForeignKey,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import JsonColumn

class MealSlot(str, enum.Enum):
    LUNCH = "LUNCH"
    DINNER = "DINNER"
    SNACK = "SNACK"
    ANY = "ANY"

class NutritionSource(str, enum.Enum):
    TKPI = "TKPI"
    ESTIMATE = "ESTIMATE"

class MenuItem(Base):
    __tablename__ = "menu_item"

    id = Column(String(32), primary_key=True, index=True) # e.g. 'DISH-01'
    restaurant_id = Column(String(32), ForeignKey("restaurant.id", ondelete="CASCADE"), nullable=True, index=True)
    merchant_id = Column(String(32), ForeignKey("merchant.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True) # e.g. "Dada ayam bakar bumbu kuning kaldu segar..."
    meal_slot = Column(SAEnum(MealSlot, name="meal_slot_enum"), default=MealSlot.ANY, nullable=False)
    category = Column(String(30), default="protein", nullable=False) # 'hemat', 'protein', 'rendah-kalori', 'bebas-santan', 'lambung'
    base_price_idr = Column(Integer, nullable=False)
    discounted_price_idr = Column(Integer, nullable=False)
    has_promo = Column(Boolean, default=False, nullable=False)
    rating = Column(Numeric(3, 2), default=4.8, nullable=False) # e.g. 4.9
    sold_count = Column(String(20), default="1.2rb+", nullable=False) # e.g. "1.8rb+"
    kcal = Column(Integer, nullable=False)
    protein_g = Column(Numeric(5, 1), nullable=False)
    carbs_g = Column(Numeric(5, 1), nullable=False)
    fat_g = Column(Numeric(5, 1), nullable=False)
    sodium_mg = Column(Integer, nullable=False)
    image_url = Column(String(500), nullable=True)
    allergens = Column(JsonColumn(), default=list, nullable=False)
    hygiene_badges = Column(JsonColumn(), default=list, nullable=False) # e.g. ["Minyak Baru Terverifikasi", "Dapur Higienis"]
    default_notes = Column(String(255), nullable=True)
    nutrition_source = Column(SAEnum(NutritionSource, name="nutrition_source_enum"), default=NutritionSource.ESTIMATE, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    matched_personas = Column(JsonColumn(), default=list, nullable=False)

    restaurant = relationship("Restaurant", back_populates="menu_items")
    merchant = relationship("Merchant", back_populates="menu_items")
    tags = relationship("MenuItemTag", back_populates="item", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="item")
    recommendations = relationship("Recommendation", back_populates="item")
