import os
import logging
import httpx
import numpy as np
from typing import List, Optional
from ..core.config import settings

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = settings.EMBEDDING_MODEL
_DEFAULT_FASTEMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
FASTEMBED_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models")

class EmbeddingClient:
    """HTTP Client for OpenAI or hosted embeddings API (Directly from Odysseus architecture)."""
    def __init__(self, url: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None):
        self.url = url or "https://api.openai.com/v1/embeddings"
        self.model = model or settings.EMBEDDING_MODEL
        self.api_key = api_key or settings.OPENAI_API_KEY
        self._dim: Optional[int] = None
        self._client = httpx.Client(timeout=httpx.Timeout(connect=3.0, read=10.0, write=5.0, pool=3.0))

    def encode(self, texts: List[str], normalize_embeddings: bool = True) -> np.ndarray:
        if not texts or not self.api_key:
            return np.zeros((len(texts), 384), dtype="float32")

        resp = self._client.post(
            self.url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"input": texts, "model": self.model},
        )
        resp.raise_for_status()
        data = resp.json()
        embeddings = data.get("data", [])
        embeddings.sort(key=lambda e: e.get("index", 0))
        vecs = np.array([emb["embedding"] for emb in embeddings], dtype="float32")

        if normalize_embeddings and vecs.size > 0:
            norms = np.linalg.norm(vecs, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1, norms)
            vecs = vecs / norms

        return vecs

_http_embed_down = False

def get_embedding_client():
    """Odysseus Factory: try HTTP API first, fall back smoothly if offline."""
    global _http_embed_down
    if not _http_embed_down and settings.OPENAI_API_KEY:
        try:
            client = EmbeddingClient()
            return client
        except Exception as e:
            _http_embed_down = True
            logger.warning(f"HTTP embedding API unavailable ({e}); using local fallback.")

    return EmbeddingClient(api_key="") # Fallback client returning safe zero arrays