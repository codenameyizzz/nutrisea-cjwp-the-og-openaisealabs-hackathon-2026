"""
backend/app/api/graph.py

FastAPI Router for NutriGraph Knowledge Graph Engine.
Exposes high-performance endpoints for clinical graph queries, multi-hop safety checks,
explainable proof chains, Cytoscape/D3 graph visualization, dynamic Odysseus memory ingestion,
and Graph-RAG clinical coaching synthesis.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.knowledge_graph import nutrigraph_engine

router = APIRouter(prefix="/api/graph", tags=["Knowledge Graph"])


class MemoryIngestRequest(BaseModel):
    persona_id: str = Field(..., description="Target persona identifier (e.g. DIGE_RANGGA_KUNINGAN_070)")
    fact_text: str = Field(..., description="Durable health or preference fact extracted from conversation")
    category: str = Field("restriction", description="Memory category: restriction, condition, preference, habit")


class CoachingRequest(BaseModel):
    persona_id: str = Field(..., description="Target persona identifier")
    food_id: str = Field(..., description="Dish identifier (e.g. FS-ID-101)")
    user_query: Optional[str] = Field(None, description="Optional conversational question from user")


@router.get("/stats")
def get_graph_statistics():
    """
    Returns graph node and edge counts, relationship taxonomy, and OpenAI readiness status.
    """
    return nutrigraph_engine.get_stats()


@router.get("/persona/{persona_id}")
def get_persona_subgraph_details(persona_id: str):
    """
    Returns persona node details, conditions, allergens, and connected edges.
    """
    resolved_pid = nutrigraph_engine.resolve_persona_id(persona_id)
    p_node = f"PERSONA:{resolved_pid}"
    if not nutrigraph_engine.graph.has_node(p_node):
        raise HTTPException(status_code=404, detail=f"Persona {persona_id} (resolved: {resolved_pid}) not found in Knowledge Graph.")

    persona_data = nutrigraph_engine.graph.nodes[p_node]
    conditions = []
    allergens = []
    memories = []

    for _, target, edge_data in nutrigraph_engine.graph.out_edges(p_node, data=True):
        rel = edge_data.get("relation")
        if rel == "HAS_CONDITION":
            c_data = nutrigraph_engine.graph.nodes.get(target, {})
            conditions.append({
                "node_id": target,
                "name": c_data.get("name"),
                "guideline": c_data.get("guideline"),
                "rationale": c_data.get("rationale")
            })
        elif rel == "HAS_ALLERGY":
            allergens.append(target.replace("ALLERGEN:", ""))
        elif "MEMORY" in rel or "AVERSION" in rel:
            memories.append({
                "target": target,
                "relation": rel,
                "data": edge_data
            })

    return {
        "persona_id": resolved_pid,
        "original_query_id": persona_id,
        "full_name": persona_data.get("name"),
        "archetype": persona_data.get("archetype"),
        "target_lunch_kcal": persona_data.get("target_kcal"),
        "target_budget_idr": persona_data.get("budget_idr"),
        "bmi_value": persona_data.get("bmi_value"),
        "clinical_conditions": conditions,
        "allergens": allergens,
        "dynamic_memories": memories
    }


@router.get("/recommend/{persona_id}")
def get_safe_recommendations(
    persona_id: str,
    top_k: int = Query(5, ge=1, le=20, description="Number of recommendations to retrieve"),
    max_budget: Optional[float] = Query(None, description="Optional custom budget constraint in IDR")
):
    """
    Returns top-k safe dishes filtered by multi-hop clinical guardrails and ranked by graph score.
    """
    resolved_pid = nutrigraph_engine.resolve_persona_id(persona_id)
    recs = nutrigraph_engine.recommend_safe_dishes(persona_id=resolved_pid, top_k=top_k, max_budget=max_budget)
    return {
        "persona_id": resolved_pid,
        "original_query_id": persona_id,
        "total_returned": len(recs),
        "recommendations": recs
    }


@router.get("/check-dish/{persona_id}/{food_id}")
def check_dish_clinical_safety(persona_id: str, food_id: str):
    """
    Performs multi-hop safety validation for a specific dish against a persona's clinical graph.
    """
    return nutrigraph_engine.check_clinical_safety(persona_id, food_id)


@router.get("/explain/{persona_id}/{food_id}")
def explain_dish_recommendation(persona_id: str, food_id: str):
    """
    Returns clinician-grade proof chain narrative and guidelines citations.
    """
    return nutrigraph_engine.explain_recommendation(persona_id, food_id)


@router.get("/visualize/{persona_id}")
def get_visualization_subgraph(
    persona_id: str,
    max_dishes: int = Query(4, ge=1, le=10, description="Number of dishes to include in visualization"),
    focus_dish_id: Optional[str] = Query(None, description="Optional specific dish to highlight and verify in subgraph")
):
    """
    Exports Cytoscape/D3 compatible node-link JSON representing the persona's clinical subnetwork.
    """
    return nutrigraph_engine.export_subgraph_for_visualization(
        persona_id=persona_id,
        max_dishes=max_dishes,
        focus_dish_id=focus_dish_id
    )


@router.post("/memory/add")
def add_conversational_memory_to_graph(payload: MemoryIngestRequest):
    """
    Dynamic Odysseus Graph Ingestion:
    Extracts durable health facts and updates graph edges in real time.
    """
    resolved_pid = nutrigraph_engine.resolve_persona_id(payload.persona_id)
    result = nutrigraph_engine.add_dynamic_memory_edge(
        persona_id=resolved_pid,
        fact_text=payload.fact_text,
        category=payload.category
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.post("/coach")
def synthesize_clinical_coaching(payload: CoachingRequest):
    """
    Synthesizes conversational clinical coaching narrative.
    Promotes to OpenAI GPT-4o if OPENAI_API_KEY is configured,
    or falls back to deterministic clinical graph reasoning.
    """
    return nutrigraph_engine.synthesize_clinical_coaching(
        persona_id=payload.persona_id,
        food_id=payload.food_id,
        user_query=payload.user_query
    )
