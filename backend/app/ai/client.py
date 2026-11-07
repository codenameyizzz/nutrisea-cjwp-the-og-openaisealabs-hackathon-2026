import os
import logging
from typing import Optional
from openai import OpenAI
from ..core.config import settings

logger = logging.getLogger(__name__)

def is_openai_configured() -> bool:
    """
    Checks if a real OpenAI/compatible API key has been supplied.
    """
    return settings.is_openai_configured

def get_openai_client() -> OpenAI:
    """
    Returns configured OpenAI client.
    If no valid key is set, returns client with placeholder key for inspection,
    while logging an informative warning.
    """
    api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
    base_url = settings.OPENAI_BASE_URL or os.getenv("OPENAI_BASE_URL", "")

    if not settings.is_openai_configured:
        logger.warning(
            "OPENAI_API_KEY is currently unset or using a placeholder. "
            "NutriGraph and AI modules will operate in Deterministic Clinical Mode."
        )

    kwargs = {"api_key": api_key if settings.is_openai_configured else "mock-key"}
    if base_url and str(base_url).strip():
        kwargs["base_url"] = str(base_url).strip()
    return OpenAI(**kwargs)
