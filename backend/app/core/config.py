import os
import json
from typing import Union, List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
TESTING = os.getenv("NUTRISEA_TESTING") == "1"
if os.path.exists(ENV_PATH) and not TESTING:
    load_dotenv(ENV_PATH, override=True)

PG_CONNECT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "pgConnect.json")

def get_aiven_url_from_pgconnect() -> Optional[str]:
    """
    Reads backend/pgConnect.json and combines with AIVEN_PG_PASSWORD / PGPASSWORD if present.
    """
    pwd = os.getenv("AIVEN_PG_PASSWORD") or os.getenv("PGPASSWORD")
    if not pwd or not os.path.exists(PG_CONNECT_PATH):
        return None
    try:
        with open(PG_CONNECT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            servers = data.get("Servers", {})
            for _, srv in servers.items():
                host = srv.get("Host")
                port = srv.get("Port", 18968)
                user = srv.get("Username", "avnadmin")
                db = srv.get("MaintenanceDB", "defaultdb")
                sslmode = srv.get("SSLMode", "require")
                if host:
                    return f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}?sslmode={sslmode}"
    except Exception:
        pass
    return None

class Settings(BaseSettings):
    AUTO_CREATE_TABLES: bool = False
    CLERK_ISSUER: str = ""
    CLERK_SECRET_KEY: str = ""
    CLERK_AUDIENCE: str = ""
    CLERK_AUTHORIZED_PARTIES: str = "http://localhost:3000,http://127.0.0.1:3000"
    APP_NAME: str = "NutriSea AI Core"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    OPENAI_MINI_MODEL: str = os.getenv("OPENAI_MINI_MODEL", "gpt-4o-mini")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    DATABASE_URL: str = os.getenv("DATABASE_URL") or get_aiven_url_from_pgconnect() or "sqlite:///./nutrisea.db"
    DB_SSL_REQUIRE: bool = os.getenv("DB_SSL_REQUIRE", "true").lower() in ("true", "1", "yes")
    FATSECRET_CLIENT_ID: str = os.getenv("FATSECRET_CLIENT_ID") or os.getenv("FATSECRET_CONSUMER_KEY", "")
    FATSECRET_CLIENT_SECRET: str = os.getenv("FATSECRET_CLIENT_SECRET") or os.getenv("FATSECRET_CONSUMER_SECRET", "")
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    @property
    def is_openai_configured(self) -> bool:
        """
        Returns True if a real OpenAI/Gemini API key is configured.
        Returns False if missing or set to placeholder string.
        """
        key = (self.OPENAI_API_KEY or "").strip()
        invalid_keys = [
            "",
            "mock-key",
            "your_openai_api_key_here",
            "your_google_ai_or_openai_api_key_here",
            "sk-placeholder",
            "none"
        ]
        if not key or key.lower() in invalid_keys or key.startswith("AIzaSy..."):
            return False
        return True

    @field_validator("DATABASE_URL", mode="before")
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            # Normalize postgres:// to postgresql+psycopg2:// for SQLAlchemy 2.0 compatibility
            if v.startswith("postgres://"):
                v = "postgresql+psycopg2://" + v[len("postgres://"):]
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                v = "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    class Config:
        env_file = None if TESTING else (ENV_PATH if os.path.exists(ENV_PATH) else ".env")
        extra = "allow"

settings = Settings()
if TESTING and not settings.DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("Tests must use an isolated SQLite database")
