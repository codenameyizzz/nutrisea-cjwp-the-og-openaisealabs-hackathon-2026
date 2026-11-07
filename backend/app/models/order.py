import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum
)
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow

class OrderStatus(str, enum.Enum):
    CART_INJECTED = "CART_INJECTED"
    CONFIRMED = "CONFIRMED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("app_user.id"), nullable=False, index=True)
    restaurant_id = Column(String(32), ForeignKey("restaurant.id"), nullable=True)
    merchant_id = Column(String(32), ForeignKey("merchant.id"), nullable=False)
    recommendation_id = Column(String(40), ForeignKey("recommendation.id"), nullable=True)
    status = Column(SAEnum(OrderStatus, name="order_status_enum"), default=OrderStatus.CART_INJECTED, nullable=False)
    is_healthy_pick = Column(Boolean, default=True, nullable=False)
    total_idr = Column(Integer, nullable=False)
    delivery_fee_idr = Column(Integer, default=10000, nullable=False) # Ongkos Kirim ShopeeFood
    delivery_discount_idr = Column(Integer, default=10000, nullable=False) # Gratis Ongkir NutriSea
    voucher_code = Column(String(50), nullable=True) # e.g. "SEABANKSEHAT", "NUTRISEA35"
    discount_idr = Column(Integer, default=10000, nullable=False) # SeaBank Direct discount
    payment_method = Column(String(30), default="seabank", nullable=False) # 'seabank' | 'shopeepay'
    delivery_address = Column(String(255), default="Gedung Equity Tower, SCBD / Kuningan, Jakarta Selatan", nullable=True)
    estimated_delivery_minutes = Column(Integer, default=25, nullable=False) # 20-25 Menit
    kitchen_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("AppUser", back_populates="orders")
    restaurant = relationship("Restaurant", back_populates="orders")
    merchant = relationship("Merchant", back_populates="orders")
    recommendation = relationship("Recommendation", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    reward = relationship("RewardLedger", uselist=False, back_populates="order")
    meal_log = relationship("MealLog", uselist=False, back_populates="order")
