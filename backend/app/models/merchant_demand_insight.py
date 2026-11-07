from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow, JsonColumn

class MerchantDemandInsight(Base):
    __tablename__ = "merchant_demand_insight"

    id = Column(Integer, primary_key=True, autoincrement=True)
    merchant_id = Column(String(32), ForeignKey("merchant.id", ondelete="CASCADE"), nullable=False, index=True)
    district = Column(String(80), nullable=False) # e.g. "Kuningan / SCBD"
    radius_km = Column(Numeric(3, 1), default=2.0, nullable=False)
    unmet_demand_count = Column(Integer, default=65, nullable=False) # "65 Konsumen Sedang Mencari Menu Ini"
    opportunity_detected = Column(String(100), default="HIGH_PROTEIN_LOW_SUGAR_GRILLED_CHICKEN", nullable=False)
    actionable_suggestion = Column(Text, nullable=False)
    suggested_healthy_tags = Column(JsonColumn(), default=list, nullable=False) # e.g. ["MINYAK_BARU", "TANPA_SANTAN", "TINGGI_PROTEIN"]
    estimated_order_boost_pct = Column(Integer, default=20, nullable=False) # "+20% Estimasi Peningkatan Order"
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    merchant = relationship("Merchant", back_populates="demand_insights")
