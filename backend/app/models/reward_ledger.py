from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow

class RewardLedger(Base):
    __tablename__ = "reward_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    amount_idr = Column(Integer, nullable=False) # e.g. Rp 10.000 cashback
    reason = Column(String(60), default="HEALTHY_ORDER_DELIVERED", nullable=False)
    interest_bonus_pct = Column(Numeric(3, 2), default=0.50, nullable=False) # +0.5% p.a. bonus gizi
    streak_bonus_unlocked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("AppUser", back_populates="rewards")
    order = relationship("Order", back_populates="reward")
