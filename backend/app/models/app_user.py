import enum
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow, JsonColumn

class UserRole(str, enum.Enum):
    CONSUMER = "CONSUMER"
    MERCHANT_ADMIN = "MERCHANT_ADMIN"
    SHOPEE_ADMIN = "SHOPEE_ADMIN"

class AppUser(Base):
    __tablename__ = "app_user"

    id = Column(String(64), primary_key=True, index=True) # Clerk User ID or demo ID
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=True, index=True)
    role = Column(SAEnum(UserRole, name="user_role_enum"), default=UserRole.CONSUMER, nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    consent_health_data = Column(Boolean, default=False, nullable=False)
    streak_days = Column(Integer, default=5, nullable=False) # SeaBank habit streak tracker (5 days in demo)
    
    # Main Persona & 3 Side Personas
    main_persona_id = Column(String(64), nullable=True) # e.g. 'BUDG_LILY_MENTENG_001'
    side_persona_ids = Column(JsonColumn(), default=list, nullable=False) # e.g. ['CORP_YOGA_MENTENG_004', ...]
    
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    health_profile = relationship("HealthProfile", uselist=False, back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user")
    meal_logs = relationship("MealLog", back_populates="user", cascade="all, delete-orphan")
    rewards = relationship("RewardLedger", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("UserMemoryItem", back_populates="user", cascade="all, delete-orphan")
    action_logs = relationship("UserActionLog", back_populates="user", cascade="all, delete-orphan", order_by="desc(UserActionLog.created_at)")
