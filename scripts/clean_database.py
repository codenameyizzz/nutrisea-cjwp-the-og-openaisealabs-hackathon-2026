import sys
import os

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from app.core.database import engine

def clean_database():
    print("Connecting to Aiven Cloud PostgreSQL...")
    with engine.connect() as conn:
        # 1. Fetch all public tables
        query_tables = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = [r[0] for r in conn.execute(query_tables)]
        print(f"Found {len(tables)} tables: {tables}")

        print("\n--- Row counts BEFORE depopulation ---")
        for tbl in tables:
            cnt = conn.execute(text(f'SELECT COUNT(*) FROM "{tbl}"')).scalar()
            print(f"  {tbl}: {cnt} rows")

        # 2. Truncate all tables with CASCADE and RESTART IDENTITY
        if tables:
            tables_joined = ", ".join([f'"{t}"' for t in tables])
            truncate_sql = f"TRUNCATE TABLE {tables_joined} RESTART IDENTITY CASCADE;"
            print(f"\nExecuting: {truncate_sql}")
            conn.execute(text(truncate_sql))
            conn.commit()
            print("Truncate completed successfully.")

        print("\n--- Row counts AFTER depopulation ---")
        total_rows = 0
        for tbl in tables:
            cnt = conn.execute(text(f'SELECT COUNT(*) FROM "{tbl}"')).scalar()
            print(f"  {tbl}: {cnt} rows")
            total_rows += cnt

        if total_rows == 0:
            print("\n>>> DATABASE IS COMPLETELY CLEAN AND EMPTY (0 ROWS ACROSS ALL TABLES) <<<")
        else:
            print(f"\nWarning: {total_rows} remaining rows.")

    # Also clean local sqlite if present
    local_sqlite = os.path.join(backend_dir, "nutrisea.db")
    if os.path.exists(local_sqlite):
        try:
            os.remove(local_sqlite)
            print("Removed local temporary nutrisea.db")
        except Exception as e:
            print(f"Could not remove local sqlite: {e}")

if __name__ == "__main__":
    clean_database()
