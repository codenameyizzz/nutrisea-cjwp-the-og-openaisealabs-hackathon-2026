import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

logger = logging.getLogger(__name__)

connect_args = {}
engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True, # Automatically reconnect stale connections (vital for Aiven Cloud)
}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine_kwargs["connect_args"] = connect_args
else:
    # PostgreSQL / Aiven configuration
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    if settings.DB_SSL_REQUIRE and "sslmode" not in settings.DATABASE_URL:
        connect_args["sslmode"] = "require"
    if connect_args:
        engine_kwargs["connect_args"] = connect_args

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_all_tables():
    """
    Ensures all registered SQLAlchemy tables exist in the target database.
    Safe to call repeatedly (idempotent).
    """
    try:
        # Import models so they are registered with Base.metadata
        from .. import models  # noqa: F401
        # Ingredient and account-assignment DDL is provisioned only by SQL migrations.
        migration_only = {"ingredients", "ingredient_aliases", "menu_ingredients", "merchant_application"}
        Base.metadata.create_all(bind=engine, tables=[
            t for t in Base.metadata.sorted_tables if t.name not in migration_only
        ])
        logger.info("Successfully verified and initialized all database tables.")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        # In case tables already exist or permissions differ
        pass
