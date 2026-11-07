from sqlalchemy import Column, String, Text, DateTime, ForeignKey, CheckConstraint
from ..core.database import Base
from .base import utcnow


class MerchantApplication(Base):
    __tablename__ = "merchant_application"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING','APPROVED','REJECTED')", name="ck_merchant_application_status"),
        CheckConstraint("status != 'APPROVED' OR merchant_id IS NOT NULL", name="ck_merchant_application_assignment"),
    )
    id = Column(String(36), primary_key=True)
    user_id = Column(String(255), nullable=False, unique=True)
    business_name = Column(String(100), nullable=False)
    owner_name = Column(String(100), nullable=False)
    contact_email = Column(String(150), nullable=False)
    contact_phone = Column(String(30), nullable=False)
    area = Column(String(80), nullable=False)
    address = Column(String(255), nullable=False)
    cuisine_type = Column(String(80), nullable=False)
    status = Column(String(10), nullable=False, default="PENDING", index=True)
    merchant_id = Column(String(32), ForeignKey("merchant.id", ondelete="RESTRICT"), unique=True)
    review_reason = Column(Text)
    reviewed_by = Column(String(255))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
