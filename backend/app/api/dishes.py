from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from ..core.database import get_db
from ..models.menu_item import MenuItem
from ..models.merchant import Merchant
from ..models.restaurant import Restaurant
from ..models.menu_item_tag import MenuItemTag

router = APIRouter(prefix="/api/dishes", tags=["Dishes & Food Catalog (PostgreSQL)"])

def serialize_dish(
    item: MenuItem,
    restaurant: Optional[Restaurant] = None,
    merchant: Optional[Merchant] = None
) -> Dict[str, Any]:
    # Extract tags
    healthy_tags = []
    if item.tags:
        for t in item.tags:
            tag_name = t.tag.replace("_", " ").title()
            healthy_tags.append(tag_name)

    # Outlet and brand info: prioritize Restaurant outlet, fallback to Merchant
    outlet_name = restaurant.name if restaurant else (merchant.name if merchant else "Warteg Berkah Mandiri")
    brand_name = restaurant.brand_name if restaurant else outlet_name
    district = restaurant.area if restaurant and restaurant.area else (merchant.area if merchant and merchant.area else "Kuningan")
    distance_km = float(restaurant.distance_km) if restaurant and restaurant.distance_km is not None else (
        float(merchant.distance_km) if merchant and merchant.distance_km is not None else 0.8
    )

    return {
        "id": item.id,
        "merchantId": item.merchant_id,
        "nutritionSource": item.nutrition_source.value if item.nutrition_source else None,
        "name": item.name,
        "category": item.category,
        "restaurantId": item.restaurant_id,
        "restaurantName": outlet_name,
        "brandName": brand_name,
        "merchantName": outlet_name, # Kept for backward compatibility with existing frontend
        "district": district,
        "distanceKm": distance_km,
        "rating": float(item.rating) if item.rating else 4.8,
        "soldCount": item.sold_count or "1.5rb+",
        "basePrice": item.base_price_idr,
        "discountedPrice": item.discounted_price_idr,
        "imageUrl": item.image_url or "",
        "healthyTags": healthy_tags,
        "macros": {
            "kcal": item.kcal,
            "proteinG": float(item.protein_g),
            "carbsG": float(item.carbs_g),
            "fatG": float(item.fat_g),
            "sodiumMg": item.sodium_mg
        },
        "cookingNotes": item.default_notes or "",
        "hygieneBadges": item.hygiene_badges or [],
        "allergens": item.allergens or [],
        "allergenCoverage": "unknown",
        "isAvailable": item.is_available if item.is_available is not None else True,
        "personas": item.matched_personas or [],
        "matchedPersonas": item.matched_personas or []
    }

@router.get("")
def list_dishes(
    category: Optional[str] = Query(None, description="hemat, protein, rendah-kalori, bebas-santan, lambung"),
    merchant_id: Optional[str] = Query(None),
    restaurant_id: Optional[str] = Query(None),
    persona_id: Optional[str] = Query(None, description="Filter dishes matching this persona ID"),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Returns all dishes stored in Aiven Cloud PostgreSQL.
    Supports filtering by category, merchant, restaurant, and persona_id.
    """
    query = (
        db.query(MenuItem, Restaurant, Merchant).options(selectinload(MenuItem.tags))
        .outerjoin(Restaurant, MenuItem.restaurant_id == Restaurant.id)
        .outerjoin(Merchant, MenuItem.merchant_id == Merchant.id)
    )

    if category:
        query = query.filter(MenuItem.category == category)
    if restaurant_id:
        query = query.filter(MenuItem.restaurant_id == restaurant_id)
    if merchant_id:
        query = query.filter(MenuItem.merchant_id == merchant_id)

    results = query.order_by(MenuItem.id.asc()).limit(limit).all()

    dishes = [serialize_dish(item, restaurant, merchant) for item, restaurant, merchant in results]

    if persona_id:
        dishes = [d for d in dishes if persona_id in (d.get("personas") or [])]

    return {
        "status": "success",
        "total": len(dishes),
        "data": dishes
    }

@router.get("/{dish_id}")
def get_dish(dish_id: str, db: Session = Depends(get_db)):
    """
    Returns a single dish by ID with full nutritional, restaurant, and merchant data.
    """
    result = (
        db.query(MenuItem, Restaurant, Merchant).options(selectinload(MenuItem.tags))
        .outerjoin(Restaurant, MenuItem.restaurant_id == Restaurant.id)
        .outerjoin(Merchant, MenuItem.merchant_id == Merchant.id)
        .filter(MenuItem.id == dish_id)
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail=f"Dish '{dish_id}' not found in database")

    item, restaurant, merchant = result
    return {
        "status": "success",
        "data": serialize_dish(item, restaurant, merchant)
    }
