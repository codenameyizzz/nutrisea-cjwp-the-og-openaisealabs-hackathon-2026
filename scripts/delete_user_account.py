"""
NutriSea Account Deletion Utility
Deletes a user account and all cascaded relations from both PostgreSQL and Clerk.

Usage:
    python scripts/delete_user_account.py [email_or_user_id]
Example:
    python scripts/delete_user_account.py williamnapitupulu96@gmail.com
"""

import sys
import os
import json
import urllib.request
import urllib.error
import urllib.parse

# Ensure utf-8 stdout on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Setup backend import path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_dir = os.path.join(project_root, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import SessionLocal
from app.db.models import (
    AppUser,
    HealthProfile,
    ChatMessage,
    UserActionLog,
    UserMemoryItem,
    Order,
    OrderItem,
    RewardLedger
)

DEFAULT_TARGET = "williamnapitupulu96@gmail.com"


def find_clerk_secret_key() -> str | None:
    """Find CLERK_SECRET_KEY from frontend or backend .env files."""
    env_candidates = [
        os.path.join(project_root, "frontend", ".env.local"),
        os.path.join(project_root, "frontend", ".env"),
        os.path.join(backend_dir, ".env"),
        os.path.join(project_root, ".env")
    ]

    for env_file in env_candidates:
        if os.path.exists(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("CLERK_SECRET_KEY="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val

    return os.environ.get("CLERK_SECRET_KEY")


def delete_from_postgresql(target: str) -> list[str]:
    """Delete user and all related records from PostgreSQL database."""
    print(f"\n[1/2] Connecting to PostgreSQL to locate '{target}'...")
    db = SessionLocal()
    deleted_ids = []

    try:
        # Check by email or ID
        users = []
        if target.startswith("user_"):
            u = db.query(AppUser).filter(AppUser.id == target).first()
            if u:
                users.append(u)
        else:
            users = db.query(AppUser).filter(AppUser.email.ilike(f"%{target}%")).all()

        if not users:
            print(f"  [-] No PostgreSQL records found matching '{target}'.")
            return deleted_ids

        for user in users:
            user_id = user.id
            deleted_ids.append(user_id)
            print(f"  [+] Found User in PostgreSQL: {user.name} ({user.email}) [ID: {user_id}]")

            # 1. Chat Messages
            chats_del = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
            print(f"      - Removed {chats_del} ChatMessage record(s)")

            # 2. Action Logs
            actions_del = db.query(UserActionLog).filter(UserActionLog.user_id == user_id).delete()
            print(f"      - Removed {actions_del} UserActionLog record(s)")

            # 3. User Memory Items
            mems_del = db.query(UserMemoryItem).filter(UserMemoryItem.user_id == user_id).delete()
            print(f"      - Removed {mems_del} UserMemoryItem record(s)")

            # 4. Health Profile
            hp_del = db.query(HealthProfile).filter(HealthProfile.user_id == user_id).delete()
            print(f"      - Removed {hp_del} HealthProfile record(s)")

            # 5. Reward Ledger
            rewards_del = db.query(RewardLedger).filter(RewardLedger.user_id == user_id).delete()
            print(f"      - Removed {rewards_del} RewardLedger record(s)")

            # 6. Orders & Order Items
            orders = db.query(Order).filter(Order.user_id == user_id).all()
            for ord_item in orders:
                db.query(OrderItem).filter(OrderItem.order_id == ord_item.id).delete()
            orders_del = db.query(Order).filter(Order.user_id == user_id).delete()
            print(f"      - Removed {orders_del} Order record(s)")

            # 7. AppUser
            db.delete(user)
            db.commit()
            print(f"  [OK] Successfully removed user {user_id} from PostgreSQL.")

    except Exception as e:
        db.rollback()
        print(f"  [!] Error deleting from PostgreSQL: {e}")
    finally:
        db.close()

    return deleted_ids


def delete_from_clerk(target: str, known_clerk_ids: list[str]) -> None:
    """Delete user from Clerk Authentication via Clerk REST API."""
    print(f"\n[2/2] Connecting to Clerk API to delete '{target}'...")
    secret_key = find_clerk_secret_key()

    if not secret_key:
        print("  [!] CLERK_SECRET_KEY not found in env files. Skipping Clerk API deletion.")
        return

    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    target_uids = set(known_clerk_ids)

    # If target is directly a clerk ID
    if target.startswith("user_"):
        target_uids.add(target)

    # Search Clerk by email address
    if "@" in target:
        search_url = f"https://api.clerk.com/v1/users?email_address={urllib.parse.quote(target)}"
        req = urllib.request.Request(search_url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                for u in data:
                    uid = u.get("id")
                    if uid:
                        target_uids.add(uid)
                        print(f"  [+] Found Clerk User by Email: {uid} ({u.get('first_name')} {u.get('last_name')})")
        except urllib.error.HTTPError as e:
            print(f"  [!] Clerk search failed: HTTP {e.code} - {e.read().decode()}")
        except Exception as e:
            print(f"  [!] Error searching Clerk: {e}")

    if not target_uids:
        print(f"  [-] No users found in Clerk for '{target}'.")
        return

    # Execute DELETE for each found user
    for uid in target_uids:
        del_url = f"https://api.clerk.com/v1/users/{uid}"
        req_del = urllib.request.Request(del_url, headers=headers, method="DELETE")
        try:
            with urllib.request.urlopen(req_del) as resp:
                res_data = json.loads(resp.read().decode())
                print(f"  [OK] Deleted {uid} from Clerk: {res_data}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"  [-] User {uid} does not exist in Clerk (already deleted).")
            else:
                print(f"  [!] Failed to delete {uid} from Clerk: HTTP {e.code} - {e.read().decode()}")
        except Exception as e:
            print(f"  [!] Error deleting {uid} from Clerk: {e}")


def main():
    target = sys.argv[1].strip() if len(sys.argv) > 1 else DEFAULT_TARGET
    print("=" * 65)
    print(f" NutriSea Account Deletion Tool")
    print(f" Target: {target}")
    print("=" * 65)

    pg_deleted = delete_from_postgresql(target)
    delete_from_clerk(target, pg_deleted)

    print("\n" + "=" * 65)
    print(" Cleanup complete. You can now register or test onboarding freshly.")
    print("=" * 65)


if __name__ == "__main__":
    main()
