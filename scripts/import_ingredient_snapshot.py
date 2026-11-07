"""Append a reviewed SQLite ingredient snapshot. Default: read-only dry run.

python scripts/import_ingredient_snapshot.py --source ingredients.db
python scripts/import_ingredient_snapshot.py --source ingredients.db --apply --create-source-tables --expected-sha256 <reviewed-hash>

No UPDATE, DELETE, recipe creation, or menu-nutrition writes are performed.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / ".test-deps"), str(ROOT)]
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool
from backend.app.core.config import settings
from backend.app.services.ingredient_import import (
    read_source, read_existing, make_plan, apply_plan, assert_existing_preserved,
)


def run(args):
    source = read_source(args.source)
    if args.expected_sha256 and args.expected_sha256 != source["batch_sha256"]:
        raise ValueError("Source changed since the reviewed dry run")
    connect_args = {"connect_timeout": 10}
    if settings.DB_SSL_REQUIRE and "sslmode" not in settings.DATABASE_URL:
        connect_args["sslmode"] = "require"
    engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, poolclass=NullPool)
    if engine.dialect.name != "postgresql":
        raise ValueError("This operational CLI expects PostgreSQL; unit tests use the import service directly")
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    # Ensure the audit destination is writable before a database mutation.
    pending_path = report_path.with_suffix(report_path.suffix + ".pending")
    pending_path.write_text(json.dumps({"status":"started", "batch_sha256":source["batch_sha256"]}), encoding="utf-8")
    with engine.begin() as connection:
        if not args.apply:
            connection.execute(text("SET TRANSACTION READ ONLY"))
        connection.execute(text("SET LOCAL lock_timeout = '5s'"))
        connection.execute(text("SET LOCAL statement_timeout = '30s'"))
        if args.apply:
            # Coordinates importer runs; table locks also prevent concurrent catalog edits.
            connection.execute(text("SELECT pg_advisory_xact_lock(726431908)"))
            if args.create_source_tables:
                migration = ROOT / "backend/migrations/004_ingredient_sources.sql"
                connection.exec_driver_sql(migration.read_text(encoding="utf-8"))
            names = set(inspect(connection).get_table_names())
            if not {"ingredient_source_foods", "ingredient_source_servings"}.issubset(names):
                raise ValueError("Source schema missing: review migration 004 and use --create-source-tables")
            connection.execute(text("LOCK TABLE ingredients, ingredient_aliases, ingredient_source_foods, ingredient_source_servings IN SHARE ROW EXCLUSIVE MODE"))
        before = read_existing(connection)
        plan = make_plan(source, before)
        report = {k:v for k,v in plan.items() if k != "rows"}
        report.update({"mode": "apply" if args.apply else "dry_run", "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                       "before_counts": {k:len(v) for k,v in before.items()},
                       "planned_ingredient_names": [r["name"] for r in plan["rows"]["ingredients"]]})
        if args.apply:
            if plan["conflicts"]:
                raise ValueError("Source conflicts found; existing data preserved, import aborted")
            apply_plan(connection, plan)
            after = read_existing(connection)
            assert_existing_preserved(before, after)
            for table, count in plan["insert_counts"].items():
                if len(after[table]) != len(before[table]) + count:
                    raise RuntimeError("Unexpected row count; rolling back")
            report["after_counts"] = {k:len(v) for k,v in after.items()}
            report["existing_rows_preserved"] = True
            report["inserted_keys"] = {table: [r.get("id", r.get("source_key")) for r in rows]
                                       for table,rows in plan["rows"].items()}
        report["status"] = "verified_pending_commit" if args.apply else "dry_run_complete"
        pending_path.write_text(json.dumps(report,ensure_ascii=False,indent=2), encoding="utf-8")
    report["status"] = "committed" if args.apply else "dry_run_complete"
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n", encoding="utf-8")
    pending_path.unlink()
    print(json.dumps({k:v for k,v in report.items() if k not in ("inserted_keys", "planned_ingredient_names")},ensure_ascii=True,indent=2))
    print("Audit report:", report_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "ingredients.db")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--create-source-tables", action="store_true")
    parser.add_argument("--expected-sha256")
    parser.add_argument("--report", default=str(ROOT / "docs/ingredient-import-plan.json"))
    args = parser.parse_args()
    if args.create_source_tables and not args.apply:
        parser.error("--create-source-tables requires --apply")
    if args.apply and not args.expected_sha256:
        parser.error("--apply requires --expected-sha256 from a reviewed dry run")
    try:
        run(args)
    except Exception as error:
        # Do not print connection strings or bound database values.
        print("Import did not complete:", type(error).__name__, file=sys.stderr)
        diagnostic = str(getattr(error, "orig", error)).lower()
        if "remaining connection slots" in diagnostic or "too many clients" in diagnostic:
            print("Aiven connection slots are full; no import was committed.", file=sys.stderr)
        elif "timeout" in diagnostic:
            print("Database connection or query timed out.", file=sys.stderr)
        elif "could not translate host name" in diagnostic:
            print("Database hostname could not be resolved.", file=sys.stderr)
        if isinstance(error, (ValueError, RuntimeError)):
            print(str(error), file=sys.stderr)
        raise SystemExit(1)
