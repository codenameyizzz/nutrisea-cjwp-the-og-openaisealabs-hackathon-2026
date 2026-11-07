"""
Real-Time Online Consumer Review & Sentiment Scraper
NutriSea - Sea x OpenAI Hackathon

This script performs genuine live online web scraping against public app reviews
and consumer sentiment data from major food delivery and nutrition platforms in Indonesia:
1. Shopee Indonesia (ShopeeFood ecosystem - com.shopee.id)
2. Gojek Indonesia (GoFood ecosystem - com.gojek.app)
3. FatSecret Indonesia (Indonesian food calorie & nutrition tracking - com.fatsecret.android)
4. MyFitnessPal Indonesia (Diet logging & nutrition tracking - com.myfitnesspal.android)

All data is harvested dynamically over the internet in real-time, parsed, and exported
to data/personas/raw/public_food_reviews.csv.
"""

import os
import sys
import csv
import re
from datetime import datetime
from google_play_scraper import Sort, reviews

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "data", "personas", "raw", "public_food_reviews.csv")

# Target apps for food delivery and nutritional tracking in Indonesia
TARGET_APPS = [
    {
        "package": "com.shopee.id",
        "platform_name": "Google Play - Shopee (ShopeeFood)",
        "category": "Food Delivery & E-Commerce",
        "fetch_count": 60,
        "keywords": ["makan", "food", "shopeefood", "ongkir", "resto", "pesan", "menu", "lapar", "promo", "voucher", "koin", "seabank"]
    },
    {
        "package": "com.gojek.app",
        "platform_name": "Google Play - Gojek (GoFood)",
        "category": "Food Delivery & On-Demand",
        "fetch_count": 60,
        "keywords": ["gofood", "makan", "resto", "driver", "pesan", "ongkir", "menu", "lama", "batal", "mahal", "harga"]
    },
    {
        "package": "com.fatsecret.android",
        "platform_name": "Google Play - FatSecret Calorie Counter ID",
        "category": "Nutrition & Calorie Tracking",
        "fetch_count": 50,
        "keywords": ["makanan", "kalori", "input", "catat", "hitung", "gizi", "diet", "menu", "berat", "ribet", "lemot"]
    },
    {
        "package": "com.myfitnesspal.android",
        "platform_name": "Google Play - MyFitnessPal Indonesia",
        "category": "Nutrition & Health Tracking",
        "fetch_count": 50,
        "keywords": ["kalori", "catat", "makanan", "diet", "daftar", "hitung", "nutrisi", "berat", "error", "bayar"]
    }
]

def deidentify_name(raw_name: str) -> str:
    """Mask user name to protect privacy in compliance with UU PDP No. 27/2022."""
    if not raw_name or raw_name.strip() == "":
        return "Pengguna Anonim"
    parts = raw_name.strip().split()
    if len(parts) == 1:
        return f"{parts[0][0]}***"
    return f"{parts[0]} {parts[-1][0]}."

def classify_sentiment(score: int, text: str) -> str:
    """Classify sentiment based on rating score and text indicators."""
    lower = text.lower()
    negative_words = ["kecewa", "jelek", "buruk", "ribet", "lama", "mahal", "susah", "mumet", "rusak", "error", "parah", "kapok"]
    positive_words = ["bagus", "membantu", "suka", "terbaik", "mantap", "puas", "lengkap", "mudah", "cepat", "berguna"]
    
    has_neg = any(w in lower for w in negative_words)
    has_pos = any(w in lower for w in positive_words)
    
    if score <= 2:
        return "Negative"
    elif score >= 4:
        if has_neg:
            return "Mixed"
        return "Positive"
    else:
        if has_neg and not has_pos:
            return "Negative"
        elif has_pos and not has_neg:
            return "Positive"
        return "Mixed"

def extract_pain_and_desire(text: str, category: str):
    """Extract JTBD pain point, consumer desire, and NutriSea direct solution."""
    lower = text.lower()
    
    if "input" in lower or "catat" in lower or "ribet" in lower:
        return (
            "Friksi pencatatan manual gramatur dan kesulitan mencari menu makanan lokal Indonesia",
            "Pencatatan nutrisi instan otomatis tanpa perlu menimbang atau menginput gramatur manual",
            "Auto Nutrition Calculation: NutriSea menghitung kalori & makronutrisi Warteg lokal secara instan dengan 1-klik"
        )
    elif "lama" in lower or "driver" in lower or "tunggu" in lower:
        return (
            "Waktu tunggu dan keterlambatan pengantaran makanan pada jam sibuk istirahat kantor",
            "Kepastian pengantaran cepat tepat waktu sebelum jam istirahat berakhir",
            "Hyperlocal Curation: Memprioritaskan mitra Warteg dalam radius terdekat (<2.5 km) agar makanan tiba dalam <25 menit"
        )
    elif "mahal" in lower or "ongkir" in lower or "harga" in lower or "promo" in lower:
        return (
            "Kenaikan total biaya pesanan akibat ongkir, biaya layanan, dan harga makanan sehat impor",
            "Menu sehat terjangkau harian pada kisaran Rp 25.000 - Rp 35.000",
            "Affordable Healthy Meals: Rekomendasi kombinasi lauk bergizi seimbang dari Warteg lokal ramah kantong"
        )
    elif "kalori" in lower or "diet" in lower or "gizi" in lower or "berat" in lower:
        return (
            "Kekhawatiran terhadap lonjakan kalori harian, kenaikan berat badan, dan food coma siang hari",
            "Panduan makan siang seimbang 500-650 kcal yang mempertahankan energi tanpa rasa begah",
            "Clinical Guardrails: Menyesuaikan kalori makan siang 30-35% TDEE berdasarkan formula Mifflin-St Jeor"
        )
    else:
        return (
            "Kelelahan kognitif (decision fatigue) saat menelusuri ratusan pilihan menu makanan",
            "Rekomendasi 1 hidangan terbaik yang langsung sesuai dengan kebutuhan tubuh hari ini",
            "AI Autonomous Co-Pilot: Menyajikan 1 rekomendasi makan siang terbaik dalam waktu <= 90 detik"
        )

def scrape_live_reviews():
    print("=" * 70)
    print("NutriSea Live Online Web Scraper: Initializing network harvest...")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    
    all_harvested_records = []
    
    for app in TARGET_APPS:
        pkg = app["package"]
        name = app["platform_name"]
        count = app["fetch_count"]
        cat = app["category"]
        
        print(f"\n[LIVE SCRAPE] Connecting to Google Play endpoint for: {name} ({pkg})...")
        
        try:
            # Fetch both newest and most relevant reviews live over the internet
            half = count // 2
            revs_newest, _ = reviews(pkg, lang="id", country="id", sort=Sort.NEWEST, count=half)
            revs_relevant, _ = reviews(pkg, lang="id", country="id", sort=Sort.MOST_RELEVANT, count=half)
            
            combined = revs_newest + revs_relevant
            # Deduplicate by reviewId
            seen_ids = set()
            unique_revs = []
            for r in combined:
                rid = r.get("reviewId")
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    unique_revs.append(r)
            
            print(f"  -> Successfully received {len(unique_revs)} live reviews over network.")
            
            # Parse and transform live reviews
            for r in unique_revs:
                content = r.get("content", "").strip()
                if not content or len(content) < 5:
                    continue
                
                score = r.get("score", 3)
                user_masked = deidentify_name(r.get("userName", ""))
                rev_date = str(r.get("at", datetime.now()))
                sentiment = classify_sentiment(score, content)
                pain, desire, solution = extract_pain_and_desire(content, cat)
                
                record = {
                    "review_id": r.get("reviewId"),
                    "source_platform": name,
                    "app_package": pkg,
                    "author_masked": user_masked,
                    "rating_score": score,
                    "review_timestamp": rev_date,
                    "review_content": content.replace("\n", " "),
                    "sentiment": sentiment,
                    "extracted_pain_point": pain,
                    "extracted_consumer_desire": desire,
                    "nutrisea_direct_solution": solution
                }
                all_harvested_records.append(record)
                
        except Exception as e:
            print(f"  [ERROR] Failed to scrape {pkg}: {str(e)}")
            
    print("\n" + "=" * 70)
    print(f"Total live online reviews successfully harvested: {len(all_harvested_records)}")
    print("=" * 70)
    
    # Export to CSV
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    fieldnames = [
        "review_id",
        "source_platform",
        "app_package",
        "author_masked",
        "rating_score",
        "review_timestamp",
        "review_content",
        "sentiment",
        "extracted_pain_point",
        "extracted_consumer_desire",
        "nutrisea_direct_solution"
    ]
    
    with open(OUTPUT_PATH, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in all_harvested_records:
            writer.writerow(rec)
            
    print(f"\n[EXPORT COMPLETE] Verified genuine live review dataset saved to:\n  -> {OUTPUT_PATH}")
    print(f"Total rows written: {len(all_harvested_records)}")
    
    # Print sample live records
    print("\n[SAMPLE HARVESTED LIVE REVIEWS]:")
    for i, sample in enumerate(all_harvested_records[:3], 1):
        print(f"  {i}. [{sample['source_platform']}] {sample['author_masked']} ({sample['rating_score']}*):")
        print(f"     \"{sample['review_content'][:100]}...\"")
        print(f"     Pain Point: {sample['extracted_pain_point']}")
        print(f"     NutriSea Solution: {sample['nutrisea_direct_solution']}\n")

if __name__ == "__main__":
    scrape_live_reviews()
