import re
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.ingredient_auth import current_principal, require_admin, grant_merchant_access
from ..models.merchant_application import MerchantApplication
from ..models import Merchant, Restaurant
from ..models.base import utcnow

router = APIRouter(prefix="/api/merchant-applications", tags=["Merchant applications"])
admin_router = APIRouter(prefix="/api/admin/merchant-applications", tags=["Merchant application review"])


class ApplicationWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    business_name: str = Field(min_length=2, max_length=100)
    owner_name: str = Field(min_length=2, max_length=100)
    contact_email: str = Field(min_length=3, max_length=150)
    contact_phone: str = Field(min_length=8, max_length=30)
    area: str = Field(min_length=2, max_length=80)
    address: str = Field(min_length=8, max_length=255)
    cuisine_type: str = Field(min_length=2, max_length=80)

    @field_validator("contact_email")
    @classmethod
    def email(cls, value):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Alamat email tidak valid")
        return value

    @field_validator("contact_phone")
    @classmethod
    def phone(cls, value):
        if not re.fullmatch(r"\+?[0-9 ()-]+", value) or len(re.sub(r"\D", "", value)) < 8:
            raise ValueError("Nomor telepon tidak valid")
        return value


class ReviewWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    decision: Literal["APPROVED", "REJECTED"]
    reason: str = Field(default="", max_length=500)
    expected_updated_at: datetime


def serialize(row):
    return {key: getattr(row, key) for key in (
        "id", "business_name", "owner_name", "contact_email", "contact_phone", "area", "address",
        "cuisine_type", "status", "merchant_id", "review_reason", "created_at", "updated_at", "reviewed_at")}


@router.get("/me")
def own_application(principal=Depends(current_principal), db: Session = Depends(get_db)):
    row = db.scalar(select(MerchantApplication).where(MerchantApplication.user_id == principal.user_id))
    return {"application": serialize(row) if row else None}


@router.post("/me", status_code=201)
def submit_application(data: ApplicationWrite, principal=Depends(current_principal), db: Session = Depends(get_db)):
    if principal.is_admin or principal.merchant_ids:
        raise HTTPException(409, "Akun sudah memiliki akses pengelolaan merchant")
    row = db.scalar(select(MerchantApplication).where(MerchantApplication.user_id == principal.user_id).with_for_update())
    if row and row.status != "REJECTED":
        raise HTTPException(409, "Pengajuan sudah dikirim; periksa status pengajuan Anda")
    if not row:
        row = MerchantApplication(id=str(uuid4()), user_id=principal.user_id)
        db.add(row)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    row.status = "PENDING"
    row.review_reason = row.reviewed_by = row.reviewed_at = None
    row.updated_at = utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Pengajuan sudah dikirim; muat ulang status Anda") from None
    db.refresh(row)
    return {"application": serialize(row)}


@admin_router.get("")
def list_applications(status: Literal["PENDING", "APPROVED", "REJECTED"] = "PENDING",
                      page: int = Query(1, ge=1), principal=Depends(require_admin), db: Session = Depends(get_db)):
    query = select(MerchantApplication).where(MerchantApplication.status == status)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(MerchantApplication.updated_at, MerchantApplication.id).offset((page - 1) * 20).limit(20))
    return {"items": [serialize(row) for row in rows], "total": total, "page": page}


@admin_router.post("/{application_id}/review")
def review_application(application_id: str, data: ReviewWrite, principal=Depends(require_admin), db: Session = Depends(get_db)):
    row = db.scalar(select(MerchantApplication).where(MerchantApplication.id == application_id).with_for_update())
    if not row:
        raise HTTPException(404, "Pengajuan tidak ditemukan")
    if row.status != "PENDING":
        if row.status == data.decision:
            if row.status == "APPROVED":
                grant_merchant_access(row.user_id, row.merchant_id)
            return {"application": serialize(row)}
        raise HTTPException(409, "Pengajuan sudah diproses; muat ulang daftar")
    def utc(value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if utc(row.updated_at) != utc(data.expected_updated_at):
        raise HTTPException(409, "Data pengajuan telah berubah; muat ulang sebelum memproses")
    if data.decision == "REJECTED" and not data.reason:
        raise HTTPException(422, "Alasan penolakan wajib diisi")
    if data.decision == "APPROVED":
        merchant_id, outlet_id = "MTR-" + uuid4().hex[:24], "RST-" + uuid4().hex[:24]
        db.add(Merchant(id=merchant_id, name=row.business_name, area=row.area, owner_name=row.owner_name,
                        contact_email=row.contact_email, contact_phone=row.contact_phone,
                        is_verified_hygiene=False, rating=0, rating_count=0, is_open=False))
        db.flush()
        db.add(Restaurant(id=outlet_id, merchant_id=merchant_id, name=row.business_name,
                          brand_name=row.business_name, area=row.area, address=row.address,
                          cuisine_type=row.cuisine_type, is_verified_hygiene=False, rating=0, rating_count=0, is_open=False))
        row.merchant_id = merchant_id
    row.status = data.decision
    row.review_reason = data.reason or None
    row.reviewed_by = principal.user_id
    row.reviewed_at = row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    # Commit merchant resources before publishing access. A Clerk failure grants
    # nothing locally; repeating this review retries the same merchant ID.
    if row.status == "APPROVED":
        grant_merchant_access(row.user_id, row.merchant_id)
    return {"application": serialize(row)}
