#!/usr/bin/env python3
"""
Seed 80 Authentic Indonesian FatSecret Dishes into PostgreSQL and Seed Catalog
"""

import os
import sys
import json
from decimal import Decimal

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import SessionLocal
from app.models.merchant import Merchant
from app.models.restaurant import Restaurant
from app.models.menu_item import MenuItem, MealSlot, NutritionSource
from app.models.menu_item_tag import MenuItemTag, TagAuthor

OUTLET_MAPPING = {
    "protein": ("RST-WBM-01", "MTR-WBM-01"),
    "hemat": ("RST-WBM-02", "MTR-WBM-01"),
    "rendah-kalori": ("RST-WPM-01", "MTR-WPM-05"),
    "bebas-santan": ("RST-SKM-01", "MTR-SKM-02"),
    "lambung": ("RST-DSS-01", "MTR-DSS-03"),
}

def seed_all():
    json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "food", "fatsecret_indonesian_foods_expanded.json")
    with open(json_path, "r", encoding="utf-8") as f:
        dishes = json.load(f)

    db = SessionLocal()
    seed_catalog_items = []

    try:
        print(f"[*] Seeding {len(dishes)} FatSecret dishes with personas column into PostgreSQL...")
        for i, d in enumerate(dishes, start=1):
            cat = d["category"]
            
            # Specific outlet assignment for specialty foods
            name_lower = d["name"].lower()
            if "ikan" in name_lower or "patin" in name_lower or "bandeng" in name_lower or "cakalang" in name_lower or "salmon" in name_lower or "kakap" in name_lower:
                rst_id, mtr_id = "RST-RIN-01", "MTR-RIN-04"
            elif "soto" in name_lower or "rawon" in name_lower or "sop buntut" in name_lower:
                rst_id, mtr_id = "RST-SKM-01", "MTR-SKM-02"
            elif "pecel" in name_lower or "urap" in name_lower or "lalapan" in name_lower or "bayam" in name_lower or "katuk" in name_lower:
                rst_id, mtr_id = "RST-WPM-01", "MTR-WPM-05"
            elif "kukus" in name_lower or "lambung" in name_lower or "bubur" in name_lower or "jamur" in name_lower:
                rst_id, mtr_id = "RST-DSS-01", "MTR-DSS-03"
            else:
                rst_id, mtr_id = OUTLET_MAPPING.get(cat, ("RST-WBM-01", "MTR-WBM-01"))

            item_id = d["food_id"]
            base_price = d["price_idr"]
            discount_price = int(round(base_price * 0.85))

            # Fetch merchant & restaurant names
            restaurant = db.query(Restaurant).filter(Restaurant.id == rst_id).first()
            merchant = db.query(Merchant).filter(Merchant.id == mtr_id).first()
            rst_name = restaurant.name if restaurant else "Warteg Berkah Mandiri"

            menu_item = MenuItem(
                id=item_id,
                restaurant_id=rst_id,
                merchant_id=mtr_id,
                name=d["name"],
                category=cat,
                base_price_idr=base_price,
                discounted_price_idr=discount_price,
                has_promo=True,
                rating=Decimal("4.9") if i % 2 == 0 else Decimal("4.8"),
                sold_count=f"{1 + (i % 3)}.{2 + (i % 7)}rb+",
                kcal=d["calories"],
                protein_g=Decimal(str(d["protein_g"])),
                carbs_g=Decimal(str(d["carbs_g"])),
                fat_g=Decimal(str(d["fat_g"])),
                sodium_mg=d["sodium_mg"],
                image_url=None,
                allergens=d["allergens"],
                hygiene_badges=["Minyak Baru Terverifikasi", "Dapur Higienis"],
                default_notes=d["description"],
                nutrition_source=NutritionSource.TKPI,
                is_available=True,
                matched_personas=d.get("personas", [])
            )
            db.merge(menu_item)

            # Tags
            for t in d["healthy_tags"]:
                tag_obj = MenuItemTag(
                    item_id=item_id,
                    tag=t,
                    tagged_by=TagAuthor.SYSTEM,
                    verified=True
                )
                db.merge(tag_obj)

            # Seed Catalog entry for AI Co-Pilot
            seed_catalog_items.append({
                "merchant_id": mtr_id,
                "merchant_name": rst_name,
                "item_id": item_id,
                "item_name": d["name"],
                "base_price": base_price,
                "discounted_price": discount_price,
                "has_promo": True,
                "healthy_tags": d["healthy_tags"],
                "allergens": d["allergens"],
                "estimated_macros": {
                    "kcal": d["calories"],
                    "protein_g": d["protein_g"],
                    "carbs_g": d["carbs_g"],
                    "fat_g": d["fat_g"],
                    "sodium_mg": d["sodium_mg"]
                },
                "default_cooking_notes": d["description"],
                "personas": d.get("personas", []),
                "matched_archetypes": d.get("matched_archetypes", []),
                "assigned_personas_count": d.get("assigned_personas_count", 0)
            })

        db.commit()
        print(f"[+] Successfully seeded all {len(dishes)} dishes with matched_personas into PostgreSQL!")

        # Update backend/app/data/seed_catalog.json
        catalog_path = os.path.join(backend_dir, "app", "data", "seed_catalog.json")
        with open(catalog_path, "w", encoding="utf-8") as f:
            json.dump(seed_catalog_items, f, indent=2, ensure_ascii=False)
        print(f"[+] Updated AI meal planner catalog at: {catalog_path}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_all()
