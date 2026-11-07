import unittest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal, create_all_tables
from backend.app.db import crud
from backend.app.models import Persona
from backend.app.services.memory_extractor import (
    extract_fallback_candidates,
    _is_text_duplicate,
    extract_and_store_memories
)
from backend.app.api.chat import (
    format_persona_context,
    format_short_term_memory,
    format_long_term_memory
)

class TestLearnAsYouGo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_user_id = "test_user_learn_as_you_go_001"
        create_all_tables()
        cls.db = SessionLocal()

        # Seed mock personas in SQLite if not present
        for pid, name, arch_code, arch_name in [
            ("BUDG_FACHRI_MENTENG_115", "Fachri Lestari", "BUDGET_FITNESS", "Pejuang Kebugaran Hemat"),
            ("BUDG_HANA_MENTENG_096", "Hana Saputra", "BUDGET_FITNESS", "Pejuang Kebugaran Hemat"),
            ("PREV_ADITYA_KUNINGAN_088", "Aditya Nasution", "PREVENTIVE_HEALTH", "Preventif Sadar Kardiometabolik")
        ]:
            if not crud.get_persona(cls.db, pid):
                p = Persona(
                    id=pid,
                    full_name=name,
                    archetype_code=arch_code,
                    archetype_name=arch_name,
                    age=28,
                    gender="male",
                    occupation="Staff",
                    work_district="Menteng",
                    monthly_income_idr=8000000,
                    activity_level="moderate",
                    height_cm=170.0,
                    weight_kg=65.0,
                    bmi_value=22.5,
                    bmi_category="Normal",
                    bmr_kcal=1500,
                    tdee_kcal=2000,
                    daily_caloric_target_kcal=1800,
                    target_lunch_kcal=600,
                    target_lunch_budget_idr=30000,
                    health_goal="Fitness",
                    medical_conditions="NONE",
                    allergens="NONE"
                )
                cls.db.add(p)
        cls.db.commit()

        # Seed test user with Main Persona and Side Personas
        user = crud.get_user(cls.db, cls.test_user_id)
        if not user:
            user = crud.upsert_user(
                cls.db,
                user_id=cls.test_user_id,
                name="Budi Pratama",
                consent_health_data=True
            )
        user.main_persona_id = "BUDG_FACHRI_MENTENG_115"
        user.side_persona_ids = ["BUDG_HANA_MENTENG_096", "PREV_ADITYA_KUNINGAN_088"]
        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_log_short_term_memory_action_with_personas(self):
        """STM: Logs menu click and cart add actions with dish personas into PostgreSQL."""
        # Log menu click
        res1 = self.client.post("/api/actions/log", json={
            "user_id": self.test_user_id,
            "action_type": "CLICK_MENU_ITEM",
            "payload": {
                "item_id": "DISH-FS-001",
                "item_name": "Paket Nasi Merah Dada Ayam Bakar & Sayur Bayam",
                "merchant_name": "Warteg Berkah Mandiri",
                "price": 28000,
                "personas": ["BUDG_FACHRI_MENTENG_115", "BUDG_HANA_MENTENG_096"],
                "category": "protein",
                "macros": {"kcal": 410, "protein_g": 36}
            }
        })
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.json()["status"], "success")

        # Log search query
        res2 = self.client.post("/api/actions/log", json={
            "user_id": self.test_user_id,
            "action_type": "SEARCH_QUERY",
            "payload": {
                "query": "soto ayam bening tanpa santan"
            }
        })
        self.assertEqual(res2.status_code, 200)

        # Log add to cart
        res3 = self.client.post("/api/actions/log", json={
            "user_id": self.test_user_id,
            "action_type": "ADD_TO_CART",
            "payload": {
                "item_id": "DISH-FS-005",
                "item_name": "Pepes Tahu Jamur Kukus",
                "merchant_name": "Warteg Berkah Mandiri",
                "price": 12000,
                "personas": ["PREV_ADITYA_KUNINGAN_088"],
                "qty": 2
            }
        })
        self.assertEqual(res3.status_code, 200)

    def test_02_retrieve_recent_actions(self):
        """STM: Retrieves recent actions in descending order with full properties."""
        res = self.client.get(f"/api/actions/{self.test_user_id}?limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["count"], 3)
        actions = data["actions"]
        # Most recent should be ADD_TO_CART
        self.assertEqual(actions[0]["action_type"], "ADD_TO_CART")
        self.assertEqual(actions[0]["payload"]["item_name"], "Pepes Tahu Jamur Kukus")
        self.assertIn("PREV_ADITYA_KUNINGAN_088", actions[0]["payload"]["personas"])

    def test_03_fallback_candidate_extraction(self):
        """LTM: Heuristic extractor extracts allergies, conditions, preferences, and habits."""
        messages = [
            {"role": "user", "content": "Saya punya maag kronis dan alergi udang. Pantang makanan pedas dan selalu minta nasi setengah porsi."}
        ]
        candidates = extract_fallback_candidates(messages)
        texts = [c["text"] for c in candidates]
        categories = [c["category"] for c in candidates]

        self.assertIn("condition", categories)
        self.assertIn("restriction", categories)
        self.assertIn("habit", categories)

        self.assertTrue(any("udang" in t.lower() for t in texts))
        self.assertTrue(any("lambung" in t.lower() or "maag" in t.lower() for t in texts))
        self.assertTrue(any("nasi setengah" in t.lower() for t in texts))

    def test_04_deduplication_logic(self):
        """LTM: Jaccard similarity and exact matching prevent duplicate memories."""
        existing = [
            "Alergi terhadap udang.",
            "Memiliki riwayat penyakit asam lambung / GERD / gastritis."
        ]
        # Identical
        self.assertTrue(_is_text_duplicate("Alergi terhadap udang.", existing))
        # Rephrased with high overlap
        self.assertTrue(_is_text_duplicate("alergi terhadap udang", existing))
        # Distinct fact
        self.assertFalse(_is_text_duplicate("Target diet turun 5 kg.", existing))

    def test_05_format_persona_context(self):
        """Prompt Builder: Formats user's Main Persona & Side Personas with clinical meanings."""
        ctx = format_persona_context(self.db, self.test_user_id)
        self.assertIn("PROFIL PERSONA PENGGUNA", ctx)
        self.assertIn("BUDG_FACHRI_MENTENG_115", ctx)
        self.assertIn("ARTI KLINIS PERSONA UTAMA", ctx)
        self.assertIn("SIDE PERSONAS", ctx)
        self.assertIn("ARTI KLINIS SIDE PERSONAS", ctx)

    def test_06_format_stm_context(self):
        """Prompt Builder: Formats Short-Term Memory with menu personas and search terms."""
        ctx = format_short_term_memory(self.db, self.test_user_id, limit=5)
        self.assertIn("SHORT-TERM MEMORY", ctx)
        self.assertIn("Pepes Tahu Jamur Kukus", ctx)
        self.assertIn("soto ayam bening", ctx)
        self.assertIn("Personas", ctx)

    def test_07_format_ltm_context(self):
        """Prompt Builder: Formats Long-Term Memory facts."""
        # Seed a test memory item
        crud.save_user_memory(
            db=self.db,
            user_id=self.test_user_id,
            category="restriction",
            fact_text="Alergi terhadap udang dan kepiting.",
            confidence=0.95
        )
        ctx = format_long_term_memory(self.db, self.test_user_id)
        self.assertIn("LONG-TERM MEMORY", ctx)
        self.assertIn("Alergi terhadap udang dan kepiting", ctx)

    def test_08_end_to_end_chat_consultation(self):
        """End-to-End: POST /api/ai/chat returns personalized reply and triggers LTM background extraction."""
        res = self.client.post("/api/ai/chat", json={
            "user_id": self.test_user_id,
            "message": "Tolong rekomendasikan menu siang hari ini yang aman untuk maag saya.",
            "history": []
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("reply", data)
        self.assertIn("model", data)
        reply = data["reply"]
        self.assertGreater(len(reply), 30)

        # Check that memories endpoint reflects the stored facts
        mem_res = self.client.get(f"/api/users/{self.test_user_id}/memories")
        self.assertEqual(mem_res.status_code, 200)
        self.assertGreaterEqual(mem_res.json()["count"], 1)

if __name__ == "__main__":
    unittest.main()
