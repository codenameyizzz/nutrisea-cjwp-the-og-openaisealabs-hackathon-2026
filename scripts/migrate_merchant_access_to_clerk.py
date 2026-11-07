"""Publish approved memberships to Clerk; defaults to preview, use --apply.

Legacy database roles and unsafe metadata are never migrated.
"""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from backend.app.core.database import SessionLocal
from backend.app.core.ingredient_auth import grant_merchant_access
from backend.app.models.merchant_application import MerchantApplication


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        assignments = db.execute(select(MerchantApplication.user_id, MerchantApplication.merchant_id).where(
            MerchantApplication.status == "APPROVED", MerchantApplication.merchant_id.is_not(None))).all()
    for user_id, merchant_id in assignments:
        if not user_id.startswith("user_"):
            raise SystemExit("Assignment is not a Clerk account; migration stopped")
        print(f"{user_id}: MERCHANT_ADMIN / {merchant_id}")
        if args.apply:
            grant_merchant_access(user_id, merchant_id)
    print(f"{'Published' if args.apply else 'Previewed'} {len(assignments)} assignment(s). Refresh Clerk sessions after applying.")


if __name__ == "__main__":
    main()
