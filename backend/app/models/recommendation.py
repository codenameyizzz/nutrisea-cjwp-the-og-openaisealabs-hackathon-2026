import enum
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow, JsonColumn

class RecommendationMealType(str, enum.Enum):
    LUNCH = "LUNCH"
    DINNER = "DINNER"

class RecommendationSource(str, enum.Enum):
    LIVE = "LIVE"
    CACHED = "CACHED"

class RecommendationStatus(str, enum.Enum):
    SHOWN = "SHOWN"
    ACCEPTED = "ACCEPTED"
    SWAPPED = "SWAPPED"
    EXPIRED = "EXPIRED"

class Recommendation(Base):
    __tablename__ = "recommendation"

    id = Column(String(40), primary_key=True, index=True)
    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_type = Column(SAEnum(RecommendationMealType, name="reco_meal_type_enum"), nullable=False)
    item_id = Column(String(32), ForeignKey("menu_item.id"), nullable=False)
    chips = Column(JsonColumn(), default=list, nullable=False)
    payload = Column(JsonColumn(), default=dict, nullable=False)
    source = Column(SAEnum(RecommendationSource, name="reco_source_enum"), default=RecommendationSource.LIVE, nullable=False)
    is_recalibration = Column(Boolean, default=False, nullable=False)
    status = Column(SAEnum(RecommendationStatus, name="reco_status_enum"), default=RecommendationStatus.SHOWN, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("AppUser", back_populates="recommendations")
    item = relationship("MenuItem", back_populates="recommendations")
    orders = relationship("Order", back_populates="recommendation")
