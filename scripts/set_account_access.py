"""Operator-only role assignment; never infer ownership from legacy role choices.

Example: python scripts/set_account_access.py --user-id user_... --role MERCHANT_ADMIN --merchant-id MTR-...
"""
import argparse
from pathlib import Path
import sys
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from sqlalchemy import select
from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.models import Merchant


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--role", required=True, choices=["CONSUMER", "MERCHANT_ADMIN", "SHOPEE_ADMIN"])
    parser.add_argument("--merchant-id", action="append", default=[])
    args = parser.parse_args()
    if not args.user_id.startswith("user_"):
        parser.error("Expected a Clerk user ID")
    if (args.role == "MERCHANT_ADMIN") != bool(args.merchant_id):
        parser.error("Only MERCHANT_ADMIN requires one or more --merchant-id values")
    if not settings.CLERK_SECRET_KEY:
        parser.error("Configure backend CLERK_SECRET_KEY first")
    ids = list(dict.fromkeys(args.merchant_id))
    if ids:
        with SessionLocal() as db:
            existing = set(db.scalars(select(Merchant.id).where(Merchant.id.in_(ids))))
        if set(ids) != existing:
            parser.error("Unknown merchant ID; assignment was not changed")
    headers = {"Authorization": "Bearer " + settings.CLERK_SECRET_KEY}
    url = "https://api.clerk.com/v1/users/" + quote(args.user_id, safe="")
    with httpx.Client(headers=headers, timeout=15) as client:
        # Reading the user first ensures this ID belongs to the configured instance.
        response = client.get(url)
        response.raise_for_status()
        if response.json().get("id") != args.user_id:
            raise SystemExit("Clerk account mismatch; assignment was not changed")
        response = client.patch(url + "/metadata", json={"public_metadata": {
            "role": args.role, "merchant_ids": ids,
        }})
        response.raise_for_status()
    print("Account access assigned. Refresh the application to update available views.")


if __name__ == "__main__":
    main()
