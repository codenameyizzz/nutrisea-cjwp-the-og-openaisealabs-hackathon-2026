"""Verify Clerk identity; resolve permissions from trusted assignments.

Clerk public metadata grants operator-managed roles. Approved applications add
merchant membership atomically in PostgreSQL. Client role preferences, unsafe
metadata and legacy database roles grant no access.
"""
from dataclasses import dataclass
from functools import lru_cache

import jwt
import httpx
from urllib.parse import quote
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .database import get_db
from sqlalchemy.orm import Session

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class IngredientPrincipal:
    user_id: str
    role: str
    merchant_ids: tuple[str, ...] = ()

    @property
    def is_admin(self):
        return self.role == "SHOPEE_ADMIN"


@lru_cache(maxsize=4)
def jwks_client(issuer: str):
    return jwt.PyJWKClient(issuer.rstrip("/") + "/.well-known/jwks.json", cache_keys=True, timeout=5, lifespan=300)


def public_metadata(user_id: str) -> dict:
    if not settings.CLERK_SECRET_KEY:
        raise HTTPException(503, "Konfigurasi akses akun belum tersedia")
    try:
        response = httpx.get(
            "https://api.clerk.com/v1/users/" + quote(user_id, safe=""),
            headers={"Authorization": "Bearer " + settings.CLERK_SECRET_KEY}, timeout=5,
        )
        if response.status_code == 404:
            raise HTTPException(401, "Akun tidak ditemukan", headers={"WWW-Authenticate": "Bearer"})
        response.raise_for_status()
        data = response.json()
        if data.get("id") != user_id or not isinstance(data.get("public_metadata"), dict):
            raise ValueError()
        return data["public_metadata"]
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        raise HTTPException(503, "Layanan hak akses akun tidak tersedia") from None


def verify_session(token: str) -> IngredientPrincipal:
    issuer = settings.CLERK_ISSUER.rstrip("/")
    if not issuer.startswith("https://"):
        raise HTTPException(503, "Verifikasi identitas belum dikonfigurasi")
    try:
        if jwt.get_unverified_header(token).get("alg") != "RS256":
            raise jwt.InvalidTokenError()
        key = jwks_client(issuer).get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token, key, algorithms=["RS256"], issuer=issuer,
            audience=settings.CLERK_AUDIENCE or None,
            options={"require": ["exp", "iat", "nbf", "sub", "iss"], "verify_aud": bool(settings.CLERK_AUDIENCE)},
            leeway=5,
        )
        parties = [x.strip() for x in settings.CLERK_AUTHORIZED_PARTIES.split(",") if x.strip()]
        if not parties or claims.get("azp") not in parties or claims.get("sts") == "pending":
            raise jwt.InvalidTokenError()
        if not isinstance(claims.get("sub"), str) or not claims["sub"]:
            raise jwt.InvalidTokenError()
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(503, "Layanan verifikasi identitas tidak tersedia") from None
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(401, "Sesi tidak valid atau telah berakhir", headers={"WWW-Authenticate": "Bearer"}) from None
    metadata = public_metadata(claims["sub"])
    role = metadata.get("role", "CONSUMER")
    merchant_ids = metadata.get("merchant_ids", [])
    if role not in ("CONSUMER", "MERCHANT_ADMIN", "SHOPEE_ADMIN") or not isinstance(merchant_ids, list) or any(
        not isinstance(x, str) or not x.strip() or len(x) > 32 for x in merchant_ids
    ):
        raise HTTPException(503, "Konfigurasi peran akun tidak valid; hubungi pengelola")
    return IngredientPrincipal(claims["sub"], role, tuple(merchant_ids))


def current_principal(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Silakan masuk terlebih dahulu", headers={"WWW-Authenticate": "Bearer"})
    principal = verify_session(credentials.credentials)
    # Only an admin-approved database application can add merchant access.
    # Approval, merchant creation and this assignment share one transaction.
    from sqlalchemy import select
    from ..models.merchant_application import MerchantApplication
    assigned = tuple(db.scalars(select(MerchantApplication.merchant_id).where(
        MerchantApplication.user_id == principal.user_id, MerchantApplication.status == "APPROVED",
        MerchantApplication.merchant_id.is_not(None))))
    if assigned and not principal.is_admin:
        return IngredientPrincipal(principal.user_id, "MERCHANT_ADMIN", tuple(dict.fromkeys((*principal.merchant_ids, *assigned))))
    return principal


def require_admin(principal: IngredientPrincipal = Depends(current_principal)):
    if not principal.is_admin:
        raise HTTPException(403, "Hanya admin yang dapat mengelola master bahan")
    return principal


def require_merchant(principal: IngredientPrincipal = Depends(current_principal)):
    if not principal.is_admin and (principal.role != "MERCHANT_ADMIN" or not principal.merchant_ids):
        raise HTTPException(403, "Akses merchant diperlukan")
    return principal


def assert_menu_owner(principal: IngredientPrincipal, merchant_id: str):
    if not principal.is_admin and merchant_id not in principal.merchant_ids:
        raise HTTPException(403, "Menu bukan milik merchant Anda")
