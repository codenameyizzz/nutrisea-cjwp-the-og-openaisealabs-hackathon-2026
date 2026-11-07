from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow

class ChatMessage(Base):
    __tablename__ = "chat_message"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("app_user.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False) # 'user' | 'assistant' | 'system'
    content = Column(Text, nullable=False)
    dish_context = Column(String(255), nullable=True) # Context of dish being viewed
    model_used = Column(String(50), default="gemini-3.1-flash-lite", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("AppUser", back_populates="chat_messages")
