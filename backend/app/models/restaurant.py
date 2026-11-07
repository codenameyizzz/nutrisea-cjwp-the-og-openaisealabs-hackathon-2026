from sqlalchemy import Column, String, Numeric, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base
from .base import utcnow

class Restaurant(Base):
    """
    Restaurant / Outlet / Brand Storefront Entity.
    A single Merchant business partner can operate multiple Restaurant outlets or brands.
    """
    __tablename__ = "restaurant"

    id = Column(String(32), primary_key=True, index=True) # e.g. 'RST-WBM-01'
    merchant_id = Column(String(32), ForeignKey("merchant.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False) # e.g. 'Warteg Berkah Mandiri - Kuningan'
    brand_name = Column(String(100), nullable=False) # e.g. 'Warteg Berkah Mandiri'
    cuisine_type = Column(String(80), default="Indonesian", nullable=False) # e.g. 'Warteg & Masakan Rumahan'
    area = Column(String(80), nullable=False) # e.g. 'Kuningan', 'SCBD'
    address = Column(String(255), nullable=True) # e.g. 'Jl. Prof. DR. Satrio No. 18, Kuningan'
    lat = Column(Numeric(9, 6), nullable=True)
    lng = Column(Numeric(9, 6), nullable=True)
    distance_km = Column(Numeric(4, 1), default=1.0, nullable=False)
    delivery_radius_km = Column(Numeric(4, 1), default=3.0, nullable=False)
    rating = Column(Numeric(3, 2), default=4.8, nullable=False)
    rating_count = Column(Integer, default=350, nullable=False)
    is_verified_hygiene = Column(Boolean, default=True, nullable=False)
    is_open = Column(Boolean, default=True, nullable=False)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    merchant = relationship("Merchant", back_populates="restaurants")
    menu_items = relationship("MenuItem", back_populates="restaurant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="restaurant")
