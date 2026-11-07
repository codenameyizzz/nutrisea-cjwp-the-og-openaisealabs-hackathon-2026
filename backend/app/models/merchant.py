from sqlalchemy import Column, String, Numeric, Boolean, Integer
from sqlalchemy.orm import relationship
from ..core.database import Base

class Merchant(Base):
    __tablename__ = "merchant"

    id = Column(String(32), primary_key=True, index=True) # e.g. 'MTR-WBM-01'
    name = Column(String(150), nullable=False)
    area = Column(String(80), nullable=False)
    lat = Column(Numeric(9, 6), nullable=True)
    lng = Column(Numeric(9, 6), nullable=True)
    distance_km = Column(Numeric(4, 1), default=1.0, nullable=False)
    delivery_radius_km = Column(Numeric(4, 1), default=2.5, nullable=False) # e.g. "Radius Pengantaran 2.5 km"
    rating = Column(Numeric(3, 2), default=4.8, nullable=False)
    rating_count = Column(Integer, default=420, nullable=False) # e.g. "420 ulasan pelanggan"
    is_verified_hygiene = Column(Boolean, default=True, nullable=False) # "Mitra Higienis NutriSea Terverifikasi"
    commission_rate = Column(Numeric(4, 2), default=0.05, nullable=False) # e.g. 0.05 for "Komisi Hemat 5% Aktif"
    image_url = Column(String(500), nullable=True)
    is_open = Column(Boolean, default=True, nullable=False)
    owner_name = Column(String(100), nullable=True) # e.g. "Haji Bambang Sutrisno"
    contact_email = Column(String(150), nullable=True) # e.g. "partner@berkahboga.id"
    contact_phone = Column(String(30), nullable=True) # e.g. "+628123456789"
    seabank_account_no = Column(String(30), nullable=True) # e.g. "9012-3456-7890"

    restaurants = relationship("Restaurant", back_populates="merchant", cascade="all, delete-orphan")
    menu_items = relationship("MenuItem", back_populates="merchant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="merchant")
    demand_insights = relationship("MerchantDemandInsight", back_populates="merchant", cascade="all, delete-orphan")
