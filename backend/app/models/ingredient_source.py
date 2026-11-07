"""Immutable imported source records; never replace merchant/menu nutrition."""
from sqlalchemy import Column, String, ForeignKey, DateTime, CheckConstraint
from ..core.database import Base
from .base import JsonColumn, utcnow


class IngredientSourceFood(Base):
    __tablename__ = "ingredient_source_foods"
    __table_args__ = (CheckConstraint("link_status IN ('linked','needs_review')", name="ck_source_food_link_status"),)
    source_key = Column(String(100), primary_key=True)  # fatsecret:<food_id>
    ingredient_id = Column(String(36), ForeignKey("ingredients.id", ondelete="RESTRICT"), nullable=True, index=True)
    source_name = Column(String(300), nullable=False)
    source_url = Column(String(1000), nullable=True)
    link_status = Column(String(20), nullable=False)
    review_reason = Column(String(300), nullable=True)
    raw_food = Column(JsonColumn(), nullable=False)
    content_sha256 = Column(String(64), nullable=False)
    batch_sha256 = Column(String(64), nullable=False)
    imported_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class IngredientSourceServing(Base):
    __tablename__ = "ingredient_source_servings"
    source_key = Column(String(100), primary_key=True)  # fatsecret:<serving_id>
    food_source_key = Column(String(100), ForeignKey("ingredient_source_foods.source_key", ondelete="RESTRICT"), nullable=False, index=True)
    # Preserve source values, NULLs, portion basis, source URL and extra fields.
    raw_serving = Column(JsonColumn(), nullable=False)
    nutrients = Column(JsonColumn(), nullable=False)
    content_sha256 = Column(String(64), nullable=False)
    batch_sha256 = Column(String(64), nullable=False)
    imported_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
