import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow, JsonColumn

class UserActionLog(Base):
    """
    Short-Term Memory (STM) Entity.
    Logs immediate user interactions: clicking dishes, searching, filtering, adding to cart.
    Stores action metadata and dish personas as JSON for immediate LLM context injection.
    """
    __tablename__ = "user_action_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False, index=True) # 'CLICK_MENU_ITEM', 'SEARCH_QUERY', 'ADD_TO_CART', 'VIEW_DETAILS'
    payload = Column(JsonColumn(), default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    user = relationship("AppUser", back_populates="action_logs")
