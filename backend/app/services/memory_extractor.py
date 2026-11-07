"""
memory_extractor.py
Odysseus-inspired Background Long-Term Memory (LTM) Extraction for NutriSea.
Analyzes conversational turns to extract durable personal health/nutrition facts,
filters transient noise, avoids duplicates via token overlap, and persists to PostgreSQL (user_memory_item).
"""
import re
import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..core.config import settings
from ..ai.client import get_openai_client
from ..db import crud

logger = logging.getLogger(__name__)

EXTRACT_SYSTEM_PROMPT = """Anda adalah Memory Extraction Specialist untuk NutriSea Co-Pilot.
Analisis percakapan dan ekstrak HANYA fakta pribadi jangka panjang (durable facts) tentang kondisi kesehatan, preferensi diet, alergi, atau kebiasaan makan pengguna.

Contoh BAIK:
- Alergi terhadap seafood dan kacang.
- Memiliki riwayat GERD / asam lambung.
- Memilih kuah bening dan menghindari gorengan berlebih.
- Target defisit kalori untuk menurunkan berat badan.
- Kebiasaan pesanan: nasi setengah dan kuah santan dipisah.

Contoh BURUK (JANGAN diekstrak):
- Pertanyaan sesaat ("rekomendasi ayam bakar dong", "mau makan apa ya hari ini?")
- Reaksi singkat ("oke makasih", "keren")
- Hal yang dikatakan asisten AI, bukan pengguna.

Aturan:
- MAKSIMAL 2 fakta paling penting per percakapan.
- Setiap fakta harus 1 kalimat pendek (< 15 kata).
- Kategori yang valid: 'restriction', 'condition', 'preference', 'habit', 'goal', 'fact'.
- Kembalikan HANYA array JSON objek dengan field: "text" dan "category". Tanpa markdown fences.
"""

def _clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip(" .,!?:;\"'`“”‘’")

def _is_text_duplicate(candidate: str, existing_facts: List[str], threshold: float = 0.65) -> bool:
    """
    Token-based Jaccard similarity check inspired by Odysseus _is_text_duplicate.
    Prevents duplicate or rephrased memories from polluting long-term memory.
    """
    c_tokens = set(re.findall(r"\w+", candidate.lower()))
    if not c_tokens:
        return True

    for ex in existing_facts:
        ex_tokens = set(re.findall(r"\w+", ex.lower()))
        if not ex_tokens:
            continue
        # Exact match or substring
        if candidate.lower() in ex.lower() or ex.lower() in candidate.lower():
            return True
        intersection = c_tokens & ex_tokens
        union = c_tokens | ex_tokens
        if union and (len(intersection) / len(union)) >= threshold:
            return True
    return False

def extract_fallback_candidates(messages):
    from .explicit_preferences import parse_preference
    result = []
    for message in messages:
        if message.get("role") != "user": continue
        parsed = parse_preference(message.get("content", ""))
        if parsed:
            food, excluded = parsed
            result.append({"text": f"{'Tidak suka' if excluded else 'Suka'} {food}.", "category": "preference"})
    return result


def extract_and_store_memories(user_id, messages):
    # Durable writes belong to validated proposals and explicit confirmation.
    return extract_fallback_candidates(messages)
