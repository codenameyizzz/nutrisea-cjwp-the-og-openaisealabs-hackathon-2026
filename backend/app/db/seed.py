import os
import json
import logging
from sqlalchemy.orm import Session
from ..core.database import SessionLocal, create_all_tables
from .crud import (
    upsert_merchant,
    upsert_menu_item,
    upsert_user,
    upsert_health_profile
)
from .models import UserRole, MerchantDemandInsight

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MERCHANT_METADATA = {
    "Warteg Berkah Mandiri": {"id": "MTR-WBM-01", "area": "Kuningan", "lat": -6.2297, "lng": 106.8295, "distance_km": 0.8, "delivery_radius_km": 2.5, "rating": 4.9, "rating_count": 420},
    "Soto Kudus Menara": {"id": "MTR-SKM-02", "area": "SCBD", "lat": -6.2250, "lng": 106.8080, "distance_km": 1.1, "delivery_radius_km": 2.5, "rating": 4.9, "rating_count": 310},
    "Gado-Gado Ibu Marni": {"id": "MTR-GGM-03", "area": "Palmerah", "lat": -6.2050, "lng": 106.7900, "distance_km": 1.4, "delivery_radius_km": 2.0, "rating": 4.7, "rating_count": 180},
    "Pecel Sayur Bu Sri": {"id": "MTR-PSB-04", "area": "Kuningan", "lat": -6.2310, "lng": 106.8250, "distance_km": 0.9, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 290},
    "Pondok Ikan Bakar Bahari": {"id": "MTR-IBB-05", "area": "Menteng", "lat": -6.1950, "lng": 106.8320, "distance_km": 2.1, "delivery_radius_km": 3.0, "rating": 4.9, "rating_count": 510},
    "Warteg Kharisma Sehat": {"id": "MTR-WKS-06", "area": "Senayan", "lat": -6.2200, "lng": 106.8000, "distance_km": 1.2, "delivery_radius_km": 2.5, "rating": 4.7, "rating_count": 220},
    "Dapur Sup Sehat Bu Haji": {"id": "MTR-SSB-07", "area": "SCBD", "lat": -6.2240, "lng": 106.8090, "distance_km": 0.7, "delivery_radius_km": 2.0, "rating": 4.9, "rating_count": 340},
    "Dapur Sunda Laras": {"id": "MTR-DSL-08", "area": "Palmerah", "lat": -6.2070, "lng": 106.7930, "distance_km": 1.5, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 160},
    "Warteg Lestari Sehat": {"id": "MTR-WLS-09", "area": "Sudirman", "lat": -6.2150, "lng": 106.8200, "distance_km": 1.0, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 270},
    "Warteg Sejahtera": {"id": "MTR-WSJ-10", "area": "SCBD", "lat": -6.2260, "lng": 106.8070, "distance_km": 0.6, "delivery_radius_km": 2.0, "rating": 4.8, "rating_count": 195},
    "Resto Sehat Kencana": {"id": "MTR-RSK-11", "area": "Kuningan", "lat": -6.2320, "lng": 106.8270, "distance_km": 1.3, "delivery_radius_km": 2.5, "rating": 4.9, "rating_count": 380},
    "Dapur Nasi Tim Sehat": {"id": "MTR-NTS-12", "area": "Menteng", "lat": -6.1980, "lng": 106.8350, "distance_km": 1.8, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 140},
    "Rawon Bening Cak Tris": {"id": "MTR-RCT-13", "area": "Senayan", "lat": -6.2220, "lng": 106.8030, "distance_km": 1.6, "delivery_radius_km": 2.5, "rating": 4.9, "rating_count": 410},
    "Warung Jawa Segar": {"id": "MTR-WJS-14", "area": "Palmerah", "lat": -6.2080, "lng": 106.7910, "distance_km": 1.7, "delivery_radius_km": 2.5, "rating": 4.7, "rating_count": 130},
    "Dapur Kudus Asli": {"id": "MTR-DKA-15", "area": "SCBD", "lat": -6.2255, "lng": 106.8085, "distance_km": 1.0, "delivery_radius_km": 2.5, "rating": 4.9, "rating_count": 320},
    "Bubur Sehat Barito": {"id": "MTR-BSB-16", "area": "Senayan", "lat": -6.2210, "lng": 106.8015, "distance_km": 1.3, "delivery_radius_km": 2.0, "rating": 4.8, "rating_count": 280},
    "Dapur Mama Sehat": {"id": "MTR-DMS-17", "area": "Kuningan", "lat": -6.2305, "lng": 106.8260, "distance_km": 0.9, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 190},
    "Dapur Bakso Ikan Sehat": {"id": "MTR-BIS-18", "area": "Menteng", "lat": -6.1960, "lng": 106.8330, "distance_km": 1.4, "delivery_radius_km": 2.5, "rating": 4.9, "rating_count": 250},
    "FitBite Greens": {"id": "MTR-FBG-19", "area": "SCBD", "lat": -6.2245, "lng": 106.8075, "distance_km": 0.5, "delivery_radius_km": 2.0, "rating": 4.9, "rating_count": 480},
    "Ayam Panggang Bu Citro": {"id": "MTR-APC-20", "area": "Kuningan", "lat": -6.2315, "lng": 106.8280, "distance_km": 1.2, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 210},
    "Dapur Ikan Laut Segar": {"id": "MTR-ILS-21", "area": "Palmerah", "lat": -6.2065, "lng": 106.7925, "distance_km": 1.6, "delivery_radius_km": 2.5, "rating": 4.8, "rating_count": 175},
    "Warteg Sehat Organik": {"id": "MTR-WSO-22", "area": "Sudirman", "lat": -6.2160, "lng": 106.8210, "distance_km": 1.1, "delivery_radius_km": 2.5, "rating": 4.7, "rating_count": 190}
}

DISH_IMAGES = {
    "DISH-01": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    "DISH-02": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "DISH-03": "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&q=80",
    "DISH-04": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "DISH-05": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    "DISH-06": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "DISH-07": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&q=80",
    "DISH-08": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "DISH-09": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "DISH-10": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    "DISH-11": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "DISH-12": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    "DISH-13": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "DISH-14": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "DISH-15": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "DISH-16": "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&q=80",
    "DISH-17": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "DISH-18": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "DISH-19": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&q=80",
    "DISH-20": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500&q=80",
    "DISH-21": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80",
    "DISH-22": "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&q=80",
    "DISH-23": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
    "DISH-24": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80",
    "DISH-25": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=500&q=80",
    "DISH-26": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&q=80",
    "DISH-27": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80"
}

def derive_category(dish_name: str, kcal: int, protein: float, price: int) -> str:
    name_lower = dish_name.lower()
    if "lambung" in name_lower or "sup" in name_lower or "tim" in name_lower or "bubur" in name_lower or "pecel" in name_lower:
        return "lambung"
    if "santan" in name_lower or "rawon" in name_lower or "asem" in name_lower or "garang" in name_lower:
        return "bebas-santan"
    if kcal < 300:
        return "rendah-kalori"
    if protein >= 28:
        return "protein"
    if price <= 20000:
        return "hemat"
    return "protein"

def seed_database():
    create_all_tables()
    db: Session = SessionLocal()
    try:
        logger.info("Seeding demo user personas...")
        # 1. Seed Dian / Lily
        upsert_user(
            db=db,
            user_id="CORP_LILY_SCBD",
            name="Lily (Corporate Professional)",
            email="lily.scbd@shopeefood.co.id",
            role=UserRole.CONSUMER,
            is_demo=True,
            consent_health_data=True,
            streak_days=5
        )
        upsert_health_profile(
            db=db,
            user_id="CORP_LILY_SCBD",
            data={
                "age": 28,
                "gender": "perempuan",
                "height_cm": 160.0,
                "weight_kg": 52.0,
                "occupation": "Corporate Desk Worker",
                "activity_level": "SEDENTARY",
                "goal": "maintain",
                "allergies": ["kacang"],
                "meal_budget_idr": 35000,
                "has_medical_condition": False
            }
        )

        # 2. Seed Budi
        upsert_user(
            db=db,
            user_id="PREV_BUDI_KUNINGAN",
            name="Budi (Preventive Health Starter)",
            email="budi.kuningan@shopeefood.co.id",
            role=UserRole.CONSUMER,
            is_demo=True,
            consent_health_data=True,
            streak_days=4
        )
        upsert_health_profile(
            db=db,
            user_id="PREV_BUDI_KUNINGAN",
            data={
                "age": 36,
                "gender": "laki-laki",
                "height_cm": 172.0,
                "weight_kg": 78.0,
                "occupation": "General Affairs Manager",
                "activity_level": "LIGHT",
                "goal": "turun-berat-badan",
                "allergies": [],
                "meal_budget_idr": 40000,
                "has_medical_condition": True
            }
        )

        # 3. Seed Rian
        upsert_user(
            db=db,
            user_id="FIT_RIAN_PALMERAH",
            name="Rian (Budget Fitness Enthusiast)",
            email="rian.fitness@shopeefood.co.id",
            role=UserRole.CONSUMER,
            is_demo=True,
            consent_health_data=True,
            streak_days=7
        )
        upsert_health_profile(
            db=db,
            user_id="FIT_RIAN_PALMERAH",
            data={
                "age": 23,
                "gender": "laki-laki",
                "height_cm": 175.0,
                "weight_kg": 68.0,
                "occupation": "Junior Software Engineer",
                "activity_level": "ACTIVE",
                "goal": "maintain",
                "allergies": [],
                "meal_budget_idr": 30000,
                "has_medical_condition": False
            }
        )

        # 4. Seed Catalog from seed_catalog.json
        catalog_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "seed_catalog.json")
        if os.path.exists(catalog_path):
            logger.info(f"Loading seed catalog from {catalog_path}...")
            with open(catalog_path, "r", encoding="utf-8") as f:
                items = json.load(f)

            merchant_id_map = {}

            for it in items:
                raw_m_name = it.get("merchant_name", "Warteg Berkah Mandiri")
                clean_m_name = raw_m_name.split(" - ")[0].strip()

                meta = MERCHANT_METADATA.get(clean_m_name, {
                    "id": f"MTR-{abs(hash(clean_m_name)) % 1000:03d}",
                    "area": raw_m_name.split(" - ")[-1].strip() if " - " in raw_m_name else "Kuningan",
                    "distance_km": 1.0,
                    "delivery_radius_km": 2.5,
                    "rating": 4.8,
                    "rating_count": 300
                })

                m_id = meta["id"]
                if m_id not in merchant_id_map:
                    upsert_merchant(db, {
                        "id": m_id,
                        "name": raw_m_name,
                        "area": meta.get("area", "Kuningan"),
                        "lat": meta.get("lat"),
                        "lng": meta.get("lng"),
                        "distance_km": meta.get("distance_km", 1.0),
                        "delivery_radius_km": meta.get("delivery_radius_km", 2.5),
                        "rating": meta.get("rating", 4.8),
                        "rating_count": meta.get("rating_count", 300),
                        "is_verified_hygiene": True,
                        "commission_rate": 0.05,
                        "is_open": True
                    })
                    merchant_id_map[m_id] = True

                item_id = it.get("item_id", f"DISH-{abs(hash(it['item_name'])) % 1000:03d}")
                macros = it.get("estimated_macros", {})
                kcal = macros.get("kcal", 350)
                protein = macros.get("protein_g", 25.0)
                price = it.get("discounted_price", 25000)

                cat = derive_category(it["item_name"], kcal, protein, price)
                img = DISH_IMAGES.get(item_id, "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80")

                upsert_menu_item(db, {
                    "id": item_id,
                    "merchant_id": m_id,
                    "name": it["item_name"],
                    "description": it.get("default_cooking_notes", "Porsi standar warteg sehat"),
                    "meal_slot": "ANY",
                    "category": cat,
                    "base_price_idr": it.get("base_price", price),
                    "discounted_price_idr": price,
                    "has_promo": it.get("has_promo", False),
                    "rating": 4.8,
                    "sold_count": "1.8rb+",
                    "kcal": kcal,
                    "protein_g": protein,
                    "carbs_g": macros.get("carbs_g", 30.0),
                    "fat_g": macros.get("fat_g", 8.0),
                    "sodium_mg": macros.get("sodium_mg", 500),
                    "image_url": img,
                    "allergens": it.get("allergens", []),
                    "hygiene_badges": ["Minyak Baru Terverifikasi", "Dapur Higienis"],
                    "default_notes": it.get("default_cooking_notes"),
                    "nutrition_source": "TKPI" if "ayam" in it["item_name"].lower() else "ESTIMATE",
                    "is_available": True,
                    "tags": it.get("healthy_tags", ["MINYAK_BARU"])
                })

            logger.info(f"Seeded {len(items)} catalog dishes and {len(merchant_id_map)} merchants.")

            # 5. Seed Merchant Demand Insight for Kuningan
            wbm_id = "MTR-WBM-01"
            insight_existing = db.query(MerchantDemandInsight).filter(MerchantDemandInsight.merchant_id == wbm_id).first()
            if not insight_existing:
                insight = MerchantDemandInsight(
                    merchant_id=wbm_id,
                    district="Kuningan / SCBD",
                    radius_km=2.0,
                    unmet_demand_count=65,
                    opportunity_detected="HIGH_PROTEIN_LOW_SUGAR_GRILLED_CHICKEN",
                    actionable_suggestion="65 pengguna di sekitar radius 2 km mencari menu tinggi protein rendah gula minggu ini. Tambahkan paket Ayam Bakar Bumbu Kuning Non-Kecap untuk estimasi peningkatan order +20%.",
                    suggested_healthy_tags=["MINYAK_BARU", "TANPA_SANTAN", "TINGGI_PROTEIN"],
                    estimated_order_boost_pct=20
                )
                db.add(insight)
                db.commit()
                logger.info("Seeded Merchant Demand Insight.")

        logger.info("Database seeding completed successfully.")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
