"""Ingredient catalog. Tables are provisioned only by an approved migration."""
import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint, text
from sqlalchemy.orm import relationship

from ..core.database import Base
from .base import utcnow

UNITS = ("gram", "kg", "ml", "liter", "pcs", "tsp", "tbsp")


class Ingredient(Base):
    __tablename__ = "ingredients"
    __table_args__ = (
        UniqueConstraint("normalized_name", name="uq_ingredients_normalized_name"),
        CheckConstraint("length(trim(name)) > 0 AND length(trim(normalized_name)) > 0", name="ck_ingredients_name"),
        CheckConstraint("default_unit IN ('gram','kg','ml','liter','pcs','tsp','tbsp')", name="ck_ingredients_unit"),
        Index("ix_ingredients_name_prefix", "normalized_name", postgresql_ops={"normalized_name": "varchar_pattern_ops"}),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(150), nullable=False)
    normalized_name = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False, default="Lainnya", server_default="Lainnya")
    default_unit = Column(String(10), nullable=False, default="gram", server_default="gram")
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow, server_default=text("CURRENT_TIMESTAMP"))
    aliases = relationship("IngredientAlias", cascade="all, delete-orphan", back_populates="ingredient", order_by="IngredientAlias.normalized_alias")


class IngredientAlias(Base):
    __tablename__ = "ingredient_aliases"
    __table_args__ = (
        UniqueConstraint("ingredient_id", "normalized_alias", name="uq_ingredient_alias"),
        CheckConstraint("length(trim(alias)) > 0 AND length(trim(normalized_alias)) > 0", name="ck_ingredient_alias_name"),
        Index("ix_ingredient_alias_prefix", "normalized_alias", postgresql_ops={"normalized_alias": "varchar_pattern_ops"}),
    )
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ingredient_id = Column(String(36), ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False, index=True)
    alias = Column(String(150), nullable=False)
    normalized_alias = Column(String(150), nullable=False)
    ingredient = relationship("Ingredient", back_populates="aliases")


class MenuIngredient(Base):
    __tablename__ = "menu_ingredients"
    __table_args__ = (
        CheckConstraint("quantity > 0 AND quantity <= 999999.999", name="ck_menu_ingredients_quantity"),
        CheckConstraint("unit IN ('gram','kg','ml','liter','pcs','tsp','tbsp')", name="ck_menu_ingredients_unit"),
        Index("ix_menu_ingredients_ingredient", "ingredient_id", "menu_item_id"),
    )
    menu_item_id = Column(String(32), ForeignKey("menu_item.id", ondelete="CASCADE"), primary_key=True)
    ingredient_id = Column(String(36), ForeignKey("ingredients.id", ondelete="RESTRICT"), primary_key=True)
    quantity = Column(Numeric(12, 3), nullable=False)
    unit = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("CURRENT_TIMESTAMP"))
    ingredient = relationship("Ingredient", lazy="joined")
