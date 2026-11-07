"""Run tests in a subprocess that cannot load backend/.env or connect to PostgreSQL.

Usage: python scripts/run_backend_tests.py [test_ingredients.py]
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="nutrisea-tests-") as temp:
    env = os.environ.copy()
    env.update({
        "NUTRISEA_TESTING": "1", "DATABASE_URL": "sqlite:///" + (Path(temp) / "tests.sqlite3").as_posix(),
        "AUTO_CREATE_TABLES": "false", "OPENAI_API_KEY": "", "OPENAI_BASE_URL": "",
        "FATSECRET_CLIENT_ID": "", "FATSECRET_CLIENT_SECRET": "",
        "FATSECRET_CONSUMER_KEY": "", "FATSECRET_CONSUMER_SECRET": "",
        "PYTHONPATH": os.pathsep.join([str(root / ".test-deps"), str(root)]),
        "PYTHONIOENCODING": "utf-8",
    })
    # Some legacy tests call API endpoints before their own setUpClass provisions
    # tables. Bootstrap only the isolated SQLite schema, never a SQL migration.
    bootstrap = """
import sys, unittest
from backend.app.core.config import settings
assert settings.DATABASE_URL.startswith('sqlite:///')
from backend.app.core.database import create_all_tables
create_all_tables()
suite = unittest.defaultTestLoader.discover('backend/tests', pattern=sys.argv[1])
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(not result.wasSuccessful())
"""
    result = subprocess.run([sys.executable, "-c", bootstrap,
                             sys.argv[1] if len(sys.argv) > 1 else "test_*.py"], cwd=root, env=env)
    raise SystemExit(result.returncode)
