import os
import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..core.config import settings
from ..core.database import get_db
from ..ai.client import get_openai_client
from ..db import crud
from ..db.models import ChatMessage as DBChatMessage
from ..services.memory_extractor import extract_and_store_memories
from ..services.knowledge_graph import nutrigraph_engine

router = APIRouter(prefix="/api/ai", tags=["AI Co-Pilot"])
logger = logging.getLogger(__name__)

def is_api_key_configured() -> bool:
    key = settings.OPENAI_API_KEY or ""
    if not key or "your_google_ai" in key or "..." in key or key.startswith("mock"):
        return False
    return True

class ChatMessageItem(BaseModel):
    role: str
    content: str

class ChatConsultRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    history: Optional[List[ChatMessageItem]] = []
    dish_context: Optional[str] = None
    user_bmi_stats: Optional[Dict[str, Any]] = None

def load_catalog_summary() -> str:
    catalog_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "seed_catalog.json")
    if os.path.exists(catalog_path):
        with open(catalog_path, "r", encoding="utf-8") as f:
            items = json.load(f)
            summary = []
            for item in items[:15]:
                personas_sample = ", ".join(item.get("matched_personas", [])[:3])
                summary.append(
                    f"- {item.get('item_name')} di '{item.get('merchant_name')}' (Rp {item.get('discounted_price'):,}): "
                    f"{item.get('estimated_macros', {}).get('kcal', 0)} kcal, {item.get('estimated_macros', {}).get('protein_g', 0)}g protein. "
                    f"Personas: [{personas_sample}]. Catatan masak: {item.get('default_cooking_notes', '-')}"
                )
            return "\n".join(summary)
    return ""

@router.get("/history/{user_id}")
def get_user_chat_history(user_id: str, db: Session = Depends(get_db)):
    """
    Returns user chat history stored in PostgreSQL.
    """
    history = (
        db.query(DBChatMessage)
        .filter(DBChatMessage.user_id == user_id)
        .order_by(DBChatMessage.created_at.asc())
        .limit(50)
        .all()
    )
    return {
        "user_id": user_id,
        "count": len(history),
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "dish_context": msg.dish_context,
                "model_used": msg.model_used,
                "created_at": msg.created_at.isoformat()
            }
            for msg in history
        ]
    }

def format_persona_context(db: Session, user_id: str) -> str:
    """
    Fetches the user's Main Persona and 3 Side Personas from PostgreSQL
    and constructs a detailed clinical context describing their meaning,
    targets, restrictions, and behavioral pain points.
    """
    user = crud.get_user(db, user_id)
    main_persona_id = user.main_persona_id if user and user.main_persona_id else None
    side_persona_ids = user.side_persona_ids if user and user.side_persona_ids else []

    # Fallback to direct persona match or default seed persona
    if not main_persona_id:
        p_direct = crud.get_persona(db, user_id)
        if p_direct:
            main_persona_id = p_direct.id
        else:
            main_persona_id = "BUDG_FACHRI_MENTENG_115"
            side_persona_ids = ["BUDG_HANA_MENTENG_096", "PREV_ADITYA_KUNINGAN_088", "CORP_ALVIN_SENAYAN_042"]

    main_persona = crud.get_persona(db, main_persona_id)
    side_personas = crud.get_personas_by_ids(db, side_persona_ids)

    lines = ["=== PROFIL PERSONA PENGGUNA & ARTI KLINIS ==="]
    if main_persona:
        lines.append(f"1. PERSONA UTAMA: {main_persona.full_name} ({main_persona.id})")
        lines.append(f"   - Arketipe: {main_persona.archetype_name} ({main_persona.archetype_code})")
        lines.append(f"   - Pekerjaan & Wilayah: {main_persona.occupation} di {main_persona.work_district}")
        lines.append(f"   - Target Kalori Harian: {main_persona.daily_caloric_target_kcal} kcal (Target Makan Siang: {main_persona.target_lunch_kcal} kcal)")
        lines.append(f"   - Target Budget Makan Siang: Rp {main_persona.target_lunch_budget_idr:,}")
        lines.append(f"   - Tujuan Kesehatan: {main_persona.health_goal}")
        lines.append(f"   - Kondisi Medis & Alergi: Kondisi: {main_persona.medical_conditions} | Alergi: {main_persona.allergens}")
        lines.append(f"   - Preferensi Tag Kuliner: {main_persona.preferred_tags}")
        lines.append(f"   - Job Fungsional: {main_persona.primary_functional_job}")
        lines.append(f"   - Pain Point Utama: {main_persona.biggest_pain_point}")
        lines.append(
            f"   - ARTI KLINIS PERSONA UTAMA: Pengguna memprioritaskan asupan gizi yang sesuai dengan arketipe '{main_persona.archetype_name}'. "
            f"Setiap saran makanan harus menghormati target batas makan siang ~{main_persona.target_lunch_kcal} kcal "
            f"dan anggaran terjangkau maksimal Rp {main_persona.target_lunch_budget_idr:,}. "
            f"Hindari makanan yang memperparah '{main_persona.medical_conditions}'."
        )

    if side_personas:
        lines.append("\n2. PERSONA PENDAMPING ADAPTIF (SIDE PERSONAS):")
        for idx, sp in enumerate(side_personas, 1):
            lines.append(
                f"   ({idx}) {sp.full_name} ({sp.archetype_name}) - "
                f"Target Siang: {sp.target_lunch_kcal} kcal, Budget: Rp {sp.target_lunch_budget_idr:,}, "
                f"Tag: {sp.preferred_tags}"
            )
        lines.append(
            "   - ARTI KLINIS SIDE PERSONAS: Pengguna memiliki kebutuhan kontekstual sekunder "
            "(misal lembur kerja, olahraga akhir pekan, atau pemulihan lambung). Rekomendasi alternatif dapat mengambil inspirasi dari arketipe pendamping ini."
        )

    return "\n".join(lines)

def format_short_term_memory(db: Session, user_id: str, limit: int = 12) -> str:
    """
    Extracts recent user interactions (clicks, searches, adds to cart)
    including menu item personas from Short-Term Memory (PostgreSQL).
    """
    actions = crud.get_user_recent_actions(db, user_id, limit=limit)
    if not actions:
        return "=== SHORT-TERM MEMORY (Aktivitas Terkini) ===\n(Belum ada riwayat aktivitas dalam sesi ini)"

    lines = ["=== SHORT-TERM MEMORY (Aktivitas Terkini Pengguna) ==="]
    lines.append("Berikut adalah tindakan nyata yang baru saja dilakukan pengguna dalam sesi ini:")

    for act in actions:
        p = act.payload or {}
        time_str = act.created_at.strftime("%H:%M") if hasattr(act, "created_at") and act.created_at else "-"
        act_type = act.action_type

        if act_type == "CLICK_MENU_ITEM":
            item_name = p.get("item_name") or p.get("name") or "Menu"
            merchant = p.get("merchant_name") or "Resto"
            price = p.get("price") or p.get("discountedPrice") or 0
            kcal = p.get("macros", {}).get("kcal") or p.get("kcal") or 0
            personas = p.get("personas") or p.get("matchedPersonas") or []
            personas_str = ", ".join(personas[:4]) if personas else "Umum"
            lines.append(f"- [{time_str}] Melihat Menu: '{item_name}' di '{merchant}' (Rp {price:,}, {kcal} kcal) | Personas Menu: [{personas_str}]")

        elif act_type == "SEARCH_QUERY":
            q = p.get("query") or "-"
            lines.append(f"- [{time_str}] Mencari Menu di Pencarian: '{q}'")

        elif act_type == "ADD_TO_CART":
            item_name = p.get("item_name") or p.get("name") or "Menu"
            qty = p.get("qty", 1)
            personas = p.get("personas") or p.get("matchedPersonas") or []
            personas_str = ", ".join(personas[:3]) if personas else "Umum"
            lines.append(f"- [{time_str}] Menambahkan ke Keranjang: '{item_name}' (Qty: {qty}) | Personas: [{personas_str}]")

        elif act_type == "VIEW_DETAILS":
            item_name = p.get("item_name") or p.get("name") or "Menu"
            lines.append(f"- [{time_str}] Membuka Halaman Detail Nutrisi: '{item_name}'")

        else:
            lines.append(f"- [{time_str}] {act_type}: {p}")

    lines.append(
        "\nINSTRUKSI SHORT-TERM MEMORY:\n"
        "Perhatikan apa yang baru saja dicari atau diklik pengguna. Jika relevan dengan pertanyaan mereka, "
        "sebutkan secara alami (misal: 'Saya lihat Anda baru saja mencari menu Soto Ayam...' atau 'Terkait Paket Nasi Merah yang Anda lihat tadi...'). "
        "Pertimbangkan juga personas dari menu yang diminati tersebut."
    )
    return "\n".join(lines)

def format_long_term_memory(db: Session, user_id: str) -> str:
    """
    Extracts durable learned facts (allergies, health conditions, taste preferences, habits)
    from Long-Term Memory (PostgreSQL user_memory_item).
    """
    memories = crud.get_user_memories(db, user_id)
    if not memories:
        return "=== LONG-TERM MEMORY (Fakta Jangka Panjang Pengguna) ===\n(Belum ada catatan memori jangka panjang)"

    lines = ["=== LONG-TERM MEMORY (Fakta Jangka Panjang yang Dipelajari Sistem) ==="]
    for mem in memories:
        cat_badge = mem.category.upper()
        lines.append(f"- [{cat_badge}] {mem.fact_text} (Keyakinan: {int(float(mem.confidence)*100)}%)")

    lines.append(
        "\nINSTRUKSI LONG-TERM MEMORY:\n"
        "Fakta-fakta di atas bersifat persisten dan telah diverifikasi dari riwayat percakapan/pesanan sebelumnya. "
        "Patuhi pantangan, alergi, dan kebiasaan pesanan di atas secara KETAT dalam setiap saran yang Anda berikan."
    )
    return "\n".join(lines)

def format_nutrigraph_guardrails(
    user_id: str,
    dish_context: Optional[str] = None,
    user_message: Optional[str] = None
) -> str:
    """
    Constructs deterministic Knowledge Graph clinical guardrails and proof chains
    grounded in Perkeni, PERKI, and PGI Indonesian medical consensus.
    """
    resolved_pid = nutrigraph_engine.resolve_persona_id(user_id)
    persona_data = nutrigraph_engine.graph.nodes.get(f"PERSONA:{resolved_pid}", {})

    # Check if a specific dish is being inspected or mentioned
    target_dish = None
    if dish_context:
        target_dish = dish_context
    elif user_message:
        msg_lower = user_message.lower()
        for fid, fmeta in nutrigraph_engine.foods.items():
            fname = (fmeta.get("name") or "").lower()
            if fname and (fname in msg_lower or any(word in msg_lower for word in fname.split() if len(word) > 4)):
                target_dish = fid
                break

    lines = ["=== BUKTI KLINIS KNOWLEDGE GRAPH (NutriGraph Multi-Hop Guardrails) ==="]
    if target_dish:
        resolved_fid = nutrigraph_engine.resolve_dish_id(target_dish)
        exp = nutrigraph_engine.explain_recommendation(resolved_pid, resolved_fid)
        status_label = "✅ AMAN DIKONSUMSI (SAFE)" if exp["is_safe"] else f"⚠️ KONTRAINDIKASI KLINIS ({exp['severity']})"
        lines.append(f"1. Menu Diuji: {exp['food_name']} ({exp['food_id']})")
        lines.append(f"   - Status Keamanan Klinis: {status_label}")
        lines.append(f"   - Estimasi Kalori: {exp['dish_kcal']} kcal (Target Persona: {exp['target_kcal']} kcal, Delta: {exp['kcal_delta']:+} kcal)")
        lines.append(f"   - Pedoman Medis Terkait: {', '.join(exp['clinical_citations'])}")
        lines.append(f"   - Analisis Multi-Hop: {exp['explanation_narrative']}")

        if exp.get("path_evidence"):
            paths_str = " | ".join([" ➔ ".join(p) for p in exp["path_evidence"][:3]])
            lines.append(f"   - Bukti Traversal Graf: {paths_str}")
    else:
        # Provide top graph-verified safe candidate dishes for this persona
        safe_dishes = nutrigraph_engine.recommend_safe_dishes(resolved_pid, top_k=3)
        lines.append(f"Persona Terverifikasi: {persona_data.get('name', resolved_pid)} ({persona_data.get('archetype', '-')})")
        lines.append("Menu Terverifikasi Lolos 100% Multi-Hop Guardrail Klinis:")
        for idx, sd in enumerate(safe_dishes, 1):
            lines.append(
                f"   ({idx}) {sd['name']} (Rp {int(sd['price_idr']):,}, {sd['calories']} kcal, Skor: {sd['recommendation_score']}%)"
                f" - {sd.get('clinical_rationale', 'Terverifikasi secara klinis.')}"
            )

    lines.append(
        "\nINSTRUKSI NUTRI GRAPH GUARDRAILS:\n"
        "Gunakan bukti klinis di atas sebagai acuan validasi medis deterministik tanpa halusinasi. "
        "Jika menu berstatus KONTRAINDIKASI, beritahu pengguna secara bijak alasan fisiologisnya dan tawarkan alternatif yang aman. "
        "Sebutkan pedoman klinis resmi (Perkeni / PERKI / PGI) bila relevan."
    )
    return "\n".join(lines)

def generate_dynamic_fallback_reply(
    db: Session,
    user_id: Optional[str],
    message: str,
    dish_context: Optional[str] = None
) -> str:
    """
    Generates a personalized, clinical nutrition response synthesizing
    the user's Personas, Short-Term Memory actions, Long-Term Memory facts,
    and deterministic Knowledge Graph proof chains.
    """
    user = crud.get_user(db, user_id) if user_id else None
    main_persona_id = user.main_persona_id if user and user.main_persona_id else "BUDG_FACHRI_MENTENG_115"
    persona = crud.get_persona(db, main_persona_id)

    resolved_pid = nutrigraph_engine.resolve_persona_id(user_id or main_persona_id)
    persona_graph = nutrigraph_engine.graph.nodes.get(f"PERSONA:{resolved_pid}", {})

    recent_actions = crud.get_user_recent_actions(db, user_id, limit=5) if user_id else []
    memories = crud.get_user_memories(db, user_id) if user_id else []

    p_name = persona.full_name if persona else persona_graph.get("name", "Teman Sehat")
    p_archetype = persona.archetype_name if persona else persona_graph.get("archetype", "Healthy Eater")
    target_kcal = persona.target_lunch_kcal if persona else persona_graph.get("target_kcal", 750)
    budget = persona.target_lunch_budget_idr if persona else persona_graph.get("budget_idr", 35000)

    # Check target dish via NutriGraph
    target_dish_str = dish_context
    if not target_dish_str:
        for a in recent_actions:
            payload = a.payload or {}
            if a.action_type in ("CLICK_MENU_ITEM", "VIEW_DETAILS") and payload.get("item_name"):
                target_dish_str = payload.get("item_name")
                break

    if target_dish_str:
        resolved_fid = nutrigraph_engine.resolve_dish_id(target_dish_str)
        exp = nutrigraph_engine.explain_recommendation(resolved_pid, resolved_fid)
        citation = exp["clinical_citations"][0] if exp["clinical_citations"] else "Pedoman Medis NutriSea"
        if not exp["is_safe"]:
            reasons = "; ".join([c["reason"] for c in exp.get("contraindications", [])[:2]])
            return (
                f"Halo {p_name}! Berdasarkan verifikasi Knowledge Graph klinis kami (mengacu pada {citation}), "
                f"menu '{exp['food_name']}' terdeteksi KONTRAINDIKASI untuk kondisi kesehatan Anda karena {reasons}. "
                f"💡 Rekomendasi alternatif aman: Cobalah hidangan berkuah bening atau ayam panggang/bakar tanpa sambal pedas berlebih "
                f"dengan instruksi dapur: 'kuah bening, santan dan sambal dipisah' agar kondisi lambung dan pencernaan Anda tetap nyaman."
            )
        else:
            return (
                f"Halo {p_name}! Berdasarkan validasi multi-hop Knowledge Graph ({citation}), "
                f"menu '{exp['food_name']}' AMAN dan selaras untuk profil Anda ({p_archetype}). "
                f"Asupan {exp['dish_kcal']} kcal berada dalam batas aman target siang Anda ({target_kcal} kcal). "
                f"💡 Tips dapur: Minta porsi nasi setengah dan minyak sedikit agar kalori tetap seimbang!"
            )

    # Fallback when no dish specified: Provide top safe recommendation from graph
    safe_recs = nutrigraph_engine.recommend_safe_dishes(resolved_pid, top_k=1)
    recom_name = safe_recs[0]["name"] if safe_recs else "Paket Ayam Bakar Dada & Sayur Bayam"
    recom_kcal = safe_recs[0]["calories"] if safe_recs else 410
    recom_price = int(safe_recs[0]["price_idr"]) if safe_recs else 32000

    restrictions = [m.fact_text for m in memories if m.category in ("restriction", "condition")]
    restriction_note = f" Memperhatikan riwayat Anda ({restrictions[0]}), " if restrictions else " "

    return (
        f"Halo {p_name}! Sebagai asisten nutrisi berbasis arketipe Anda ({p_archetype}), "
        f"target kalori makan siang Anda adalah sekitar ~{target_kcal} kcal dengan batas budget Rp {budget:,}.{restriction_note}"
        f"Berdasarkan Knowledge Graph klinis, rekomendasi menu yang paling aman dan bergizi untuk Anda adalah {recom_name} "
        f"({recom_kcal} kcal, Rp {recom_price:,}). "
        f"💡 Tips modifikasi dapur: 'minta nasi setengah porsi dan kuah santan dipisah' agar kalori dan lemak tetap terkendali!"
    )

@router.post("/chat")
def consult_ai_copilot(
    req: ChatConsultRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    AI Nutritional Co-Pilot Consultation.
    Synthesizes:
    - User's Main Persona & 3 Side Personas with their clinical and behavioral meaning
    - Short-Term Memory (recent menu clicks, searches, cart items, with item personas)
    - Long-Term Memory (learned allergies, restrictions, conditions, habits)
    - Real-time catalog context and BMI stats
    Runs asynchronous Long-Term Memory (LTM) extraction in the background via Odysseus matching tactics.
    """
    effective_user_id = req.user_id or "user_3LdSuzBP84WASHC2BC7vliRK52R"

    # Ensure user exists in PostgreSQL
    try:
        user = crud.get_user(db, effective_user_id)
        if not user:
            user = crud.upsert_user(db, user_id=effective_user_id, name="NutriSea User", consent_health_data=True)
        crud.save_chat_message(
            db=db,
            user_id=effective_user_id,
            role="user",
            content=req.message,
            dish_context=req.dish_context,
            model_used=settings.OPENAI_MODEL
        )
    except Exception as e:
        logger.warning(f"Could not persist user chat message to PostgreSQL: {e}")

    # Build Context Blocks
    persona_context = format_persona_context(db, effective_user_id)
    stm_context = format_short_term_memory(db, effective_user_id, limit=10)
    ltm_context = format_long_term_memory(db, effective_user_id)
    graph_context = format_nutrigraph_guardrails(
        user_id=effective_user_id,
        dish_context=req.dish_context,
        user_message=req.message
    )
    catalog_text = load_catalog_summary()

    bmi_info = ""
    if req.user_bmi_stats:
        bmi_info = f"Status Biometrik: BMI {req.user_bmi_stats.get('bmi', 22.0)}, Target Kalori Harian: {req.user_bmi_stats.get('targetKcal', 1800)} kcal, Tujuan: {req.user_bmi_stats.get('goal', 'ideal')}."

    dish_info = f"Konteks Menu yang sedang dibuka saat ini: {req.dish_context}" if req.dish_context else ""

    system_prompt = f"""Anda adalah 'NutriSea AI Co-Pilot', asisten ahli gizi klinis dan rekomendasi makanan sehat pintar di ShopeeFood.

TUGAS UTAMA:
1. Menjawab pertanyaan pengguna dengan ramah, suportif, ringkas, praktis, dan profesional berbahasa Indonesia.
2. Panjang jawaban maksimal 2 paragraf padat atau poin-poin yang to-the-point (maksimal 200 kata).
3. Rujuk aktivitas terkini dari Short-Term Memory (menu yang baru diklik atau dicari pengguna) secara natural.
4. Patuhi secara ketat batasan dari Long-Term Memory (alergi, kondisi asam lambung/hipertensi, dsb).
5. Berikan saran modifikasi instruksi dapur (cooking request) yang realistis untuk warteg/resto lokal (misal: "nasi setengah", "kuah santan dipisah", "minyak sedikit").
6. Gunakan BUKTI KLINIS KNOWLEDGE GRAPH (NutriGraph Guardrails) sebagai fondasi validasi medis deterministik tanpa halusinasi. Jika menu berstatus KONTRAINDIKASI, peringatkan pengguna dengan empati dan jelaskan mekanisme fisiologisnya berdasarkan panduan klinis (Perkeni, PERKI, atau PGI).

{persona_context}

{stm_context}

{ltm_context}

{graph_context}

{bmi_info}
{dish_info}

KATALOG MENU SHOPEEFOOD TERSEDIA:
{catalog_text}
"""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in (req.history or [])[-5:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    reply_text = ""
    model_used = settings.OPENAI_MODEL

    if is_api_key_configured():
        try:
            client = get_openai_client()
            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=350
            )
            reply_text = response.choices[0].message.content
            model_used = settings.OPENAI_MODEL
        except Exception as e:
            logger.warning(f"OpenAI completion call error: {e}, falling back to dynamic context-aware synthesis.")
            reply_text = generate_dynamic_fallback_reply(db, effective_user_id, req.message, dish_context=req.dish_context)
            model_used = "dynamic-context-synthesis"
    else:
        reply_text = generate_dynamic_fallback_reply(db, effective_user_id, req.message, dish_context=req.dish_context)
        model_used = "dynamic-context-synthesis"

    # Persist assistant reply to DB
    try:
        crud.save_chat_message(
            db=db,
            user_id=effective_user_id,
            role="assistant",
            content=reply_text,
            dish_context=req.dish_context,
            model_used=model_used
        )
    except Exception as e:
        logger.warning(f"Could not persist assistant chat reply to PostgreSQL: {e}")

    # Background Odysseus LTM Memory Extraction Task
    messages_for_memory = [
        {"role": m.role, "content": m.content} for m in (req.history or [])[-4:]
    ]
    messages_for_memory.append({"role": "user", "content": req.message})
    messages_for_memory.append({"role": "assistant", "content": reply_text})

    background_tasks.add_task(
        extract_and_store_memories,
        user_id=effective_user_id,
        messages=messages_for_memory
    )

    return {
        "reply": reply_text,
        "model": model_used,
        "user_id": effective_user_id
    }
