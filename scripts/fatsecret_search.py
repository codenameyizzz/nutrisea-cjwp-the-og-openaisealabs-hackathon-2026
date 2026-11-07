#!/usr/bin/env python3
"""
FatSecret Food Search CLI
Search Indonesian foods and nutritional data using FatSecret API / library.

Usage:
    python scripts/fatsecret_search.py "ayam bakar"
    python scripts/fatsecret_search.py "soto ayam" --max 5
    python scripts/fatsecret_search.py --id 901001
    python scripts/fatsecret_search.py "tempe" --json
"""

import sys
import os
import argparse
import json

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.fatsecret_service import FatSecretService

def print_table(results):
    if not results:
        print("\n[!] No matching food items found.")
        return

    print("\n" + "=" * 90)
    print(f"{'ID':<10} {'Food Name':<34} {'Serving':<18} {'Kcal':<6} {'Prot(g)':<8} {'Carb(g)':<8} {'Fat(g)':<7}")
    print("=" * 90)
    for r in results:
        food_id = str(r.get("food_id", "-"))
        name = (r.get("food_name", "-"))[:32]
        serving = (r.get("serving_description", "-"))[:16]
        kcal = str(r.get("calories", "-"))
        prot = f"{r.get('protein_g', 0.0):.1f}"
        carbs = f"{r.get('carbs_g', 0.0):.1f}"
        fat = f"{r.get('fat_g', 0.0):.1f}"
        print(f"{food_id:<10} {name:<34} {serving:<18} {kcal:<6} {prot:<8} {carbs:<8} {fat:<7}")
    print("=" * 90)
    source = results[0].get("source", "UNKNOWN")
    print(f"Total: {len(results)} items | Data Source: {source}\n")

def print_detail(detail):
    if not detail:
        print("\n[!] Food details not found.")
        return

    print("\n" + "=" * 65)
    print(f"FATSECRET NUTRITION FACTS: {detail.get('food_name')}")
    print(f"Food ID: {detail.get('food_id')} | Brand: {detail.get('brand_name') or 'Generic'}")
    print("=" * 65)
    for srv in detail.get("servings", []):
        print(f"\nServing: {srv.get('serving_description')}")
        print(f"  - Calories:       {srv.get('calories')} kcal")
        print(f"  - Protein:        {srv.get('protein_g')} g")
        print(f"  - Carbohydrates:  {srv.get('carbs_g')} g")
        print(f"  - Total Fat:      {srv.get('fat_g')} g")
        if srv.get("sodium_mg"):
            print(f"  - Sodium:         {srv.get('sodium_mg')} mg")
        if srv.get("fiber_g"):
            print(f"  - Dietary Fiber:  {srv.get('fiber_g')} g")
        if srv.get("sugar_g"):
            print(f"  - Sugars:         {srv.get('sugar_g')} g")
    print("=" * 65 + "\n")

def main():
    parser = argparse.ArgumentParser(description="FatSecret Food Nutrition Search CLI")
    parser.add_argument("query", nargs="?", default=None, help="Food search query (e.g. 'ayam bakar', 'soto')")
    parser.add_argument("--id", type=int, default=None, help="Fetch detailed nutrition by FatSecret food ID")
    parser.add_argument("--max", type=int, default=10, help="Maximum number of results to display")
    parser.add_argument("--json", action="store_true", help="Output raw JSON data")
    args = parser.parse_args()

    svc = FatSecretService()
    configured = svc.is_configured()
    print(f"[*] FatSecret API Engine: {'ONLINE (OAuth 2.0 Credentials Configured)' if configured else 'FALLBACK (Verified FatSecret Indonesia Dataset)'}")

    if args.id:
        detail = svc.get_food_detail(args.id)
        if args.json:
            print(json.dumps(detail, indent=2))
        else:
            print_detail(detail)
        return

    query = args.query
    if not query:
        query = input("Enter food name to search in FatSecret (e.g. 'ayam bakar'): ").strip()
        if not query:
            print("No query provided. Exiting.")
            return

    results = svc.search_foods(query, max_results=args.max, region="ID", language="id")

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_table(results)

if __name__ == "__main__":
    main()
