import os
import json
import logging
import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from ..core.config import settings
from ..core.database import get_db
from ..ai.client import get_openai_client
from ..db import crud
from ..models import MenuItem, MerchantDemandInsight
from ..models import Merchant, Restaurant
from ..core.ingredient_auth import require_merchant, assert_menu_owner
from ..schemas.ingredients import MenuIngredientsWrite
from ..services import ingredients as ingredient_service
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/api/merchant", tags=["Merchant Co-Pilot & Menu Management"], dependencies=[Depends(require_merchant)])
logger = logging.getLogger(__name__)

class NutritionEstimateRequest(BaseModel):
    dish_name: str
    description: Optional[str] = ""
    category: Optional[str] = "protein"

class DishDescriptionRequest(BaseModel):
    dish_name: str = Field(min_length=1, max_length=200)
    category: Optional[str] = Field("", max_length=30)
    ingredients: Optional[List[str]] = Field(default_factory=list, max_length=50)
    cooking_notes: Optional[str] = Field("", max_length=255)

    @field_validator("dish_name")
    @classmethod
    def validate_dish_name(cls, value):
        if not value.strip():
            raise ValueError("Nama menu wajib diisi")
        return value.strip()

class DishItemPayload(BaseModel):
    id: Optional[str] = Field(None, max_length=32)
    name: str = Field(min_length=1, max_length=200)
    category: Optional[str] = Field("protein", max_length=30)
    price: int = Field(gt=0, le=2147483647)
    description: Optional[str] = Field("", max_length=500)
    imageUrl: Optional[str] = Field("", max_length=500)
    tags: Optional[List[str]] = Field(default_factory=list, max_length=50)
    macros: Optional[Dict[str, float]] = None
    cookingNotes: Optional[str] = Field("Standar Higienis NutriSea (Minyak Baru)", max_length=255)
    merchant_id: Optional[str] = Field(None, max_length=32)
    restaurant_id: Optional[str] = Field(None, max_length=32)
    ingredients: Optional[MenuIngredientsWrite] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if not value.strip():
            raise ValueError("Nama menu wajib diisi")
        return value.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags):
        if tags is not None and (any(not t.strip() or len(t) > 50 for t in tags) or len(set(tags)) != len(tags)):
            raise ValueError("Tag tidak valid atau duplikat")
        return tags

    @field_validator("macros")
    @classmethod
    def validate_macros(cls, values):
        import math
        for key, value in (values or {}).items():
            maximum = 2147483647 if key in ("kcal", "sodium_mg") else 9999.9
            if not math.isfinite(value) or value < 0 or value > maximum or (key == "kcal" and value <= 0):
                raise ValueError("Nilai gizi tidak valid")
        return values

@router.get("/demand-insights")
def get_merchant_demand_insights(district: str = "Kuningan", db: Session = Depends(get_db)):
    insight = crud.get_merchant_demand_insight(db, district)
    if insight:
        return {
            "district": insight.district,
            "radius_km": float(insight.radius_km),
            "unmet_demand_count": insight.unmet_demand_count,
            "opportunity_detected": insight.opportunity_detected,
            "actionable_suggestion": insight.actionable_suggestion,
            "suggested_healthy_tags": insight.suggested_healthy_tags,
            "estimated_order_boost_pct": insight.estimated_order_boost_pct
        }
    return {
        "district": district,
        "radius_km": 2.0,
        "unmet_demand_count": 65,
        "opportunity_detected": "HIGH_PROTEIN_LOW_SUGAR_GRILLED_CHICKEN",
        "actionable_suggestion": "65 pengguna di sekitar radius 2 km mencari menu tinggi protein rendah gula minggu ini. Tambahkan paket Ayam Bakar Bumbu Kuning Non-Kecap untuk estimasi peningkatan order +20%.",
        "suggested_healthy_tags": ["MINYAK_BARU", "TANPA_SANTAN", "TINGGI_PROTEIN"],
        "estimated_order_boost_pct": 20
    }

def serialize_merchant_dish(item):
    return {
        "id": item.id, "name": item.name, "category": item.category,
        "merchant_id": item.merchant_id, "restaurant_id": item.restaurant_id,
        "price": item.discounted_price_idr, "description": item.description or "",
        "imageUrl": item.image_url or "", "tags": [t.tag for t in item.tags],
        "macros": {"kcal": item.kcal, "protein_g": float(item.protein_g),
                   "carbs_g": float(item.carbs_g), "fat_g": float(item.fat_g), "sodium_mg": item.sodium_mg},
        "cookingNotes": item.default_notes or "", "is_available": item.is_available,
    }


@router.get("/dishes")
def get_all_dishes(principal=Depends(require_merchant), db: Session = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    query = db.query(MenuItem).options(selectinload(MenuItem.tags)).filter(MenuItem.is_available.is_(True))
    if not principal.is_admin:
        query = query.filter(MenuItem.merchant_id.in_(principal.merchant_ids))
    items = query.order_by(MenuItem.id).all()
    merchants = db.query(Merchant)
    if not principal.is_admin:
        merchants = merchants.filter(Merchant.id.in_(principal.merchant_ids))
    return {"status": "success", "data": [serialize_merchant_dish(i) for i in items], "total": len(items),
            "merchants": [{"id": m.id, "name": m.name} for m in merchants.order_by(Merchant.name).all()]}


def save_dish(payload, principal, db, dish_id=None):
    item = ingredient_service.get_menu(db, dish_id, lock=True) if dish_id else None
    merchant_id = item.merchant_id if item else payload.merchant_id
    if not merchant_id:
        if principal.is_admin:
            raise HTTPException(422, "Pilih merchant pemilik menu")
        if len(principal.merchant_ids) != 1:
            raise HTTPException(422, "Pilih merchant pemilik menu")
        merchant_id = principal.merchant_ids[0]
    assert_menu_owner(principal, merchant_id)
    if not db.get(Merchant, merchant_id):
        raise HTTPException(422, "Merchant tidak ditemukan")
    if payload.restaurant_id:
        outlet = db.get(Restaurant, payload.restaurant_id)
        if not outlet or outlet.merchant_id != merchant_id:
            raise HTTPException(422, "Gerai bukan milik merchant menu")
    new_id = dish_id or payload.id or ("DISH-" + uuid.uuid4().hex[:27])
    if not dish_id and db.get(MenuItem, new_id):
        raise HTTPException(409, "ID menu sudah digunakan")
    if payload.ingredients is not None:
        ingredient_service.ensure_schema(db)
    macros = payload.macros or {}
    def value(key, default):
        return macros.get(key, getattr(item, key) if item else default)
    data = {
        "id": new_id, "merchant_id": merchant_id, "name": payload.name,
        "description": payload.description if payload.description is not None else (item.description if item else ""),
        "category": payload.category or (item.category if item else "protein"),
        "base_price_idr": payload.price, "discounted_price_idr": payload.price,
        "has_promo": False, "kcal": int(value("kcal", 350)),
        "protein_g": value("protein_g", 30), "carbs_g": value("carbs_g", 25),
        "fat_g": value("fat_g", 8), "sodium_mg": int(value("sodium_mg", 450)),
        "image_url": payload.imageUrl if payload.imageUrl is not None else (item.image_url if item else None),
        "default_notes": payload.cookingNotes if payload.cookingNotes is not None else (item.default_notes if item else ""),
        "tagged_by_merchant": True,
    }
    if "tags" in payload.model_fields_set and payload.tags is not None:
        data["tags"] = payload.tags
    try:
        item = crud.upsert_menu_item(db, data, commit=False)
        if "restaurant_id" in payload.model_fields_set:
            item.restaurant_id = payload.restaurant_id
        if payload.ingredients is not None:
            ingredient_service.replace_recipe(db, new_id, payload.ingredients.items, payload.ingredients.version)
        db.commit()
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Konflik penyimpanan menu. Muat ulang dan coba lagi.") from None
    except Exception:
        db.rollback()
        raise


@router.post("/dishes", status_code=201)
def create_dish(payload: DishItemPayload, principal=Depends(require_merchant), db: Session = Depends(get_db)):
    item = save_dish(payload, principal, db)
    return {"status": "created", "dish": serialize_merchant_dish(item)}


@router.put("/dishes/{dish_id}")
def update_dish(dish_id: str, payload: DishItemPayload, principal=Depends(require_merchant), db: Session = Depends(get_db)):
    item = save_dish(payload, principal, db, dish_id)
    return {"status": "updated", "dish": serialize_merchant_dish(item)}


@router.delete("/dishes/{dish_id}")
def delete_dish(dish_id: str, principal=Depends(require_merchant), db: Session = Depends(get_db)):
    item = ingredient_service.get_menu(db, dish_id, lock=True)
    assert_menu_owner(principal, item.merchant_id)
    item.is_available = False  # Preserve recipe and historical order/recommendation FKs.
    db.commit()
    return {"status": "deleted", "deleted_id": dish_id}


@router.post("/generate-description")
def generate_dish_description(req: DishDescriptionRequest):
    """Generate editable Indonesian storefront copy from the menu details."""
    name = req.dish_name.strip()
    ingredients = [value.strip() for value in (req.ingredients or []) if value.strip()]
    details = ", ".join(ingredients) if ingredients else "bahan khas menu tersebut"
    cooking = (req.cooking_notes or "").strip()
    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "Anda penulis deskripsi menu ShopeeFood berbahasa Indonesia. Buat satu deskripsi menarik, jelas, faktual, maksimal 500 karakter. Jangan mengarang klaim kesehatan, gizi, atau bahan yang tidak diberikan. Balas hanya deskripsinya."},
                {"role": "user", "content": f"Nama menu: {name}\nKategori: {req.category or 'menu makanan'}\nBahan/komposisi: {details}\nCatatan memasak: {cooking or 'tidak ada'}"},
            ],
            temperature=0.7,
            max_tokens=180,
        )
        description = (response.choices[0].message.content or "").strip().strip('"')
        if description.startswith("```"):
            description = description.replace("```", "").strip()
        if description:
            return {"description": description[:500]}
    except Exception as error:
        logger.warning("AI dish description generation fallback used: %s", error)

    description = f"{name} dengan {details}. "
    if cooking:
        description += cooking.rstrip(".") + "."
    else:
        description += "Disiapkan segar dengan racikan bumbu pilihan."
    return {"description": description[:500]}


@router.post("/estimate-nutrition")
def estimate_dish_nutrition(req: NutritionEstimateRequest):
    dish_name = req.dish_name.strip()
    if not dish_name:
        raise HTTPException(status_code=400, detail="Nama hidangan wajib diisi")

    try:
        client = get_openai_client()
        prompt = f"""Nama Hidangan: {dish_name}
Deskripsi/Bahan Masakan: {req.description or 'Porsi makan khas warung/restoran Indonesia'}
Kategori: {req.category}

Perkirakan estimasi komposisi gizi hidangan ini untuk porsi 1 orang berdasarkan standar Tabel Komposisi Pangan Indonesia (TKPI Kemenkes RI).
Format balikan HARUS HANYA JSON murni persis berikut tanpa markdown:
{{
  "kcal": 320,
  "protein_g": 32,
  "carbs_g": 18,
  "fat_g": 8,
  "sodium_mg": 420,
  "healthy_tags": ["MINYAK_BARU", "BEBAS_GORENGAN", "TINGGI_PROTEIN"],
  "cooking_notes": "Instruksi dapur standar higienis untuk warung",
  "rationale": "Alasan singkat estimasi gizi berdasarkan bahan utama dan cara memasak"
}}"""
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Anda adalah AI Nutrition Engine NutriSea untuk ShopeeFood berbasis data TKPI Kemenkes RI. Balas HANYA dengan JSON valid tanpa penjelasan atau teks di luar JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=400
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)
        return {
            "dish_name": dish_name,
            "estimated_macros": {
                "kcal": float(data.get("kcal", 330)),
                "protein_g": float(data.get("protein_g", 30)),
                "carbs_g": float(data.get("carbs_g", 20)),
                "fat_g": float(data.get("fat_g", 8)),
                "sodium_mg": float(data.get("sodium_mg", 450))
            },
            "healthy_tags": data.get("healthy_tags", ["MINYAK_BARU", "TINGGI_PROTEIN"]),
            "cooking_notes": data.get("cooking_notes", "Gunakan minyak goreng baru, pisahkan sambal"),
            "rationale": data.get("rationale", "Dihitung berdasarkan porsi standar TKPI Kemenkes RI.")
        }
    except Exception as e:
        logger.warning(f"AI nutrition estimation fallback used: {e}")
        lower_name = dish_name.lower()
        if "ikan" in lower_name:
            kcal, prot, carb, fat, sod = 295, 33, 8, 7, 390
            tags = ["BEBAS_GORENGAN", "TINGGI_PROTEIN", "MINYAK_BARU"]
            notes = "Ikan segar dibakar/dikukus bumbu rempah tanpa margarin berlebih"
            rat = "Ikan adalah sumber protein kaya asam lemak tak jenuh ganda (Omega-3)."
        elif "ayam" in lower_name:
            kcal, prot, carb, fat, sod = 360, 35, 14, 9, 450
            tags = ["TINGGI_PROTEIN", "MINYAK_BARU", "TANPA_SANTAN"]
            notes = "Dada ayam tanpa kulit, bumbu kuning kaldu segar tanpa santan"
            rat = "Dada ayam tinggi protein untuk pemeliharaan jaringan otot dan rasa kenyang tahan lama."
        elif "sayur" in lower_name or "gado" in lower_name or "pecel" in lower_name:
            kcal, prot, carb, fat, sod = 145, 7, 18, 4, 320
            tags = ["TINGGI_SERAT", "SAYUR_BENING", "RENDAH_LEMAK"]
            notes = "Sayuran segar dicuci bersih, kuah kaldu bening tanpa minyak berlebih"
            rat = "Kaya serat pangan dan mikronutrien sesuai anjuran Isi Piringku Kemenkes."
        elif "tahu" in lower_name or "tempe" in lower_name:
            kcal, prot, carb, fat, sod = 210, 19, 15, 7, 340
            tags = ["PROTEIN_NABATI", "BEBAS_GORENGAN", "RENDAH_LEMAK"]
            notes = "Dipanggang/bacem kukus dengan rempah alami tanpa minyak jelantah"
            rat = "Sumber protein nabati dan prebiotik alami untuk kesehatan saluran cerna."
        else:
            kcal, prot, carb, fat, sod = 320, 24, 28, 8, 410
            tags = ["MINYAK_BARU", "BEBAS_GORENGAN"]
            notes = "Porsi seimbang, kurangi garam berlebih dan pisahkan kuah/sambal"
            rat = "Estimasi komposisi gizi seimbang porsi makan siang sehat khas Indonesia."

        return {
            "dish_name": dish_name,
            "estimated_macros": {
                "kcal": float(kcal),
                "protein_g": float(prot),
                "carbs_g": float(carb),
                "fat_g": float(fat),
                "sodium_mg": float(sod)
            },
            "healthy_tags": tags,
            "cooking_notes": notes,
            "rationale": rat
        }

@router.get("/outlets")
def get_merchant_outlets(
    merchant_id: Optional[str] = None,
    principal=Depends(require_merchant),
    db: Session = Depends(get_db)
):
    """
    Returns all restaurant outlets/brands managed by this merchant partner.
    """
    from ..models.restaurant import Restaurant
    from ..models.merchant import Merchant
    from ..models.menu_item import MenuItem

    if merchant_id:
        assert_menu_owner(principal, merchant_id)
        merchant = db.get(Merchant, merchant_id)
    else:
        query = db.query(Merchant)
        if not principal.is_admin:
            query = query.filter(Merchant.id.in_(principal.merchant_ids))
        merchant = query.order_by(Merchant.id).first()
    if not merchant:
        raise HTTPException(404, "Merchant tidak ditemukan")

    outlets = []
    if merchant:
        rests = db.query(Restaurant).filter(Restaurant.merchant_id == merchant.id).all()
        for r in rests:
            dish_count = db.query(MenuItem).filter(MenuItem.restaurant_id == r.id).count()
            outlets.append({
                "id": r.id,
                "name": r.name,
                "brand_name": r.brand_name,
                "cuisine_type": r.cuisine_type,
                "area": r.area,
                "address": r.address,
                "distance_km": float(r.distance_km),
                "delivery_radius_km": float(r.delivery_radius_km),
                "rating": float(r.rating),
                "rating_count": r.rating_count,
                "is_verified_hygiene": r.is_verified_hygiene,
                "is_open": r.is_open,
                "dish_count": dish_count
            })

    return {
        "status": "success",
        "merchant": {
            "id": merchant.id if merchant else merchant_id,
            "name": merchant.name if merchant else "PT Berkah Boga Mandiri",
            "owner_name": merchant.owner_name if merchant else "Haji Bambang Sutrisno",
            "commission_rate": float(merchant.commission_rate) if merchant else 0.05,
            "seabank_account_no": merchant.seabank_account_no if merchant else "9012-3456-7890"
        },
        "total_outlets": len(outlets),
        "outlets": outlets
    }

@router.post("/outlets/{restaurant_id}/toggle-status")
def toggle_outlet_status(
    restaurant_id: str,
    principal=Depends(require_merchant),
    db: Session = Depends(get_db)
):
    """
    Toggles open/closed operational status for a restaurant outlet.
    """
    from ..models.restaurant import Restaurant

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail=f"Restaurant outlet '{restaurant_id}' not found")

    assert_menu_owner(principal, restaurant.merchant_id)
    restaurant.is_open = not restaurant.is_open
    db.commit()

    return {
        "status": "success",
        "restaurant_id": restaurant.id,
        "name": restaurant.name,
        "is_open": restaurant.is_open,
        "message": f"Outlet {restaurant.name} sekarang dalam status {'BUKA' if restaurant.is_open else 'TUTUP'}."
    }
