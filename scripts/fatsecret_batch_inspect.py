#!/usr/bin/env python3
"""
FatSecret Batch Nutrient Inspector & Benchmark Tool
Inspects multiple Indonesian foods via FatSecret, calculates clinical density metrics,
and estimates Nutri-Grade (A/B/C/D) and health tags.

Usage:
    python scripts/fatsecret_batch_inspect.py
    python scripts/fatsecret_batch_inspect.py "rawon" "rendang" "gado gado"
    python scripts/fatsecret_batch_inspect.py --export benchmark_report.json
"""

import sys
import os
import argparse
import json
from typing import List, Dict, Any

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.fatsecret_service import FatSecretService

DEFAULT_BATCH = [
    "Ayam Bakar Dada",
    "Soto Ayam Bening",
    "Orek Tempe Basah",
    "Sayur Bening Bayam",
    "Pepes Tahu",
    "Ikan Nila Bakar",
    "Gado-Gado",
    "Nasi Merah",
    "Capcay Kuah",
    "Telur Rebus"
]

def calculate_nutri_grade(kcal: int, fat_g: float, sodium_mg: int, carbs_g: float) -> str:
    """
    Heuristic Nutri-Grade estimation (A, B, C, D) based on saturated fat, sodium, and energy density.
    """
    penalty = 0
    if sodium_mg > 600:
        penalty += 2
    elif sodium_mg > 400:
        penalty += 1

    if fat_g > 15:
        penalty += 2
    elif fat_g > 8:
        penalty += 1

    if kcal > 450:
        penalty += 1

    if penalty == 0:
        return "A (Sangat Sehat)"
    elif penalty <= 2:
        return "B (Sehat)"
    elif penalty <= 3:
        return "C (Moderat)"
    else:
        return "D (Tinggi Lemak/Garam)"

def inspect_batch(items: List[str], export_path: str = None):
    svc = FatSecretService()
    print(f"[*] FatSecret Engine: {'ONLINE' if svc.is_configured() else 'VERIFIED REFERENCE DATASET'}")
    print(f"[*] Batch inspecting {len(items)} food items from FatSecret...\n")

    report = []
    print("=" * 105)
    print(f"{'Food / Query':<28} {'Serving':<16} {'Kcal':<6} {'Prot(g)':<8} {'Prot/100kcal':<14} {'Na(mg)':<8} {'Nutri-Grade':<16}")
    print("=" * 105)

    for item_name in items:
        results = svc.search_foods(item_name, max_results=1, region="ID", language="id")
        if not results:
            continue
        data = results[0]
        kcal = data.get("calories", 0)
        prot = data.get("protein_g", 0.0)
        fat = data.get("fat_g", 0.0)
        carbs = data.get("carbs_g", 0.0)
        sodium = data.get("sodium_mg", 0)
        serving = data.get("serving_description", "-")

        # Protein density: grams of protein per 100 kcal
        prot_density = (prot / kcal * 100) if kcal > 0 else 0.0
        grade = calculate_nutri_grade(kcal, fat, sodium, carbs)

        report.append({
            "query": item_name,
            "matched_food_name": data.get("food_name"),
            "serving": serving,
            "calories": kcal,
            "protein_g": prot,
            "carbs_g": carbs,
            "fat_g": fat,
            "sodium_mg": sodium,
            "protein_per_100kcal": round(prot_density, 1),
            "estimated_nutri_grade": grade,
            "data_source": data.get("source")
        })

        name_display = item_name[:26]
        serving_display = serving[:14]
        density_str = f"{prot_density:.1f}g / 100kcal"
        print(f"{name_display:<28} {serving_display:<16} {kcal:<6} {prot:<8.1f} {density_str:<14} {sodium:<8} {grade:<16}")

    print("=" * 105)
    print(f"\n[+] Analysis complete for {len(report)} items.")

    if export_path:
        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"[+] Detailed report exported to: {export_path}")

def main():
    parser = argparse.ArgumentParser(description="FatSecret Batch Food Nutrient Inspector")
    parser.add_argument("queries", nargs="*", default=DEFAULT_BATCH, help="Food queries to inspect")
    parser.add_argument("--export", type=str, default=None, help="Save output to JSON file")
    args = parser.parse_args()

    inspect_batch(args.queries, export_path=args.export)

if __name__ == "__main__":
    main()
