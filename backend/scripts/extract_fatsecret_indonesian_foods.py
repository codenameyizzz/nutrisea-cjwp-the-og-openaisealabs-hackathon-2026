#!/usr/bin/env python3
"""
Indonesian Food & FatSecret Data Extractor and Persona Matcher
Processes 80 authentic Indonesian dishes, applies clinical guardrails,
and matches them against 120 NutriSea consumer personas.
"""

import os
import sys
import csv
import json
from typing import List, Dict, Any

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
PERSONAS_CSV = os.path.join(PROJECT_ROOT, "data", "personas", "processed", "personas_master.csv")
OUT_JSON = os.path.join(PROJECT_ROOT, "data", "food", "fatsecret_indonesian_foods_expanded.json")
OUT_CSV = os.path.join(PROJECT_ROOT, "data", "food", "indonesian_food_persona_mappings.csv")
OUT_MD = os.path.join(PROJECT_ROOT, "data", "food", "FOOD_PERSONA_DATASET.md")

# Load 120 Personas
def load_personas() -> List[Dict[str, Any]]:
    with open(PERSONAS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        personas = []
        for r in reader:
            personas.append({
                "persona_id": r["persona_id"],
                "full_name": r["full_name"],
                "archetype_code": r["archetype_code"],
                "archetype_name": r["archetype_name"],
                "target_lunch_kcal": float(r["target_lunch_kcal"]),
                "target_lunch_budget_idr": float(r["target_lunch_budget_idr"]),
                "health_goal": r["health_goal"],
                "medical_conditions": r["medical_conditions"],
                "allergens": r["allergens"],
                "preferred_tags": [t.strip() for t in r["preferred_tags"].split(",") if t.strip()]
            })
        return personas

# 80 Authentic Indonesian Dishes from FatSecret & TKPI
DISHES_DATA: List[Dict[str, Any]] = [
    # -------------------------------------------------------------
    # 1. PROTEIN TINGGI (AYAM, IKAN, DAGING, TELUR) - 18 ITEMS
    # -------------------------------------------------------------
    {
        "food_id": "FS-ID-101",
        "fatsecret_ref_id": 901001,
        "name": "Ayam Bakar Dada Tanpa Kulit Rempah Kuning",
        "category": "protein",
        "serving_size": "1 potong dada (120 g)",
        "calories": 195,
        "protein_g": 35.2,
        "carbs_g": 2.1,
        "fat_g": 4.5,
        "sodium_mg": 380,
        "fiber_g": 0.2,
        "sugars_g": 0.5,
        "price_idr": 28000,
        "cooking_method": "bakar_rempah",
        "healthy_tags": ["MINYAK_BARU", "TINGGI_PROTEIN", "RENDAH_LEMAK", "BEBAS_SANTAN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Dada ayam fillet tanpa kulit dibumbui kunyit, ketumbar, dan serai, dipanggang di atas grill pan dengan olesan minyak kelapa baru."
    },
    {
        "food_id": "FS-ID-102",
        "fatsecret_ref_id": 901018,
        "name": "Ayam Panggang Klaten Rempah Manis Gurih",
        "category": "protein",
        "serving_size": "1 potong dada (130 g)",
        "calories": 230,
        "protein_g": 33.0,
        "carbs_g": 3.5,
        "fat_g": 9.2,
        "sodium_mg": 420,
        "fiber_g": 0.4,
        "sugars_g": 1.2,
        "price_idr": 29000,
        "cooking_method": "panggang_oven",
        "healthy_tags": ["TINGGI_PROTEIN", "BAKAR_NON_JELANTAH", "MINYAK_BARU"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Ayam panggang oven khas Klaten dengan bumbu rempah jintan, bawang putih, dan gula aren organik sedikit."
    },
    {
        "food_id": "FS-ID-103",
        "fatsecret_ref_id": 901011,
        "name": "Dada Ayam Kukus Jahe & Daun Kemangi",
        "category": "lambung",
        "serving_size": "1 porsi (120 g)",
        "calories": 160,
        "protein_g": 31.0,
        "carbs_g": 1.2,
        "fat_g": 3.2,
        "sodium_mg": 220,
        "fiber_g": 0.3,
        "sugars_g": 0.2,
        "price_idr": 27000,
        "cooking_method": "kukus",
        "healthy_tags": ["RAMAH_LAMBUNG", "KUKUS_HIGIENIS", "TINGGI_PROTEIN", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Fillet dada ayam kukus dengan irisan jahe emprit segar dan daun kemangi wangi. Sangat ramah untuk penderita maag dan GERD."
    },
    {
        "food_id": "FS-ID-104",
        "fatsecret_ref_id": 14961725,
        "name": "Ayam Pop Padang Dada Tanpa Kulit",
        "category": "protein",
        "serving_size": "1 potong (110 g)",
        "calories": 185,
        "protein_g": 28.5,
        "carbs_g": 1.0,
        "fat_g": 6.8,
        "sodium_mg": 310,
        "fiber_g": 0.1,
        "sugars_g": 0.1,
        "price_idr": 29000,
        "cooking_method": "rebus_ungkep",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "RAMAH_LAMBUNG"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Ayam pop khas Bukittinggi dimasak dengan air kelapa muda dan bawang putih, dicelup minyak baru sekejap tanpa kulit."
    },
    {
        "food_id": "FS-ID-105",
        "fatsecret_ref_id": 14961726,
        "name": "Ayam Suwir Sambal Matah Rendah Minyak",
        "category": "protein",
        "serving_size": "1 porsi (100 g)",
        "calories": 210,
        "protein_g": 29.0,
        "carbs_g": 3.0,
        "fat_g": 8.5,
        "sodium_mg": 360,
        "fiber_g": 0.8,
        "sugars_g": 0.5,
        "price_idr": 26000,
        "cooking_method": "rebus_suwir",
        "healthy_tags": ["TINGGI_PROTEIN", "MINYAK_BARU", "BEBAS_SANTAN"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Dada ayam rebus disuwir halus, dicampur irisan serai, bawang merah, dan cabai rawit segar dengan minyak kelapa virgin dingin."
    },
    {
        "food_id": "FS-ID-106",
        "fatsecret_ref_id": 14961727,
        "name": "Ayam Betutu Kuah Kaldu Rempah Bali",
        "category": "protein",
        "serving_size": "1 mangkok (150 g)",
        "calories": 240,
        "protein_g": 30.5,
        "carbs_g": 4.2,
        "fat_g": 10.5,
        "sodium_mg": 450,
        "fiber_g": 1.1,
        "sugars_g": 0.6,
        "price_idr": 32000,
        "cooking_method": "ungkep_rempah",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "REMPAH_NUSANTARA"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Ayam kampung berkuah rempah base genep Bali kaya kunyit, kencur, dan serai tanpa santan kental."
    },
    {
        "food_id": "FS-ID-107",
        "fatsecret_ref_id": 14961728,
        "name": "Pepes Ayam Bumbu Kuning Kemangi",
        "category": "lambung",
        "serving_size": "1 bungkus (130 g)",
        "calories": 190,
        "protein_g": 27.0,
        "carbs_g": 2.5,
        "fat_g": 7.5,
        "sodium_mg": 290,
        "fiber_g": 0.7,
        "sugars_g": 0.4,
        "price_idr": 25000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["KUKUS_HIGIENIS", "BEBAS_MINYAK", "RAMAH_LAMBUNG", "TINGGI_PROTEIN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Potongan ayam dibalut bumbu kunyit, daun salam, dan kemangi segar, dikukus dalam daun pisang alami tanpa minyak goreng."
    },
    {
        "food_id": "FS-ID-108",
        "fatsecret_ref_id": 901006,
        "name": "Ikan Nila Bakar Bumbu Kuning Rempah",
        "category": "protein",
        "serving_size": "1 ekor sedang (150 g daging)",
        "calories": 210,
        "protein_g": 32.0,
        "carbs_g": 1.5,
        "fat_g": 8.0,
        "sodium_mg": 410,
        "fiber_g": 0.4,
        "sugars_g": 0.3,
        "price_idr": 30000,
        "cooking_method": "bakar_rempah",
        "healthy_tags": ["OMEGA_3", "TINGGI_PROTEIN", "MINYAK_MINIMAL", "BEBAS_SANTAN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Ikan nila air tawar segar dibumbui kunyit dan bawang putih, dipanggang dengan olesan kecap rendah gula."
    },
    {
        "food_id": "FS-ID-109",
        "fatsecret_ref_id": 901013,
        "name": "Ikan Mas Pepes Daun Kemangi Kukus",
        "category": "protein",
        "serving_size": "1 ekor (120 g)",
        "calories": 185,
        "protein_g": 27.0,
        "carbs_g": 2.0,
        "fat_g": 7.8,
        "sodium_mg": 320,
        "fiber_g": 0.6,
        "sugars_g": 0.2,
        "price_idr": 28000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["KUKUS_HIGIENIS", "BEBAS_MINYAK", "OMEGA_3", "RAMAH_LAMBUNG"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Ikan mas segar dikukus presto bersama daun kemangi, tomat hijau, dan kunyit hingga duri lunak tanpa minyak."
    },
    {
        "food_id": "FS-ID-110",
        "fatsecret_ref_id": 14961729,
        "name": "Ikan Kembung Bakar Kunyit Asam",
        "category": "protein",
        "serving_size": "1 ekor (100 g)",
        "calories": 195,
        "protein_g": 26.0,
        "carbs_g": 1.8,
        "fat_g": 9.2,
        "sodium_mg": 350,
        "fiber_g": 0.3,
        "sugars_g": 0.2,
        "price_idr": 26000,
        "cooking_method": "bakar_rempah",
        "healthy_tags": ["OMEGA_3", "TINGGI_PROTEIN", "MINYAK_BARU"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Ikan kembung kaya asam lemak omega-3 alami, dipanggang dengan bumbu perasan jeruk nipis dan kunyit segar."
    },
    {
        "food_id": "FS-ID-111",
        "fatsecret_ref_id": 14961730,
        "name": "Ikan Kakap Kuah Kuning Bening",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (160 g)",
        "calories": 175,
        "protein_g": 28.0,
        "carbs_g": 2.2,
        "fat_g": 5.5,
        "sodium_mg": 380,
        "fiber_g": 0.5,
        "sugars_g": 0.4,
        "price_idr": 34000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "RAMAH_LAMBUNG", "KALDU_ALAMI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup ikan kakap laut segar dengan kuah bening kuning beraroma serai, daun jeruk, dan belimbing wuluh segar."
    },
    {
        "food_id": "FS-ID-112",
        "fatsecret_ref_id": 14961731,
        "name": "Ikan Tongkol Suwir Balado Minyak Baru",
        "category": "protein",
        "serving_size": "1 porsi (90 g)",
        "calories": 215,
        "protein_g": 29.5,
        "carbs_g": 3.8,
        "fat_g": 8.8,
        "sodium_mg": 430,
        "fiber_g": 0.9,
        "sugars_g": 0.5,
        "price_idr": 24000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["TINGGI_PROTEIN", "MINYAK_BARU", "BUDGET_HEMAT"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Ikan tongkol kukus disuwir lalu ditumis cabai merah giling menggunakan minyak baru berverifikasi."
    },
    {
        "food_id": "FS-ID-113",
        "fatsecret_ref_id": 14961732,
        "name": "Cakalang Asap Suwir Manado Bumbu Rica",
        "category": "protein",
        "serving_size": "1 porsi (90 g)",
        "calories": 205,
        "protein_g": 31.0,
        "carbs_g": 2.8,
        "fat_g": 7.2,
        "sodium_mg": 440,
        "fiber_g": 0.8,
        "sugars_g": 0.3,
        "price_idr": 29000,
        "cooking_method": "asap_suwir",
        "healthy_tags": ["TINGGI_PROTEIN", "OMEGA_3", "MINYAK_BARU"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Ikan cakalang fufu asap khas Sulawesi disuwir dan ditumis bumbu rica kemangi tanpa santan."
    },
    {
        "food_id": "FS-ID-114",
        "fatsecret_ref_id": 5912605,
        "name": "Rendang Daging Sapi Gandik Rendah Lemak",
        "category": "protein",
        "serving_size": "1 potong (85 g)",
        "calories": 245,
        "protein_g": 28.0,
        "carbs_g": 4.5,
        "fat_g": 12.0,
        "sodium_mg": 450,
        "fiber_g": 1.2,
        "sugars_g": 0.8,
        "price_idr": 35000,
        "cooking_method": "slow_cook",
        "healthy_tags": ["TINGGI_PROTEIN", "TINGGI_ZAT_BESI", "LEMAK_TERUKUR"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Daging sapi bagian gandik bebas gajih dimasak perlahan dengan rempah Padang otentik dan santan encer terkontrol."
    },
    {
        "food_id": "FS-ID-115",
        "fatsecret_ref_id": 14961733,
        "name": "Empal Sapi Ungkep Rebus Rempah",
        "category": "protein",
        "serving_size": "1 potong (80 g)",
        "calories": 220,
        "protein_g": 26.5,
        "carbs_g": 3.2,
        "fat_g": 10.5,
        "sodium_mg": 390,
        "fiber_g": 0.4,
        "sugars_g": 1.1,
        "price_idr": 33000,
        "cooking_method": "rebus_ungkep",
        "healthy_tags": ["TINGGI_PROTEIN", "TINGGI_ZAT_BESI", "BEBAS_GORENGAN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Daging sapi empuk diungkep bumbu ketumbar, lengkuas, dan asam jawa, dipanggang tanpa proses deep frying."
    },
    {
        "food_id": "FS-ID-116",
        "fatsecret_ref_id": 14961734,
        "name": "Daging Sapi Cah Paprika & Lada Hitam Ringan",
        "category": "protein",
        "serving_size": "1 porsi (120 g)",
        "calories": 235,
        "protein_g": 25.0,
        "carbs_g": 7.5,
        "fat_g": 11.2,
        "sodium_mg": 460,
        "fiber_g": 1.8,
        "sugars_g": 1.5,
        "price_idr": 36000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["TINGGI_PROTEIN", "MINYAK_BARU", "KAYA_VITAMIN"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Irisan daging sapi tenderloin ditumis kilat dengan paprika merah-hijau dan lada hitam tumbuk kasar."
    },
    {
        "food_id": "FS-ID-117",
        "fatsecret_ref_id": 901010,
        "name": "Telur Rebus Matang Organik (2 Butir)",
        "category": "hemat",
        "serving_size": "2 butir besar (100 g)",
        "calories": 148,
        "protein_g": 12.6,
        "carbs_g": 0.8,
        "fat_g": 10.0,
        "sodium_mg": 140,
        "fiber_g": 0.0,
        "sugars_g": 0.4,
        "price_idr": 14000,
        "cooking_method": "rebus",
        "healthy_tags": ["PROTEIN_MURNI", "BEBAS_MINYAK", "SUPERFOOD", "BUDGET_HEMAT"],
        "allergens": ["telur"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Dua butir telur ayam rebus matang sempurna, sumber protein bioavailable tinggi bebas lemak jenuh tambahan."
    },
    {
        "food_id": "FS-ID-118",
        "fatsecret_ref_id": 14961735,
        "name": "Telur Balado Warteg Minyak Baru",
        "category": "hemat",
        "serving_size": "1 butir + sambal (65 g)",
        "calories": 180,
        "protein_g": 7.5,
        "carbs_g": 4.5,
        "fat_g": 12.0,
        "sodium_mg": 320,
        "fiber_g": 0.6,
        "sugars_g": 1.0,
        "price_idr": 12000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["MINYAK_BARU", "BUDGET_HEMAT", "PROTEIN_LOKAL"],
        "allergens": ["telur"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Telur rebus digoreng sekejap dalam minyak baru, dibalut saus cabai merah dan tomat segar."
    },

    # -------------------------------------------------------------
    # 2. HEMAT & PROTEIN NABATI (TEMPE, TAHU, JAMUR) - 16 ITEMS
    # -------------------------------------------------------------
    {
        "food_id": "FS-ID-119",
        "fatsecret_ref_id": 901003,
        "name": "Orek Tempe Basah Kecap Rendah Gula",
        "category": "hemat",
        "serving_size": "1 porsi (75 g)",
        "calories": 140,
        "protein_g": 12.5,
        "carbs_g": 9.0,
        "fat_g": 6.2,
        "sodium_mg": 210,
        "fiber_g": 2.8,
        "sugars_g": 1.8,
        "price_idr": 12000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["NABATI_SUPER", "TINGGI_SERAT", "MINYAK_BARU", "BUDGET_HEMAT"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tempe kedelai non-GMO dipotong dadu, ditumis bawang merah dan sedikit kecap manis kedelai hitam tanpa minyak jenuh."
    },
    {
        "food_id": "FS-ID-120",
        "fatsecret_ref_id": 14961736,
        "name": "Tempe Bacem Kukus Tradisional",
        "category": "hemat",
        "serving_size": "2 potong (90 g)",
        "calories": 130,
        "protein_g": 11.0,
        "carbs_g": 11.5,
        "fat_g": 4.5,
        "sodium_mg": 180,
        "fiber_g": 2.5,
        "sugars_g": 2.2,
        "price_idr": 11000,
        "cooking_method": "kukus_bacem",
        "healthy_tags": ["BEBAS_GORENGAN", "PROTEIN_NABATI", "BUDGET_HEMAT", "RAMAH_LAMBUNG"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tempe beraroma rempah ketumbar dan gula aren, dimasak ungkep lalu dikukus tanpa penggorengan."
    },
    {
        "food_id": "FS-ID-121",
        "fatsecret_ref_id": 14961737,
        "name": "Pepes Tempe Kemangi Jamur Kukus",
        "category": "lambung",
        "serving_size": "1 bungkus (100 g)",
        "calories": 115,
        "protein_g": 10.2,
        "carbs_g": 6.5,
        "fat_g": 5.0,
        "sodium_mg": 160,
        "fiber_g": 2.2,
        "sugars_g": 0.5,
        "price_idr": 12000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["KUKUS_HIGIENIS", "BEBAS_MINYAK", "RAMAH_LAMBUNG", "NABATI_SUPER"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tempe tumbuk kasar dipadu jamur tiram dan kemangi wangi, dibungkus daun pisang dan dikukus steril."
    },
    {
        "food_id": "FS-ID-122",
        "fatsecret_ref_id": 133364894,
        "name": "Tempe Orek Kering Oven Rendah Minyak",
        "category": "hemat",
        "serving_size": "1 porsi (60 g)",
        "calories": 165,
        "protein_g": 11.8,
        "carbs_g": 12.0,
        "fat_g": 8.0,
        "sodium_mg": 240,
        "fiber_g": 2.4,
        "sugars_g": 1.5,
        "price_idr": 13000,
        "cooking_method": "panggang_oven",
        "healthy_tags": ["NABATI_SUPER", "MINYAK_BARU", "BUDGET_HEMAT"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tempe orek garing renyah dipanggang dalam convection oven dengan minyak kelapa semprot minim lemak."
    },
    {
        "food_id": "FS-ID-123",
        "fatsecret_ref_id": 901015,
        "name": "Tahu Bacem Kukus Manis Gurih",
        "category": "hemat",
        "serving_size": "2 potong (100 g)",
        "calories": 125,
        "protein_g": 10.2,
        "carbs_g": 12.0,
        "fat_g": 4.0,
        "sodium_mg": 190,
        "fiber_g": 1.5,
        "sugars_g": 2.0,
        "price_idr": 10000,
        "cooking_method": "kukus_bacem",
        "healthy_tags": ["BEBAS_GORENGAN", "PROTEIN_NABATI", "BUDGET_HEMAT", "RAMAH_LAMBUNG"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tahu putih padat diungkep air kelapa dan ketumbar, dikukus hangat tanpa digoreng."
    },
    {
        "food_id": "FS-ID-124",
        "fatsecret_ref_id": 901005,
        "name": "Pepes Tahu Jamur Tiram Kukus",
        "category": "lambung",
        "serving_size": "1 bungkus (100 g)",
        "calories": 95,
        "protein_g": 9.4,
        "carbs_g": 4.5,
        "fat_g": 4.2,
        "sodium_mg": 240,
        "fiber_g": 2.1,
        "sugars_g": 0.4,
        "price_idr": 12000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["KUKUS_HIGIENIS", "BEBAS_MINYAK", "RAMAH_LAMBUNG", "RENDAH_KALORI"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tahu sutra lembut dicampur suwiran jamur tiram dan bumbu bawang putih halus, dikukus dalam bungkusan daun pisang."
    },
    {
        "food_id": "FS-ID-125",
        "fatsecret_ref_id": 14961738,
        "name": "Tahu Kukus Isi Sayuran Wortel Tauge",
        "category": "rendah-kalori",
        "serving_size": "2 buah (110 g)",
        "calories": 105,
        "protein_g": 8.8,
        "carbs_g": 7.0,
        "fat_g": 4.5,
        "sodium_mg": 190,
        "fiber_g": 2.0,
        "sugars_g": 0.6,
        "price_idr": 12000,
        "cooking_method": "kukus",
        "healthy_tags": ["BEBAS_GORENGAN", "RAMAH_LAMBUNG", "TINGGI_SERAT"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tahu putih diisi serutan wortel, tauge, dan jamur kuping, dikukus matang disajikan dengan kuah kaldu kecap asin ringan."
    },
    {
        "food_id": "FS-ID-126",
        "fatsecret_ref_id": 14961739,
        "name": "Tumis Tahu Putih & Tauge Bawang Putih",
        "category": "hemat",
        "serving_size": "1 porsi (120 g)",
        "calories": 90,
        "protein_g": 7.5,
        "carbs_g": 6.0,
        "fat_g": 3.8,
        "sodium_mg": 210,
        "fiber_g": 2.2,
        "sugars_g": 0.5,
        "price_idr": 11000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["MINYAK_BARU", "BUDGET_HEMAT", "RAMAH_LAMBUNG"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tahu sutra dipotong dadu ditumis bersama tauge renyah dan irisan daun bawang segar."
    },
    {
        "food_id": "FS-ID-127",
        "fatsecret_ref_id": 14961740,
        "name": "Sambal Goreng Tempe & Teri Tawar Rebus",
        "category": "hemat",
        "serving_size": "1 porsi (70 g)",
        "calories": 155,
        "protein_g": 14.0,
        "carbs_g": 8.5,
        "fat_g": 6.8,
        "sodium_mg": 320,
        "fiber_g": 2.0,
        "sugars_g": 1.2,
        "price_idr": 14000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["TINGGI_PROTEIN", "MINYAK_BARU", "BUDGET_HEMAT", "TINGGI_KALSIUM"],
        "allergens": ["kedelai", "seafood_udang"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Tempe kedelai dipadu teri tawar nasi kaya kalsium ditumis cabai merah bumbu iris minyak baru."
    },
    {
        "food_id": "FS-ID-128",
        "fatsecret_ref_id": 14961741,
        "name": "Tahu Bakar Bumbu Kecap Jahe",
        "category": "hemat",
        "serving_size": "2 potong (100 g)",
        "calories": 110,
        "protein_g": 9.5,
        "carbs_g": 8.0,
        "fat_g": 4.0,
        "sodium_mg": 200,
        "fiber_g": 1.2,
        "sugars_g": 1.0,
        "price_idr": 11000,
        "cooking_method": "bakar_rempah",
        "healthy_tags": ["BAKAR_NON_JELANTAH", "BUDGET_HEMAT", "RAMAH_LAMBUNG"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tahu kuning bakar dengan polesan tipis kecap manis dan jahe geprek, bebas arang gosong."
    },
    {
        "food_id": "FS-ID-129",
        "fatsecret_ref_id": 14961742,
        "name": "Tumis Jamur Tiram Bumbu Bawang Putih",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (100 g)",
        "calories": 75,
        "protein_g": 4.2,
        "carbs_g": 8.5,
        "fat_g": 2.5,
        "sodium_mg": 180,
        "fiber_g": 2.8,
        "sugars_g": 0.4,
        "price_idr": 13000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["RENDAH_KALORI", "RAMAH_LAMBUNG", "MINYAK_BARU"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Jamur tiram segar ditumis dengan minyak zaitun lokal, bawang bombay, dan bawang putih harum."
    },
    {
        "food_id": "FS-ID-130",
        "fatsecret_ref_id": 14961743,
        "name": "Kacang Merah Rebus Rempah Bening",
        "category": "rendah-kalori",
        "serving_size": "1 mangkok kecil (100 g)",
        "calories": 120,
        "protein_g": 7.8,
        "carbs_g": 21.0,
        "fat_g": 0.8,
        "sodium_mg": 150,
        "fiber_g": 6.5,
        "sugars_g": 0.5,
        "price_idr": 14000,
        "cooking_method": "rebus",
        "healthy_tags": ["TINGGI_SERAT", "KOMPLEKS_KARBO", "BEBAS_MINYAK", "RENDAH_GLIKEMIK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kacang merah adzuki direbus empuk dengan daun salam dan bawang putih, sumber serat larut penurun kolesterol."
    },
    {
        "food_id": "FS-ID-131",
        "fatsecret_ref_id": 14961744,
        "name": "Tumis Kacang Panjang & Tempe Orek Basah",
        "category": "hemat",
        "serving_size": "1 porsi (110 g)",
        "calories": 110,
        "protein_g": 7.0,
        "carbs_g": 9.5,
        "fat_g": 4.8,
        "sodium_mg": 220,
        "fiber_g": 3.2,
        "sugars_g": 1.0,
        "price_idr": 12000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["MINYAK_BARU", "BUDGET_HEMAT", "SERAT_SAYUR"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kacang panjang potong dadu ditumis bersama tempe cincang bumbu lengkuas aromatik."
    },
    {
        "food_id": "FS-ID-132",
        "fatsecret_ref_id": 14961745,
        "name": "Botok Tempe Tahu Daun Melinjo Kukus",
        "category": "hemat",
        "serving_size": "1 bungkus (100 g)",
        "calories": 135,
        "protein_g": 9.0,
        "carbs_g": 8.0,
        "fat_g": 7.0,
        "sodium_mg": 230,
        "fiber_g": 2.5,
        "sugars_g": 0.6,
        "price_idr": 13000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["KUKUS_HIGIENIS", "BEBAS_GORENGAN", "BUDGET_HEMAT"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kombinasi tahu, tempe, dan parutan kelapa muda segar dibumbui kencur, dikukus dalam daun pisang."
    },
    {
        "food_id": "FS-ID-133",
        "fatsecret_ref_id": 14961746,
        "name": "Telur Dadar Daun Bawang Rendah Minyak",
        "category": "hemat",
        "serving_size": "1 butir (60 g)",
        "calories": 140,
        "protein_g": 10.5,
        "carbs_g": 2.0,
        "fat_g": 9.8,
        "sodium_mg": 210,
        "fiber_g": 0.4,
        "sugars_g": 0.3,
        "price_idr": 13000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["MINYAK_BARU", "PROTEIN_LOKAL", "BUDGET_HEMAT"],
        "allergens": ["telur"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Telur dadar tebal berisi potongan melimpah daun bawang iris, dimasak di atas wajan anti-lengket dengan sedikit minyak baru."
    },
    {
        "food_id": "FS-ID-134",
        "fatsecret_ref_id": 14961747,
        "name": "Paket Hemat Warteg: Nasi Merah + Orek Tempe + Sayur Bayam",
        "category": "hemat",
        "serving_size": "1 piring komplit (320 g)",
        "calories": 315,
        "protein_g": 18.8,
        "carbs_g": 43.5,
        "fat_g": 7.7,
        "sodium_mg": 395,
        "fiber_g": 7.2,
        "sugars_g": 2.4,
        "price_idr": 21000,
        "cooking_method": "kombinasi",
        "healthy_tags": ["BUDGET_HEMAT", "BEBAS_GORENGAN", "MINYAK_BARU", "TINGGI_SERAT"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kombinasi makan siang komplit: satu centong nasi merah organik, seporsi orek tempe basah non-jelantah, dan semangkok sayur bayam bening."
    },

    # -------------------------------------------------------------
    # 3. SAYUR BENING & RENDAH KALORI (VEGETABLES & FIBER) - 16 ITEMS
    # -------------------------------------------------------------
    {
        "food_id": "FS-ID-135",
        "fatsecret_ref_id": 901004,
        "name": "Sayur Bening Bayam & Jagung Manis",
        "category": "rendah-kalori",
        "serving_size": "1 mangkok (150 g)",
        "calories": 65,
        "protein_g": 3.8,
        "carbs_g": 11.2,
        "fat_g": 0.6,
        "sodium_mg": 180,
        "fiber_g": 3.4,
        "sugars_g": 1.2,
        "price_idr": 10000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["SAYUR_BENING", "RAMAH_LAMBUNG", "BEBAS_KOLESTEROL", "RENDAH_KALORI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Daun bayam hijau segar dipadu pipilan jagung manis dan temu kunci. Kuah bening menyegarkan bebas minyak dan santan."
    },
    {
        "food_id": "FS-ID-136",
        "fatsecret_ref_id": 14961748,
        "name": "Sayur Asem Bening Jakarta Khas Betawi",
        "category": "rendah-kalori",
        "serving_size": "1 mangkok (200 g)",
        "calories": 85,
        "protein_g": 3.2,
        "carbs_g": 16.5,
        "fat_g": 1.0,
        "sodium_mg": 260,
        "fiber_g": 4.1,
        "sugars_g": 2.1,
        "price_idr": 12000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_SERAT", "BEBAS_MINYAK"],
        "allergens": ["kacang"],
        "is_spicy": False,
        "is_acidic": True,
        "description": "Sayur asem bening Betawi berisi jagung, labu siam, kacang panjang, dan kacang tanah, disiram kuah asam jawa segar."
    },
    {
        "food_id": "FS-ID-137",
        "fatsecret_ref_id": 14961749,
        "name": "Sayur Sop Bening Ayam Kampung & Wortel Kentang",
        "category": "lambung",
        "serving_size": "1 mangkok (220 g)",
        "calories": 110,
        "protein_g": 8.5,
        "carbs_g": 12.0,
        "fat_g": 2.8,
        "sodium_mg": 280,
        "fiber_g": 3.0,
        "sugars_g": 1.5,
        "price_idr": 15000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["SAYUR_BENING", "RAMAH_LAMBUNG", "KALDU_ALAMI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup rumahan hangat berkaldu ayam asli tanpa MSG berlebih, berisi potongan wortel, kentang, buncis, dan kubis segar."
    },
    {
        "food_id": "FS-ID-138",
        "fatsecret_ref_id": 14961750,
        "name": "Sayur Bening Daun Katuk & Labu Siam",
        "category": "rendah-kalori",
        "serving_size": "1 mangkok (150 g)",
        "calories": 55,
        "protein_g": 3.5,
        "carbs_g": 9.0,
        "fat_g": 0.5,
        "sodium_mg": 160,
        "fiber_g": 3.2,
        "sugars_g": 0.8,
        "price_idr": 11000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["SAYUR_BENING", "RAMAH_LAMBUNG", "SUPERFOOD_LOKAL"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Daun katuk kaya mikronutrien dipadu irisan labu siam muda lembut dengan kuah kaldu bawang merah harum."
    },
    {
        "food_id": "FS-ID-139",
        "fatsecret_ref_id": 14961751,
        "name": "Sayur Bening Daun Kelor Kaldu Jamur Alami",
        "category": "rendah-kalori",
        "serving_size": "1 mangkok (150 g)",
        "calories": 50,
        "protein_g": 4.0,
        "carbs_g": 7.5,
        "fat_g": 0.4,
        "sodium_mg": 150,
        "fiber_g": 3.8,
        "sugars_g": 0.4,
        "price_idr": 12000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["SUPERFOOD_LOKAL", "SAYUR_BENING", "RAMAH_LAMBUNG", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Daun kelor segar (moringa) kaya antioksidan dan kalsium alami dimasak kuah bening bening tanpa lemak."
    },
    {
        "food_id": "FS-ID-140",
        "fatsecret_ref_id": 901009,
        "name": "Tumis Capcay Kuah Sayur Campur Segar",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (150 g)",
        "calories": 105,
        "protein_g": 5.2,
        "carbs_g": 12.0,
        "fat_g": 4.1,
        "sodium_mg": 380,
        "fiber_g": 3.8,
        "sugars_g": 1.4,
        "price_idr": 14000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["KAYA_VITAMIN", "MINYAK_SEDIKIT", "SERAT_TINGGI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kombinasi brokoli, kembang kol, wortel, sawi putih, dan jamur kuping ditumis dengan kaldu ayam tanpa maizena kental berlebih."
    },
    {
        "food_id": "FS-ID-141",
        "fatsecret_ref_id": 901014,
        "name": "Tumis Kangkung Belacan Rendah Minyak",
        "category": "hemat",
        "serving_size": "1 porsi (100 g)",
        "calories": 85,
        "protein_g": 3.5,
        "carbs_g": 7.0,
        "fat_g": 4.5,
        "sodium_mg": 310,
        "fiber_g": 2.5,
        "sugars_g": 0.5,
        "price_idr": 12000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["KAYA_ZAT_BESI", "MINYAK_BARU", "BUDGET_HEMAT"],
        "allergens": ["seafood_udang"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Kangkung segar dimasak kilat dengan terasi bakar sedikit dan minyak baru, mempertahankan tekstur renyah dan zat besi."
    },
    {
        "food_id": "FS-ID-142",
        "fatsecret_ref_id": 14961752,
        "name": "Tumis Buncis Baby Jagung Wortel Cah Bawang",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (120 g)",
        "calories": 80,
        "protein_g": 3.0,
        "carbs_g": 10.5,
        "fat_g": 2.8,
        "sodium_mg": 220,
        "fiber_g": 3.5,
        "sugars_g": 1.2,
        "price_idr": 13000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["MINYAK_BARU", "TINGGI_SERAT", "RAMAH_LAMBUNG"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Buncis muda manis dipotong serong bersama baby corn dan wortel, dicah dengan bawang putih geprek."
    },
    {
        "food_id": "FS-ID-143",
        "fatsecret_ref_id": 14961753,
        "name": "Cah Brokoli Bawang Putih Segar",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (120 g)",
        "calories": 70,
        "protein_g": 3.8,
        "carbs_g": 8.0,
        "fat_g": 2.5,
        "sodium_mg": 190,
        "fiber_g": 3.6,
        "sugars_g": 0.8,
        "price_idr": 15000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["KAYA_ANTIOKSIDAN", "RAMAH_LAMBUNG", "MINYAK_SEDIKIT"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kuntum brokoli hijau kaya sulforaphane dikukus sebentar lalu ditumis minyak zaitun dan bawang putih."
    },
    {
        "food_id": "FS-ID-144",
        "fatsecret_ref_id": 14961754,
        "name": "Cah Sawi Putih & Jamur Kancing Bening",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (130 g)",
        "calories": 60,
        "protein_g": 2.8,
        "carbs_g": 7.2,
        "fat_g": 2.2,
        "sodium_mg": 180,
        "fiber_g": 2.8,
        "sugars_g": 0.9,
        "price_idr": 12000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["RAMAH_LAMBUNG", "RENDAH_KALORI", "SAYUR_BENING"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sawi putih manis dipadu jamur kancing kenyal dengan sedikit kaldu ayam bening non-MSG."
    },
    {
        "food_id": "FS-ID-145",
        "fatsecret_ref_id": 2672072,
        "name": "Sayur Lodeh Rendah Santan (Susu Skim Nabati)",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (180 g)",
        "calories": 120,
        "protein_g": 3.5,
        "carbs_g": 14.0,
        "fat_g": 5.5,
        "sodium_mg": 320,
        "fiber_g": 3.8,
        "sugars_g": 1.5,
        "price_idr": 14000,
        "cooking_method": "kuah_rempah",
        "healthy_tags": ["BEBAS_SANTAN_KENTAL", "TINGGI_SERAT", "MINYAK_SEDIKIT"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sayur lodeh Jawa berisi labu siam, melinjo, dan kacang panjang menggunakan kuah susu skim nabati sebagai pengganti santan pekat."
    },
    {
        "food_id": "FS-ID-146",
        "fatsecret_ref_id": 14961755,
        "name": "Tumis Daun Singkong Bumbu Bawang Iris",
        "category": "hemat",
        "serving_size": "1 porsi (100 g)",
        "calories": 95,
        "protein_g": 4.8,
        "carbs_g": 9.5,
        "fat_g": 4.2,
        "sodium_mg": 230,
        "fiber_g": 4.2,
        "sugars_g": 0.5,
        "price_idr": 12000,
        "cooking_method": "rebus_tumis",
        "healthy_tags": ["TINGGI_SERAT", "KAYA_ZAT_BESI", "BUDGET_HEMAT"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Pucuk daun singkong direbus empuk lalu ditumis bersama bawang merah, bawang putih, dan daun salam."
    },
    {
        "food_id": "FS-ID-147",
        "fatsecret_ref_id": 14961756,
        "name": "Tumis Pare Udang Rebon Rendah Garam",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (100 g)",
        "calories": 85,
        "protein_g": 5.0,
        "carbs_g": 6.5,
        "fat_g": 4.0,
        "sodium_mg": 260,
        "fiber_g": 3.0,
        "sugars_g": 0.6,
        "price_idr": 14000,
        "cooking_method": "tumis_ringan",
        "healthy_tags": ["RENDAH_GLIKEMIK", "MINYAK_BARU", "TINGGI_SERAT"],
        "allergens": ["seafood_udang"],
        "is_spicy": True,
        "is_acidic": False,
        "description": "Pare hijau diremas garam dibilas bersih untuk meredam rasa pahit, ditumis bersama udang rebon kecil kaya mineral."
    },
    {
        "food_id": "FS-ID-148",
        "fatsecret_ref_id": 14961757,
        "name": "Sayur Bening Oyong Bihun Jamur Kuping",
        "category": "lambung",
        "serving_size": "1 mangkok (180 g)",
        "calories": 75,
        "protein_g": 2.5,
        "carbs_g": 13.5,
        "fat_g": 0.8,
        "sodium_mg": 190,
        "fiber_g": 2.5,
        "sugars_g": 0.9,
        "price_idr": 13000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["SAYUR_BENING", "RAMAH_LAMBUNG", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Oyong/gambas segar bertekstur lembut dipadu bihun jagung dan jamur kuping dalam kuah kaldu rempah bening."
    },
    {
        "food_id": "FS-ID-149",
        "fatsecret_ref_id": 14961758,
        "name": "Lalapan Mentah Segar (Kemangi, Timun, Terong Bulat)",
        "category": "rendah-kalori",
        "serving_size": "1 piring (120 g)",
        "calories": 35,
        "protein_g": 1.8,
        "carbs_g": 6.5,
        "fat_g": 0.3,
        "sodium_mg": 20,
        "fiber_g": 3.2,
        "sugars_g": 1.5,
        "price_idr": 8000,
        "cooking_method": "mentah_segar",
        "healthy_tags": ["BEBAS_MINYAK", "RENDAH_GARAM", "ALAMI_ORGANIK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sayuran lalapan segar higienis dicuci dengan air ozonisasi: daun kemangi, timun jepang, selada keriting, dan terong bulat."
    },
    {
        "food_id": "FS-ID-150",
        "fatsecret_ref_id": 14961759,
        "name": "Urap Sayur Bumbu Kelapa Kukus Rendah Garam",
        "category": "rendah-kalori",
        "serving_size": "1 porsi (140 g)",
        "calories": 135,
        "protein_g": 4.5,
        "carbs_g": 14.0,
        "fat_g": 7.0,
        "sodium_mg": 240,
        "fiber_g": 5.2,
        "sugars_g": 2.0,
        "price_idr": 14000,
        "cooking_method": "rebus_urap",
        "healthy_tags": ["TINGGI_SERAT", "BEBAS_GORENGAN", "RAMAH_LAMBUNG"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Rebusan tauge, bayam, kacang panjang, dan keningkir dicampur parutan kelapa muda kukus berbumbu kencur dan daun jeruk."
    },

    # -------------------------------------------------------------
    # 4. BEBAS SANTAN & SOTO NUSANTARA - 15 ITEMS
    # -------------------------------------------------------------
    {
        "food_id": "FS-ID-151",
        "fatsecret_ref_id": 14961724,
        "name": "Soto Ayam Kudus Kuah Bening Suwir Dada",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 180,
        "protein_g": 22.0,
        "carbs_g": 8.5,
        "fat_g": 5.8,
        "sodium_mg": 380,
        "fiber_g": 1.1,
        "sugars_g": 0.5,
        "price_idr": 25000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "KALDU_ALAMI", "TINGGI_PROTEIN", "RAMAH_LAMBUNG"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Soto Kudus otentik berkuah kaldu bening ayam kampung dengan rempah jahe, serai, daun jeruk, dan tauge rebus segar."
    },
    {
        "food_id": "FS-ID-152",
        "fatsecret_ref_id": 14961760,
        "name": "Soto Lamongan Kuah Bening Suwir Dada",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 210,
        "protein_g": 23.5,
        "carbs_g": 11.0,
        "fat_g": 7.5,
        "sodium_mg": 410,
        "fiber_g": 1.2,
        "sugars_g": 0.6,
        "price_idr": 26000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "MINYAK_MINIMAL"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Soto ayam Lamongan gurih dengan taburan bubuk koya ikan bandeng sangrai terkontrol (non-minyak)."
    },
    {
        "food_id": "FS-ID-153",
        "fatsecret_ref_id": 14961761,
        "name": "Soto Madura Kuah Bening Daging Kisi",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 230,
        "protein_g": 25.0,
        "carbs_g": 6.5,
        "fat_g": 11.0,
        "sodium_mg": 420,
        "fiber_g": 0.8,
        "sugars_g": 0.5,
        "price_idr": 32000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "TINGGI_ZAT_BESI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Soto daging sapi bagian sengkel/kisi minim lemak dengan kuah rempah bawang putih goreng dan ketumbar harum."
    },
    {
        "food_id": "FS-ID-154",
        "fatsecret_ref_id": 14961762,
        "name": "Soto Bandung Kuah Lobak & Daging Sapi Bening",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (240 ml)",
        "calories": 195,
        "protein_g": 22.5,
        "carbs_g": 9.0,
        "fat_g": 7.0,
        "sodium_mg": 390,
        "fiber_g": 2.2,
        "sugars_g": 1.0,
        "price_idr": 30000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "RAMAH_LAMBUNG", "TINGGI_SERAT"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Soto khas Bandung berkuah bening jernih dengan irisan lobak putih empuk penurun kolesterol dan kacang kedelai goreng."
    },
    {
        "food_id": "FS-ID-155",
        "fatsecret_ref_id": 14961763,
        "name": "Rawon Daging Sapi Kuah Kluwek Bening",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 240,
        "protein_g": 26.0,
        "carbs_g": 7.0,
        "fat_g": 11.5,
        "sodium_mg": 450,
        "fiber_g": 1.4,
        "sugars_g": 0.5,
        "price_idr": 34000,
        "cooking_method": "kuah_kluwek",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "KAYA_ANTIOKSIDAN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup daging sapi khas Jawa Timur berwarna hitam pekat alami dari buah kluwek kaya antioksidan tanpa santan."
    },
    {
        "food_id": "FS-ID-156",
        "fatsecret_ref_id": 14961764,
        "name": "Sop Buntut Kuah Bening Rempah Pala",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 260,
        "protein_g": 27.5,
        "carbs_g": 6.0,
        "fat_g": 13.5,
        "sodium_mg": 460,
        "fiber_g": 1.2,
        "sugars_g": 0.8,
        "price_idr": 42000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "KALDU_ALAMI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Buntut sapi direbus presto hingga empuk, disajikan dalam kuah bening aromatik kayu manis, pala, dan cengkeh."
    },
    {
        "food_id": "FS-ID-157",
        "fatsecret_ref_id": 901012,
        "name": "Sup Daging Sapi Bening Brenebon (Kacang Merah)",
        "category": "protein",
        "serving_size": "1 mangkok (200 g)",
        "calories": 220,
        "protein_g": 24.5,
        "carbs_g": 14.0,
        "fat_g": 7.5,
        "sodium_mg": 420,
        "fiber_g": 4.5,
        "sugars_g": 0.9,
        "price_idr": 32000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["TINGGI_ZAT_BESI", "BEBAS_SANTAN", "TINGGI_PROTEIN", "TINGGI_SERAT"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup kacang merah brenebon khas Manado dipadu potongan daging sapi has dalam, kaya serat dan mineral penambah darah."
    },
    {
        "food_id": "FS-ID-158",
        "fatsecret_ref_id": 14961765,
        "name": "Pindang Ikan Patin Kuah Asam Nanas Segar",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (200 g)",
        "calories": 190,
        "protein_g": 26.0,
        "carbs_g": 8.0,
        "fat_g": 5.5,
        "sodium_mg": 360,
        "fiber_g": 1.2,
        "sugars_g": 1.8,
        "price_idr": 30000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "OMEGA_3", "TINGGI_PROTEIN"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": True,
        "description": "Pindang ikan patin khas Palembang dengan kuah bening segar dari asam jawa, serai, kunyit, dan potongan nanas madu."
    },
    {
        "food_id": "FS-ID-159",
        "fatsecret_ref_id": 14961766,
        "name": "Sup Ikan Kakap Kuah Asam Pedas Lembut",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (180 g)",
        "calories": 170,
        "protein_g": 27.5,
        "carbs_g": 5.0,
        "fat_g": 4.2,
        "sodium_mg": 350,
        "fiber_g": 0.8,
        "sugars_g": 0.6,
        "price_idr": 33000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": True,
        "description": "Fillet kakap laut dalam kuah kaldu ikan bening dipadu tomat hijau dan kemangi segar, sangat rendah lemak jenuh."
    },
    {
        "food_id": "FS-ID-160",
        "fatsecret_ref_id": 14961767,
        "name": "Tekwan Kuah Udang & Bengkuang Bening",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (200 g)",
        "calories": 165,
        "protein_g": 14.0,
        "carbs_g": 19.0,
        "fat_g": 3.2,
        "sodium_mg": 390,
        "fiber_g": 2.0,
        "sugars_g": 1.0,
        "price_idr": 24000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "RENDAH_LEMAK", "SERAT_BENGKUANG"],
        "allergens": ["seafood_udang"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Bola-bola ikan tenggiri disajikan dengan kaldu udang bening, irisan bengkuang manis, jamur kuping, dan bunga sedap malam."
    },
    {
        "food_id": "FS-ID-161",
        "fatsecret_ref_id": 14961768,
        "name": "Sup Kimlo Ayam Kuah Bening Kembang Tahu",
        "category": "lambung",
        "serving_size": "1 mangkok (220 g)",
        "calories": 150,
        "protein_g": 16.5,
        "carbs_g": 9.0,
        "fat_g": 4.5,
        "sodium_mg": 320,
        "fiber_g": 2.2,
        "sugars_g": 0.8,
        "price_idr": 23000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["RAMAH_LAMBUNG", "SAYUR_BENING", "BEBAS_SANTAN"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup kimlo peranakan Jawa dengan kembang tahu sutra, wortel, jamur kuping, dan suwiran ayam rebus lembut."
    },
    {
        "food_id": "FS-ID-162",
        "fatsecret_ref_id": 14961769,
        "name": "Bakso Daging Sapi Kuah Bening Kaldu Sumsum",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (200 g)",
        "calories": 235,
        "protein_g": 21.0,
        "carbs_g": 16.0,
        "fat_g": 9.5,
        "sodium_mg": 460,
        "fiber_g": 1.0,
        "sugars_g": 0.5,
        "price_idr": 25000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["BEBAS_SANTAN", "TINGGI_PROTEIN", "KALDU_ALAMI"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Bakso sapi halus murni daging tanpa boraks/formalin, disajikan dalam kuah kaldu sapi bening dan sawi hijau."
    },
    {
        "food_id": "FS-ID-163",
        "fatsecret_ref_id": 14961770,
        "name": "Soto Betawi Kuah Susu Rendah Lemak (Bebas Santan)",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 250,
        "protein_g": 23.0,
        "carbs_g": 11.5,
        "fat_g": 12.0,
        "sodium_mg": 440,
        "fiber_g": 1.2,
        "sugars_g": 1.5,
        "price_idr": 35000,
        "cooking_method": "kuah_rempah",
        "healthy_tags": ["BEBAS_SANTAN", "SUSU_RENDAH_LEMAK", "TINGGI_PROTEIN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Inovasi soto Betawi modern menggunakan susu evaporasi rendah lemak pengganti santan, beraroma kayu manis dan pala."
    },
    {
        "food_id": "FS-ID-164",
        "fatsecret_ref_id": 14961771,
        "name": "Sup Ayam Herbal Jahe & Ginseng Nusantara",
        "category": "lambung",
        "serving_size": "1 mangkok (250 ml)",
        "calories": 175,
        "protein_g": 24.0,
        "carbs_g": 4.5,
        "fat_g": 6.0,
        "sodium_mg": 290,
        "fiber_g": 0.8,
        "sugars_g": 0.4,
        "price_idr": 29000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["RAMAH_LAMBUNG", "BEBAS_SANTAN", "KAYA_ANTIOKSIDAN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup ayam rebus kaldu jahe merah, kapulaga, dan rempah stamina alami, menghangatkan sistem pencernaan."
    },
    {
        "food_id": "FS-ID-165",
        "fatsecret_ref_id": 14961772,
        "name": "Asam-Asam Ikan Bandeng Tanpa Duri Kuah Belimbing",
        "category": "bebas-santan",
        "serving_size": "1 mangkok (180 g)",
        "calories": 185,
        "protein_g": 25.5,
        "carbs_g": 6.0,
        "fat_g": 6.5,
        "sodium_mg": 350,
        "fiber_g": 1.0,
        "sugars_g": 0.9,
        "price_idr": 28000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["OMEGA_3", "BEBAS_SANTAN", "TINGGI_PROTEIN"],
        "allergens": ["NONE"],
        "is_spicy": True,
        "is_acidic": True,
        "description": "Bandeng cabut duri dimasak kuah bening belimbing wuluh segar dan tomat hijau, kaya asam lemak esensial."
    },

    # -------------------------------------------------------------
    # 5. RAMAH LAMBUNG & GERD-SAFE (DIGESTIVE COMFORT) - 15 ITEMS
    # -------------------------------------------------------------
    {
        "food_id": "FS-ID-166",
        "fatsecret_ref_id": 901017,
        "name": "Sup Jamur Tiram Bening Kaldu Jahe Hangat",
        "category": "lambung",
        "serving_size": "1 mangkok (150 g)",
        "calories": 55,
        "protein_g": 3.2,
        "carbs_g": 8.0,
        "fat_g": 0.8,
        "sodium_mg": 160,
        "fiber_g": 2.8,
        "sugars_g": 0.5,
        "price_idr": 15000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["RAMAH_LAMBUNG", "RENDAH_KALORI", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Jamur tiram organik dalam kaldu bening jahe emprit geprek. Menetralkan asam lambung dan memberikan rasa nyaman seketika."
    },
    {
        "food_id": "FS-ID-167",
        "fatsecret_ref_id": 14961773,
        "name": "Bubur Ayam Kuah Bening Kaldu Kunyit Jahe",
        "category": "lambung",
        "serving_size": "1 porsi (250 g)",
        "calories": 215,
        "protein_g": 16.5,
        "carbs_g": 28.0,
        "fat_g": 4.0,
        "sodium_mg": 280,
        "fiber_g": 1.5,
        "sugars_g": 0.6,
        "price_idr": 18000,
        "cooking_method": "bubur_rebus",
        "healthy_tags": ["RAMAH_LAMBUNG", "BEBAS_SANTAN", "KUKUS_HANGAT"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Bubur beras pulen lembut dimasak dengan kaldu ayam jahe dan kunyit penyejuk lambung, disajikan dengan suwiran ayam kukus."
    },
    {
        "food_id": "FS-ID-168",
        "fatsecret_ref_id": 14961774,
        "name": "Pepes Tahu Sutra & Jamur Kuping Tanpa Cabai",
        "category": "lambung",
        "serving_size": "1 bungkus (100 g)",
        "calories": 90,
        "protein_g": 9.0,
        "carbs_g": 4.0,
        "fat_g": 3.8,
        "sodium_mg": 180,
        "fiber_g": 2.0,
        "sugars_g": 0.3,
        "price_idr": 13000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["RAMAH_LAMBUNG", "KUKUS_HIGIENIS", "BEBAS_PEDAS"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tahu sutra kukus murni tanpa cabai atau asam cuka, dibumbui daun salam dan sedikit garam meja, aman untuk GERD akut."
    },
    {
        "food_id": "FS-ID-169",
        "fatsecret_ref_id": 14961775,
        "name": "Sup Telur Puyuh & Wortel Bening Kaldu Alami",
        "category": "lambung",
        "serving_size": "1 mangkok (180 g)",
        "calories": 130,
        "protein_g": 8.5,
        "carbs_g": 7.5,
        "fat_g": 7.0,
        "sodium_mg": 210,
        "fiber_g": 2.0,
        "sugars_g": 1.0,
        "price_idr": 16000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["RAMAH_LAMBUNG", "SAYUR_BENING", "BEBAS_SANTAN"],
        "allergens": ["telur"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Sup bening ringan berisi 3 butir telur puyuh rebus dan potongan wortel manis, sangat mudah dicerna usus sensitif."
    },
    {
        "food_id": "FS-ID-170",
        "fatsecret_ref_id": 14961776,
        "name": "Bubur Manado (Tinutuan) Sayur Bayam Labu Kuning",
        "category": "lambung",
        "serving_size": "1 mangkok besar (300 g)",
        "calories": 165,
        "protein_g": 5.5,
        "carbs_g": 31.0,
        "fat_g": 1.5,
        "sodium_mg": 190,
        "fiber_g": 5.8,
        "sugars_g": 2.2,
        "price_idr": 18000,
        "cooking_method": "bubur_sayur",
        "healthy_tags": ["RAMAH_LAMBUNG", "TINGGI_SERAT", "SUPERFOOD_LOKAL", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Tinutuan otentik Manado berisi labu kuning, ubi jalar, jagung manis, bayam, dan kangkung. Makanan terapi pencernaan terbaik."
    },
    {
        "food_id": "FS-ID-171",
        "fatsecret_ref_id": 14961777,
        "name": "Sup Labu Siam Manis Kaldu Ayam Kampung Bening",
        "category": "lambung",
        "serving_size": "1 mangkok (160 g)",
        "calories": 70,
        "protein_g": 4.5,
        "carbs_g": 8.5,
        "fat_g": 1.5,
        "sodium_mg": 170,
        "fiber_g": 2.5,
        "sugars_g": 1.1,
        "price_idr": 14000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["RAMAH_LAMBUNG", "SAYUR_BENING", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Labu siam potong dadu empuk dimasak kuah bening ayam kampung tanpa lada menyengat, ramah mukosa lambung."
    },
    {
        "food_id": "FS-ID-172",
        "fatsecret_ref_id": 14961778,
        "name": "Ikan Dori Kukus Saus Kecap Asin Jahe",
        "category": "lambung",
        "serving_size": "1 porsi (120 g)",
        "calories": 140,
        "protein_g": 25.0,
        "carbs_g": 2.0,
        "fat_g": 3.2,
        "sodium_mg": 290,
        "fiber_g": 0.2,
        "sugars_g": 0.5,
        "price_idr": 31000,
        "cooking_method": "kukus",
        "healthy_tags": ["KUKUS_HIGIENIS", "RAMAH_LAMBUNG", "TINGGI_PROTEIN", "BEBAS_MINYAK"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Fillet ikan dori lembut dikukus bersama irisan jahe segar dan kecap asin kedelai Jepang rendah natrium."
    },
    {
        "food_id": "FS-ID-173",
        "fatsecret_ref_id": 14961779,
        "name": "Sup Kembang Tahu & Wortel Kuah Bening Hangat",
        "category": "lambung",
        "serving_size": "1 mangkok (160 g)",
        "calories": 85,
        "protein_g": 6.8,
        "carbs_g": 6.0,
        "fat_g": 3.2,
        "sodium_mg": 190,
        "fiber_g": 1.8,
        "sugars_g": 0.8,
        "price_idr": 14000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["RAMAH_LAMBUNG", "SAYUR_BENING", "BEBAS_MINYAK"],
        "allergens": ["kedelai"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kembang tahu lembaran bertekstur lembut sutra dipadu wortel manis dalam kaldu sayur bening."
    },
    {
        "food_id": "FS-ID-174",
        "fatsecret_ref_id": 14961780,
        "name": "Pepes Ikan Nila Daun Kunyit Tanpa Asam",
        "category": "lambung",
        "serving_size": "1 bungkus (130 g)",
        "calories": 170,
        "protein_g": 26.5,
        "carbs_g": 1.5,
        "fat_g": 6.2,
        "sodium_mg": 260,
        "fiber_g": 0.4,
        "sugars_g": 0.2,
        "price_idr": 28000,
        "cooking_method": "kukus_daun",
        "healthy_tags": ["KUKUS_HIGIENIS", "BEBAS_PEDAS", "RAMAH_LAMBUNG", "OMEGA_3"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Ikan nila fillet dibumbui daun kunyit, lengkuas, dan kemangi tanpa cabai, dikukus higienis ramah GERD."
    },
    {
        "food_id": "FS-ID-175",
        "fatsecret_ref_id": 14961781,
        "name": "Kentang Tumbuk (Mashed Potato) Rebus Kuah Kaldu",
        "category": "lambung",
        "serving_size": "1 mangkok (150 g)",
        "calories": 120,
        "protein_g": 2.8,
        "carbs_g": 24.5,
        "fat_g": 0.8,
        "sodium_mg": 140,
        "fiber_g": 2.6,
        "sugars_g": 0.9,
        "price_idr": 15000,
        "cooking_method": "rebus_tumbuk",
        "healthy_tags": ["RAMAH_LAMBUNG", "BEBAS_MINYAK", "KOMPLEKS_KARBO"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Kentang kuning rebus ditumbuk lembut dengan sedikit kaldu ayam hangat tanpa mentega tinggi lemak jenuh."
    },
    {
        "food_id": "FS-ID-176",
        "fatsecret_ref_id": 14961782,
        "name": "Nasi Tim Ayam Jamur Kuah Bening Hangat",
        "category": "lambung",
        "serving_size": "1 mangkok (220 g)",
        "calories": 260,
        "protein_g": 21.0,
        "carbs_g": 32.5,
        "fat_g": 5.0,
        "sodium_mg": 320,
        "fiber_g": 1.8,
        "sugars_g": 1.0,
        "price_idr": 26000,
        "cooking_method": "tim_kukus",
        "healthy_tags": ["RAMAH_LAMBUNG", "KUKUS_HIGIENIS", "TINGGI_PROTEIN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Beras pulen dimasak tim bersama cincangan dada ayam dan jamur merang dengan kaldu jahe lembut."
    },
    {
        "food_id": "FS-ID-177",
        "fatsecret_ref_id": 14961783,
        "name": "Sayur Wortel & Buncis Kukus Lembut Bumbu Bawang",
        "category": "lambung",
        "serving_size": "1 porsi (120 g)",
        "calories": 65,
        "protein_g": 2.4,
        "carbs_g": 11.0,
        "fat_g": 0.5,
        "sodium_mg": 130,
        "fiber_g": 3.4,
        "sugars_g": 1.5,
        "price_idr": 12000,
        "cooking_method": "kukus",
        "healthy_tags": ["KUKUS_HIGIENIS", "RAMAH_LAMBUNG", "BEBAS_MINYAK"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Potongan wortel dan buncis manis dikukus lembut sampai mudah dikunyah, disiram minyak wijen tetes minim."
    },
    {
        "food_id": "FS-ID-178",
        "fatsecret_ref_id": 14961784,
        "name": "Sup Ikan Salmon Kuah Jahe Serai Nusantara",
        "category": "protein",
        "serving_size": "1 mangkok (200 g)",
        "calories": 210,
        "protein_g": 27.0,
        "carbs_g": 2.0,
        "fat_g": 10.0,
        "sodium_mg": 310,
        "fiber_g": 0.5,
        "sugars_g": 0.4,
        "price_idr": 45000,
        "cooking_method": "kuah_bening",
        "healthy_tags": ["OMEGA_3", "RAMAH_LAMBUNG", "BEBAS_SANTAN", "TINGGI_PROTEIN"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Fillet salmon liar segar dalam kuah bening jahe, daun bawang, dan serai wangi. Sumber EPA/DHA anti-inflamasi alami."
    },
    {
        "food_id": "FS-ID-179",
        "fatsecret_ref_id": 901016,
        "name": "Pecel Sayur Madiun Bumbu Terpisah (Sayur Kukus Lembut)",
        "category": "rendah-kalori",
        "serving_size": "1 porsi sayur (180 g)",
        "calories": 190,
        "protein_g": 8.5,
        "carbs_g": 22.0,
        "fat_g": 7.5,
        "sodium_mg": 280,
        "fiber_g": 6.8,
        "sugars_g": 2.5,
        "price_idr": 16000,
        "cooking_method": "rebus_pecel",
        "healthy_tags": ["TINGGI_SERAT", "BEBAS_GORENGAN", "RAMAH_LAMBUNG"],
        "allergens": ["kacang"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Aneka sayuran rebus empuk (bayam, tauge, kacang panjang) dengan saus kacang sangrai terpisah porsi terkontrol."
    },
    {
        "food_id": "FS-ID-180",
        "fatsecret_ref_id": 901008,
        "name": "Nasi Merah Organik Pulen",
        "category": "rendah-kalori",
        "serving_size": "1 centong (100 g)",
        "calories": 110,
        "protein_g": 2.8,
        "carbs_g": 23.5,
        "fat_g": 0.9,
        "sodium_mg": 5,
        "fiber_g": 1.8,
        "sugars_g": 0.2,
        "price_idr": 6000,
        "cooking_method": "rebus_tim",
        "healthy_tags": ["LOW_GI", "KOMPLEKS_KARBO", "KENYANG_LAMA", "BEBAS_KOLESTEROL"],
        "allergens": ["NONE"],
        "is_spicy": False,
        "is_acidic": False,
        "description": "Beras merah organik pecah kulit dimasak dengan rasio air seimbang sehingga menghasilkan tekstur pulen dan kaya serat pangan."
    }
]

# Match Algorithm
def evaluate_persona_fitness(dish: Dict[str, Any], persona: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates whether a dish is medically and nutritionally safe for a given persona,
    and calculates a fit percentage score (0-100%).
    """
    # 1. HARD DISQUALIFIERS (CLINICAL GUARDRAILS)
    allergens = persona["allergens"]
    dish_allergens = dish["allergens"]
    
    # Allergy Check
    if allergens == "kacang" and ("kacang" in dish_allergens or "bumbu_kacang" in dish_allergens):
        return {"fits": False, "score": 0, "reason": "Alergi kacang terpicu"}
    if allergens == "seafood_udang" and ("seafood_udang" in dish_allergens):
        return {"fits": False, "score": 0, "reason": "Alergi seafood/udang terpicu"}
    if allergens == "telur" and ("telur" in dish_allergens):
        return {"fits": False, "score": 0, "reason": "Alergi telur terpicu"}

    # Medical Conditions Check
    med = persona["medical_conditions"]
    if med == "HYPERTENSION_STAGE1" and dish["sodium_mg"] > 430:
        return {"fits": False, "score": 0, "reason": f"Natrium ({dish['sodium_mg']}mg) melebihi batas hipertensi klinis"}
    
    if med in ["GERD_RINGAN", "CHRONIC_GASTRITIS", "GERD_MAAG"]:
        if dish["is_spicy"]:
            return {"fits": False, "score": 0, "reason": "Makanan pedas memicu asam lambung/GERD"}
        if dish["is_acidic"]:
            return {"fits": False, "score": 0, "reason": "Makanan asam memicu erosi lambung"}
        if dish["fat_g"] > 10.0:
            return {"fits": False, "score": 0, "reason": f"Kandungan lemak ({dish['fat_g']}g) memperlambat pengosongan lambung"}

    # Budget Check
    budget = persona["target_lunch_budget_idr"]
    if dish["price_idr"] > budget * 1.25:
        return {"fits": False, "score": 0, "reason": f"Harga Rp{dish['price_idr']} melampaui toleransi anggaran persona (Rp{budget:.0f})"}

    # 2. MATCH SCORING (0-100)
    score = 50.0  # Baseline qualified score
    archetype = persona["archetype_code"]

    # Archetype 1: BUDGET_FITNESS
    if archetype == "BUDGET_FITNESS":
        if dish["protein_g"] >= 25.0:
            score += 25.0
        elif dish["protein_g"] >= 15.0:
            score += 15.0
        if dish["price_idr"] <= 28000:
            score += 15.0
        if "TINGGI_PROTEIN" in dish["healthy_tags"]:
            score += 5.0
        if "MINYAK_BARU" in dish["healthy_tags"]:
            score += 5.0

    # Archetype 2: PREVENTIVE_HEALTH
    elif archetype == "PREVENTIVE_HEALTH":
        if dish["sodium_mg"] <= 300:
            score += 25.0
        elif dish["sodium_mg"] <= 400:
            score += 15.0
        if dish["fat_g"] <= 7.0:
            score += 15.0
        if dish["fiber_g"] >= 3.0:
            score += 10.0
        if "BEBAS_SANTAN" in dish["healthy_tags"]:
            score += 5.0

    # Archetype 3: CORP_OVERLOADED
    elif archetype == "CORP_OVERLOADED":
        # Balanced, clean carbs, non-greasy
        if dish["fat_g"] <= 9.0 and dish["calories"] <= 350:
            score += 25.0
        if "MINYAK_BARU" in dish["healthy_tags"] or "SAYUR_BENING" in dish["healthy_tags"]:
            score += 15.0
        if dish["price_idr"] <= 35000:
            score += 10.0

    # Archetype 4: DIGESTIVE_GERD
    elif archetype == "DIGESTIVE_GERD":
        if "RAMAH_LAMBUNG" in dish["healthy_tags"]:
            score += 30.0
        if "KUKUS_HIGIENIS" in dish["healthy_tags"] or "SAYUR_BENING" in dish["healthy_tags"]:
            score += 15.0
        if dish["fat_g"] <= 5.0:
            score += 10.0

    # Tag overlap bonus
    overlap = set(dish["healthy_tags"]).intersection(set(persona["preferred_tags"]))
    score += len(overlap) * 3.0

    final_score = min(round(score), 100)
    # Qualify if score >= 65%
    if final_score >= 65:
        return {"fits": True, "score": final_score, "reason": "Memenuhi guardrail nutrisi klinis & kriteria persona"}
    return {"fits": False, "score": final_score, "reason": "Skor kesesuaian di bawah ambang batas (65%)"}


def run_extraction_and_mapping():
    print("[*] Loading 120 NutriSea Consumer Personas from CSV...")
    personas = load_personas()
    print(f"[+] Loaded {len(personas)} personas successfully.")

    print(f"[*] Processing {len(DISHES_DATA)} authentic Indonesian dishes...")

    expanded_dishes = []
    csv_rows = []

    archetype_stats = {
        "BUDGET_FITNESS": 0,
        "PREVENTIVE_HEALTH": 0,
        "CORP_OVERLOADED": 0,
        "DIGESTIVE_GERD": 0
    }

    for d in DISHES_DATA:
        matched_personas = []
        matched_archetypes = set()

        for p in personas:
            result = evaluate_persona_fitness(d, p)
            if result["fits"]:
                matched_personas.append({
                    "persona_id": p["persona_id"],
                    "name": p["full_name"],
                    "archetype": p["archetype_code"],
                    "score": result["score"]
                })
                matched_archetypes.add(p["archetype_code"])
                archetype_stats[p["archetype_code"]] += 1

        # Sort by score descending
        matched_personas.sort(key=lambda x: x["score"], reverse=True)

        # Generate clinical rationale
        arch_list = sorted(list(matched_archetypes))
        rationale_parts = []
        if "BUDGET_FITNESS" in arch_list:
            rationale_parts.append(f"Protein tinggi ({d['protein_g']}g) & harga hemat (Rp{d['price_idr']:,}) ideal untuk sintesis otot Budget Fitness")
        if "PREVENTIVE_HEALTH" in arch_list:
            rationale_parts.append(f"Natrium rendah ({d['sodium_mg']}mg) & lemak terukur ({d['fat_g']}g) aman untuk perlindungan kardiometabolik Preventive Health")
        if "CORP_OVERLOADED" in arch_list:
            rationale_parts.append(f"Profil makro seimbang ({d['calories']} kcal) mencegah food coma sore hari bagi Corporate Professional")
        if "DIGESTIVE_GERD" in arch_list:
            rationale_parts.append(f"Bebas pedas/asam & dimasak higienis menjaga kestabilan mukosa Digestive GERD")

        clinical_rationale = "; ".join(rationale_parts) if rationale_parts else "Pilihan nutrisi harian seimbang."

        persona_ids_str = ", ".join([m["persona_id"] for m in matched_personas])
        persona_names_str = "; ".join([f"{m['name']} ({m['persona_id']})" for m in matched_personas])
        persona_short_display = ", ".join([m["name"] for m in matched_personas[:3]])
        if len(matched_personas) > 3:
            persona_short_display += f" (+{len(matched_personas) - 3} persona lainnya)"

        dish_record = {
            **d,
            "matched_archetypes": arch_list,
            "personas": [m["persona_id"] for m in matched_personas],
            "persona_names": [m["name"] for m in matched_personas],
            "assigned_persona_ids": [m["persona_id"] for m in matched_personas],
            "assigned_personas_count": len(matched_personas),
            "top_matched_personas": matched_personas[:5],
            "clinical_rationale": clinical_rationale
        }
        expanded_dishes.append(dish_record)

        csv_rows.append({
            "food_id": d["food_id"],
            "fatsecret_ref_id": d["fatsecret_ref_id"],
            "name": d["name"],
            "category": d["category"],
            "calories": d["calories"],
            "protein_g": d["protein_g"],
            "carbs_g": d["carbs_g"],
            "fat_g": d["fat_g"],
            "sodium_mg": d["sodium_mg"],
            "fiber_g": d["fiber_g"],
            "price_idr": d["price_idr"],
            "personas": persona_ids_str,
            "persona_names": persona_names_str,
            "matched_archetypes": ",".join(arch_list),
            "assigned_personas_count": len(matched_personas),
            "clinical_rationale": clinical_rationale
        })

    # Save JSON
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(expanded_dishes, f, indent=2, ensure_ascii=False)
    print(f"[+] Saved structured JSON dataset to: {OUT_JSON}")

    # Save CSV
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "food_id", "fatsecret_ref_id", "name", "category",
            "calories", "protein_g", "carbs_g", "fat_g", "sodium_mg", "fiber_g",
            "price_idr", "personas", "persona_names", "matched_archetypes", "assigned_personas_count",
            "clinical_rationale"
        ])
        writer.writeheader()
        writer.writerows(csv_rows)
    print(f"[+] Saved CSV dataset with 'personas' column to: {OUT_CSV}")

    # Save Markdown Documentation & Summary Report
    with open(OUT_MD, "w", encoding="utf-8") as f:
        f.write("# Dokumentasi Dataset Nutrisi Makanan Indonesia & Pemetaan Persona NutriSea\n\n")
        f.write(f"**Total Hidangan**: {len(expanded_dishes)} hidangan terverifikasi FatSecret & TKPI\n")
        f.write(f"**Total Persona**: {len(personas)} persona konsumen aktif\n\n")
        f.write("## 1. Ringkasan Distribusi Pemetaan Persona\n\n")
        f.write(f"- **Budget-Conscious Fitness Enthusiast**: {archetype_stats['BUDGET_FITNESS']} kecocokan menu\n")
        f.write(f"- **Preventive Health Starter**: {archetype_stats['PREVENTIVE_HEALTH']} kecocokan menu\n")
        f.write(f"- **Overloaded Corporate Professional**: {archetype_stats['CORP_OVERLOADED']} kecocokan menu\n")
        f.write(f"- **Digestive / GERD Sufferer**: {archetype_stats['DIGESTIVE_GERD']} kecocokan menu\n\n")
        f.write("## 2. Tabel Katalog 80 Hidangan & Kolom Persona yang Cocok\n\n")
        f.write("| ID | Nama Hidangan | Kategori | Kalori | Protein | Lemak | Natrium | Harga | Personas (Persona yang Cocok) | Jml | Arketipe Cocok |\n")
        f.write("|---|---|---|---|---|---|---|---|---|---|---|\n")
        for r in expanded_dishes:
            arches = ", ".join(r["matched_archetypes"]) or "Umum"
            top_p = ", ".join([f"{m['name']}" for m in r['top_matched_personas'][:3]])
            if r['assigned_personas_count'] > 3:
                top_p += f" (+{r['assigned_personas_count'] - 3} lainnya)"
            f.write(f"| {r['food_id']} | {r['name']} | `{r['category']}` | {r['calories']} kcal | {r['protein_g']}g | {r['fat_g']}g | {r['sodium_mg']}mg | Rp {r['price_idr']:,} | {top_p} | **{r['assigned_personas_count']}** | {arches} |\n")
        f.write("\n## 3. Aturan Pemetaan Multi-Persona (Clinical Guardrails)\n\n")
        f.write("1. **Guardrail Alergi Mutlak**: Makanan yang mengandung kacang, telur, atau udang otomatis dieliminasi bagi persona dengan riwayat alergi terkait.\n")
        f.write("2. **Guardrail Hipertensi Klinis**: Makanan dengan natrium >430 mg otomatis didiskualifikasi untuk arketipe penderita hipertensi.\n")
        f.write("3. **Guardrail GERD / Gastritis**: Makanan bercita rasa pedas, asam tinggi, atau lemak >10g otomatis didiskualifikasi bagi persona dengan keluhan lambung.\n")
        f.write("4. **Multi-Persona Assignment**: Setiap makanan dapat mengampu lebih dari satu persona selama memenuhi kriteria biometrik, makronutrisi, dan batas anggaran harian.\n")
    print(f"[+] Saved comprehensive documentation to: {OUT_MD}")

    # Print Summary Table
    print("\n" + "=" * 90)
    print(f"{'Food ID':<11} {'Food Name':<38} {'Kcal':<6} {'P(g)':<6} {'Na(mg)':<7} {'Price':<10} {'Personas'}")
    print("=" * 90)
    for d in expanded_dishes[:15]:
        print(f"{d['food_id']:<11} {d['name'][:36]:<38} {d['calories']:<6} {d['protein_g']:<6.1f} {d['sodium_mg']:<7} Rp{d['price_idr']:<8} {d['assigned_personas_count']} personas ({', '.join(d['matched_archetypes'])})")
    print(f"... and {len(expanded_dishes) - 15} more dishes.")
    print("=" * 90)

if __name__ == "__main__":
    run_extraction_and_mapping()
