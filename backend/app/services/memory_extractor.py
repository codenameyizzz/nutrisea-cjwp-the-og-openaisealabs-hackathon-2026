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

def extract_fallback_candidates(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Heuristic fact extractor for Indonesian clinical nutrition and dining preferences.
    Guarantees reliable durable memory extraction even without LLM calls.
    """
    candidates = []
    seen = set()

    def add_fact(text: str, category: str):
        cleaned = _clean_text(text)
        if not cleaned:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        candidates.append({"text": cleaned, "category": category})

    for msg in messages:
        if msg.get("role") != "user":
            continue
        text = msg.get("content", "").strip()
        if not text:
            continue
        lower = text.lower()

        # 1. Allergies & Intolerances
        m = re.search(r"\b(?:alergi|intoleran(?:\s+terhadap)?)\s+([a-zA-Z0-9\s,]{3,40})", text, re.I)
        if m:
            item = _clean_text(m.group(1))
            add_fact(f"Alergi terhadap {item}.", "restriction")

        # 2. Strict Dietary Restrictions / Avoidances
        if re.search(r"\b(?:tidak\s+bisa\s+makan|tidak\s+makan|pantang|pantangan)\s+pedas\b", text, re.I):
            add_fact("Pantang makanan pedas (sensitif lambung/cabai).", "restriction")
        if re.search(r"\b(?:tidak\s+bisa\s+makan|tidak\s+makan|pantang)\s+santan\b", text, re.I):
            add_fact("Pantang kuah santan kental.", "restriction")
        if re.search(r"\b(?:vegetarian|vegan)\b", text, re.I):
            add_fact("Menerapkan pola makan vegetarian / bebas daging.", "restriction")
        if re.search(r"\b(?:halal\s+only|harus\s+halal|hanya\s+makanan\s+halal)\b", text, re.I):
            add_fact("Hanya mengonsumsi makanan bersertifikasi halal.", "restriction")

        # 3. Medical Conditions
        if re.search(r"\b(?:maag|gerd|asam\s+lambung)\b", text, re.I):
            add_fact("Memiliki riwayat penyakit asam lambung / GERD / gastritis.", "condition")
        if re.search(r"\b(?:hipertensi|darah\s+tinggi)\b", text, re.I):
            add_fact("Memiliki riwayat hipertensi (perlu batasan natrium).", "condition")
        if re.search(r"\b(?:diabetes|gula\s+darah\s+tinggi)\b", text, re.I):
            add_fact("Memiliki riwayat diabetes (perlu batasan gula & karbohidrat).", "condition")
        if re.search(r"\b(?:asam\s+urat)\b", text, re.I):
            add_fact("Memiliki riwayat asam urat (hindari jeroan dan emping).", "condition")
        if re.search(r"\b(?:kolesterol\s+tinggi)\b", text, re.I):
            add_fact("Memiliki riwayat kolesterol tinggi (hindari lemak jenuh & gorengan).", "condition")

        # 4. Habits & Kitchen Customizations
        if re.search(r"\b(?:nasi\s+setengah|setengah\s+porsi\s+nasi)\b", text, re.I):
            add_fact("Kebiasaan pesanan: nasi setengah porsi.", "habit")
        if re.search(r"\b(?:kuah\s+(?:santan\s+)?dipisah|kuah\s+pisah)\b", text, re.I):
            add_fact("Kebiasaan pesanan: kuah dipisah dari lauk utama.", "habit")
        if re.search(r"\b(?:sedikit\s+minyak|tanpa\s+minyak|minyak\s+sedikit)\b", text, re.I):
            add_fact("Kebiasaan pesanan: minta sedikit minyak / tanpa minyak.", "habit")

        # 5. Preferences
        m_pref = re.search(r"\b(?:saya\s+suka|lebih\s+suka|favorit\s+saya)\s+([a-zA-Z0-9\s]{3,35})", text, re.I)
        if m_pref:
            fav = _clean_text(m_pref.group(1))
            if not any(skip in fav.lower() for skip in ["makan", "hari", "apa", "menu"]):
                add_fact(f"Preferensi rasa/makanan: menyukai {fav}.", "preference")

        # 6. Goals & Budgets
        if re.search(r"\b(?:turun\s+berat\s+badan|defisit\s+kalori|diet\s+turun\s+bb)\b", text, re.I):
            add_fact("Target kesehatan: defisit kalori untuk menurunkan berat badan.", "goal")
        if re.search(r"\b(?:naik\s+massa\s+otot|bulking|tinggi\s+protein)\b", text, re.I):
            add_fact("Target kesehatan: tinggi protein untuk pembentukan massa otot.", "goal")
        m_budget = re.search(r"\bbudget\s+(?:makan\s+)?(?:maksimal\s+)?(?:rp\s*)?([0-9]{2,3})\s*(?:rb|ribu)\b", text, re.I)
        if m_budget:
            nominal = m_budget.group(1)
            add_fact(f"Target budget makan siang: maksimal Rp {nominal}.000 per porsi.", "goal")

    return candidates

def extract_and_store_memories(user_id: str, messages: List[Dict[str, str]]):
    """
    Background worker function that runs after each chat interaction.
    Extracts candidate memories via LLM (if available) and robust heuristic matchers,
    deduplicates against existing LTM entries in PostgreSQL, and persists worthy facts.
    """
    if not user_id or not messages:
        return

    logger.info(f"[LTM Background Extractor] Running extraction for user {user_id} on {len(messages)} messages")
    
    # 1. Heuristic candidates
    candidate_facts = extract_fallback_candidates(messages)

    # 2. LLM candidates (if configured)
    if settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("mock"):
        try:
            client = get_openai_client()
            user_texts = [m["content"] for m in messages if m.get("role") == "user"]
            if user_texts:
                combined_user_text = "\n".join(user_texts[-4:])
                res = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": EXTRACT_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Percakapan pengguna:\n{combined_user_text}"}
                    ],
                    temperature=0.1,
                    max_tokens=250
                )
                raw_text = res.choices[0].message.content.strip()
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                parsed = json.loads(raw_text)
                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, dict) and item.get("text"):
                            candidate_facts.append({
                                "text": _clean_text(item["text"]),
                                "category": item.get("category", "fact")
                            })
        except Exception as e:
            logger.debug(f"[LTM Background Extractor] LLM extraction pass skipped or errored: {e}")

    if not candidate_facts:
        logger.info("[LTM Background Extractor] No durable candidate facts found in this conversation.")
        return

    # 3. Deduplicate and Persist to PostgreSQL
    db: Session = SessionLocal()
    try:
        existing_memories = crud.get_user_memories(db, user_id)
        existing_texts = [m.fact_text for m in existing_memories]

        persisted_count = 0
        for cand in candidate_facts:
            text = cand["text"]
            category = cand.get("category", "fact")
            if len(text) < 5 or len(text.split()) > 20:
                continue

            if _is_text_duplicate(text, existing_texts):
                logger.info(f"[LTM Background Extractor] Dedup skipped: '{text}' already known.")
                continue

            # Persist worthy fact
            crud.save_user_memory(
                db=db,
                user_id=user_id,
                category=category,
                fact_text=text,
                confidence=0.92,
                source="chat_interaction"
            )
            existing_texts.append(text)
            persisted_count += 1
            logger.info(f"[LTM Background Extractor] Successfully learned new LTM: [{category}] {text}")

        logger.info(f"[LTM Background Extractor] Completed. Learned {persisted_count} new facts for user {user_id}.")
    except Exception as e:
        logger.error(f"[LTM Background Extractor] Failed to persist memory items: {e}")
    finally:
        db.close()
