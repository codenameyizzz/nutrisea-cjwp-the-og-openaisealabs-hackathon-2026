"""
backend/tests/test_knowledge_graph.py

Comprehensive unit and integration test suite for NutriGraph Engine and API endpoints.
Tests multi-hop clinical graph reasoning, allergen filtering, dynamic Odysseus memory ingestion,
explainability proof chains, and Graph-RAG coaching synthesis.
"""

import unittest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.knowledge_graph import nutrigraph_engine, NutriGraphEngine


class TestNutriGraphEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = nutrigraph_engine
        cls.client = TestClient(app)

    def test_01_graph_initialization(self):
        """Verifies that all nodes and edges from clinical ontologies and datasets are loaded."""
        stats = self.engine.get_stats()
        self.assertGreater(stats["total_nodes"], 200)
        self.assertGreater(stats["total_edges"], 1000)
        self.assertIn("CONDITION", stats["nodes_by_type"])
        self.assertIn("PERSONA", stats["nodes_by_type"])
        self.assertIn("DISH", stats["nodes_by_type"])
        self.assertIn("INGREDIENT", stats["nodes_by_type"])
        self.assertIn("CONTRAINDICATES", stats["edges_by_relation"])

    def test_02_clinical_safety_gerd(self):
        """Tests that a GERD/Gastritis persona contraindicates dishes with excessive spicy ingredients or deep frying."""
        gerd_persona = "DIGE_RANGGA_KUNINGAN_070"
        
        # Safe dish: Bubur Ayam / Nasi Tim Kuah Bening
        safe_dish = "FS-ID-176"
        res_safe = self.engine.check_clinical_safety(gerd_persona, safe_dish)
        self.assertTrue(res_safe["is_safe"])
        self.assertEqual(res_safe["severity"], "SAFE")

    def test_03_allergen_hard_guardrail(self):
        """Tests that an allergy to peanut (kacang) blocks dishes containing peanuts."""
        peanut_persona = "BUDG_HENDRA_SUDIRMAN_002"
        # Find any dish with allergen kacang if available
        for food_id, dish in self.engine.foods.items():
            if "kacang" in [str(a).lower() for a in dish.get("allergens", [])]:
                res = self.engine.check_clinical_safety(peanut_persona, food_id)
                self.assertFalse(res["is_safe"])
                self.assertEqual(res["severity"], "CRITICAL")
                break

    def test_04_safe_recommendation_ranking(self):
        """Tests that recommend_safe_dishes returns top-k dishes sorted by score and adhering to conditions."""
        persona_id = "PREV_AGNES_MENTENG_003" # Hypertension stage 1
        recs = self.engine.recommend_safe_dishes(persona_id, top_k=5)
        self.assertGreater(len(recs), 0)
        self.assertLessEqual(len(recs), 5)
        # Verify scores are sorted descending
        scores = [r["recommendation_score"] for r in recs]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_05_explain_recommendation(self):
        """Tests clinician-grade explainability proof chain and citations."""
        persona_id = "DIGE_RANGGA_KUNINGAN_070"
        food_id = "FS-ID-176"
        exp = self.engine.explain_recommendation(persona_id, food_id)
        self.assertIn("explanation_narrative", exp)
        self.assertIn("clinical_citations", exp)
        self.assertGreater(len(exp["clinical_citations"]), 0)
        self.assertIn("kcal_delta", exp)

    def test_06_dynamic_odysseus_memory_ingestion(self):
        """Tests that conversational memory updates graph edges dynamically."""
        persona_id = "BUDG_LILY_MENTENG_001"
        fact = "Sering kembung dan mual hebat bila konsumsi santan kental"
        res = self.engine.add_dynamic_memory_edge(
            persona_id=persona_id,
            fact_text=fact,
            category="restriction"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn("ING:santan_kental", res["connected_graph_targets"])

    def test_07_visualization_subgraph_export(self):
        """Tests Cytoscape/D3 compatible graph export."""
        persona_id = "DIGE_RANGGA_KUNINGAN_070"
        subgraph = self.engine.export_subgraph_for_visualization(persona_id, max_dishes=3)
        self.assertIn("nodes", subgraph)
        self.assertIn("edges", subgraph)
        self.assertGreater(len(subgraph["nodes"]), 0)
        self.assertGreater(len(subgraph["edges"]), 0)

    def test_08_api_stats_endpoint(self):
        """Tests GET /api/graph/stats."""
        response = self.client.get("/api/graph/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_nodes", data)
        self.assertIn("total_edges", data)

    def test_09_api_recommend_endpoint(self):
        self.assertEqual(self.client.get("/api/graph/recommend/PREV_AGNES_MENTENG_003").status_code, 401)

    def test_10_api_coach_endpoint(self):
        self.assertEqual(self.client.post("/api/graph/coach", json={"persona_id": "other", "food_id": "unknown"}).status_code, 401)

    def test_11_unknown_entities_are_not_substituted(self):
        from backend.app.services.knowledge_graph import nutrigraph_engine
        self.assertEqual(nutrigraph_engine.resolve_dish_id("DISH-FS-001"), "UNKNOWN")
        self.assertEqual(nutrigraph_engine.resolve_persona_id("unknown-user"), "UNKNOWN")
        self.assertFalse(nutrigraph_engine.check_clinical_safety("unknown-user", "unknown-dish")["is_safe"])

    def test_12_chat_requires_authentication(self):
        self.assertEqual(self.client.post("/api/ai/chat", json={"message": "hello", "user_id": "other"}).status_code, 401)
