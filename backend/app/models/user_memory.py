import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow

class UserMemoryItem(Base):
    """
    Long-Term Memory (LTM) Entity inspired by Odysseus.
    Stores durable facts, learned taste preferences, restrictions, and habits inferred over time.
    """
    __tablename__ = "user_memory_item"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False) # 'preference', 'restriction', 'habit', 'goal', 'fact'
    fact_text = Column(String(255), nullable=False)
    confidence = Column(Numeric(3, 2), default=0.90, nullable=False) # 0.00 to 1.00
    source = Column(String(50), default="onboarding_persona", nullable=False) # 'implicit_swap', 'onboarding_persona', 'chat_interaction', 'order_history'
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("AppUser", back_populates="memories")
