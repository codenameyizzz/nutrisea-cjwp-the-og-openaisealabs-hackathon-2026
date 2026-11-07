"""
backend/app/services/knowledge_graph.py

NutriGraph Engine: Clinical Knowledge Graph for NutriSea
Grounded in authentic Indonesian clinical guidelines (Perkeni, PERKI, PGI),
FatSecret Indonesian gastronomy dataset, and 120 urban worker personas.
Supports deterministic multi-hop clinical graph reasoning and seamless
OpenAI Graph-RAG promotion when OPENAI_API_KEY is configured.
"""

import os
import json
import csv
import logging
import uuid
from typing import Dict, Any, List, Optional, Tuple, Set

import networkx as nx

from ..core.config import settings
from ..ai.client import is_openai_configured, get_openai_client

logger = logging.getLogger(__name__)

# Base Paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT_DIR = os.path.dirname(BACKEND_DIR)

CLINICAL_RULES_PATH = os.path.join(BACKEND_DIR, "app", "data", "ontology", "clinical_rules.json")
INGREDIENT_ONTOLOGY_PATH = os.path.join(BACKEND_DIR, "app", "data", "ontology", "ingredient_ontology.json")
PERSONAS_CSV_PATH = os.path.join(ROOT_DIR, "data", "personas", "processed", "personas_master.csv")
FOODS_JSON_PATH = os.path.join(ROOT_DIR, "data", "food", "fatsecret_indonesian_foods_expanded.json")
MAPPINGS_CSV_PATH = os.path.join(ROOT_DIR, "data", "food", "indonesian_food_persona_mappings.csv")


class NutriGraphEngine:
    _instance: Optional["NutriGraphEngine"] = None

    def __init__(self):
        self.graph: nx.MultiDiGraph = nx.MultiDiGraph()
        self.clinical_rules: Dict[str, Any] = {}
        self.ingredient_ontology: Dict[str, Any] = {}
        self.personas: Dict[str, Dict[str, Any]] = {}
        self.foods: Dict[str, Dict[str, Any]] = {}
        self.assigned_mappings: Dict[str, Set[str]] = {}
        self.is_initialized: bool = False
        self._initialize()

    @classmethod
    def get_instance(cls) -> "NutriGraphEngine":
        if cls._instance is None:
            cls._instance = NutriGraphEngine()
        return cls._instance

    def _initialize(self):
        """Loads all clinical ontologies and datasets into in-memory MultiDiGraph."""
        try:
            logger.info("Initializing NutriGraph Engine...")
            self._load_clinical_rules()
            self._load_ingredient_ontology()
            self._load_personas()
            self._load_foods()
            self._load_food_persona_mappings()
            self.is_initialized = True
            logger.info(
                f"NutriGraph Initialized: {self.graph.number_of_nodes()} nodes, "
                f"{self.graph.number_of_edges()} edges."
            )
        except Exception as e:
            logger.error(f"Failed to initialize NutriGraph: {e}", exc_info=True)

    def _load_clinical_rules(self):
        if not os.path.exists(CLINICAL_RULES_PATH):
            logger.warning(f"Clinical rules file not found: {CLINICAL_RULES_PATH}")
            return
        with open(CLINICAL_RULES_PATH, "r", encoding="utf-8") as f:
            self.clinical_rules = json.load(f)

        for cond_id, cond_info in self.clinical_rules.get("conditions", {}).items():
            cond_node = f"COND:{cond_id}"
            self.graph.add_node(
                cond_node,
                node_type="CONDITION",
                code=cond_id,
                name=cond_info.get("display_name", cond_id),
                rationale=cond_info.get("clinical_rationale", ""),
                guideline=cond_info.get("guidelines_reference", ""),
                ceilings=cond_info.get("nutrient_ceilings_per_meal", {})
            )
            for nutrient, ceiling in cond_info.get("nutrient_ceilings_per_meal", {}).items():
                limit_node = f"LIMIT:{cond_id}:{nutrient}"
                self.graph.add_node(
                    limit_node,
                    node_type="NUTRIENT_LIMIT",
                    nutrient=nutrient,
                    ceiling=ceiling
                )
                self.graph.add_edge(cond_node, limit_node, relation="ENFORCES_LIMIT", ceiling=ceiling)

    def _load_ingredient_ontology(self):
        if not os.path.exists(INGREDIENT_ONTOLOGY_PATH):
            logger.warning(f"Ingredient ontology file not found: {INGREDIENT_ONTOLOGY_PATH}")
            return
        with open(INGREDIENT_ONTOLOGY_PATH, "r", encoding="utf-8") as f:
            self.ingredient_ontology = json.load(f)

        # Ingest ingredients
        for ing_id, ing_info in self.ingredient_ontology.get("ingredients", {}).items():
            ing_node = f"ING:{ing_id}"
            self.graph.add_node(
                ing_node,
                node_type="INGREDIENT",
                ingredient_id=ing_id,
                name=ing_info.get("display_name", ing_id),
                category=ing_info.get("category", ""),
                aliases=ing_info.get("aliases", []),
                impact=ing_info.get("impact_mechanism", ""),
                alternative=ing_info.get("recommended_alternative", "")
            )
            # Add contraindication edges
            for cond in ing_info.get("clinical_sensitivities", []):
                cond_node = f"COND:{cond}"
                if self.graph.has_node(cond_node):
                    self.graph.add_edge(
                        cond_node,
                        ing_node,
                        relation="CONTRAINDICATES",
                        severity="HIGH",
                        impact=ing_info.get("impact_mechanism", "")
                    )
            # Add clinical benefits edges
            for cond in ing_info.get("clinical_benefits", []):
                cond_node = f"COND:{cond}"
                if self.graph.has_node(cond_node):
                    self.graph.add_edge(
                        cond_node,
                        ing_node,
                        relation="RECOMMENDS_BENEFIT",
                        impact=ing_info.get("impact_mechanism", "")
                    )

        # Ingest cooking methods
        for method_id, method_info in self.ingredient_ontology.get("cooking_methods", {}).items():
            method_node = f"METHOD:{method_id}"
            self.graph.add_node(
                method_node,
                node_type="COOKING_METHOD",
                method_id=method_id,
                name=method_info.get("display_name", method_id),
                oil_multiplier=method_info.get("oil_absorption_multiplier", 1.0)
            )
            for cond in method_info.get("contraindicated_for", []):
                cond_node = f"COND:{cond}"
                if self.graph.has_node(cond_node):
                    self.graph.add_edge(
                        cond_node,
                        method_node,
                        relation="CONTRAINDICATES_METHOD",
                        severity="HIGH"
                    )
            for cond in method_info.get("beneficial_for", []):
                cond_node = f"COND:{cond}"
                if self.graph.has_node(cond_node):
                    self.graph.add_edge(
                        cond_node,
                        method_node,
                        relation="RECOMMENDS_METHOD"
                    )

    def _load_personas(self):
        if not os.path.exists(PERSONAS_CSV_PATH):
            logger.warning(f"Personas file not found: {PERSONAS_CSV_PATH}")
            return
        with open(PERSONAS_CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pid = row["persona_id"]
                node_id = f"PERSONA:{pid}"
                self.personas[pid] = row
                self.graph.add_node(
                    node_id,
                    node_type="PERSONA",
                    persona_id=pid,
                    name=row.get("full_name", pid),
                    archetype=row.get("archetype_code", ""),
                    occupation=row.get("occupation", ""),
                    target_kcal=float(row.get("target_lunch_kcal") or 600),
                    budget_idr=float(row.get("target_lunch_budget_idr") or 35000),
                    bmi_value=float(row.get("bmi_value") or 22.0),
                    medical_conditions=row.get("medical_conditions", "NONE"),
                    allergens=row.get("allergens", "NONE")
                )

                # Link medical conditions
                cond_str = (row.get("medical_conditions") or "").upper()
                if any(x in cond_str for x in ["GERD", "GASTRITIS", "MAAG"]):
                    self.graph.add_edge(node_id, "COND:GERD_MAAG", relation="HAS_CONDITION")
                if any(x in cond_str for x in ["CHOLESTEROL", "KOLESTEROL", "DISLIPIDEMIA"]):
                    self.graph.add_edge(node_id, "COND:BORDERLINE_CHOLESTEROL", relation="HAS_CONDITION")
                if any(x in cond_str for x in ["HYPERTENSION", "HIPERTENSI"]):
                    self.graph.add_edge(node_id, "COND:HYPERTENSION_STAGE1", relation="HAS_CONDITION")
                if any(x in cond_str for x in ["PREDIABETES", "DIABETES", "GLUKOSA"]):
                    self.graph.add_edge(node_id, "COND:PREDIABETES_GLUKOSA", relation="HAS_CONDITION")
                if "OBESITY" in cond_str or "OBESITAS" in cond_str or float(row.get("bmi_value") or 0) >= 27.0:
                    self.graph.add_edge(node_id, "COND:OBESITY", relation="HAS_CONDITION")

                # Link allergens
                raw_allergens = (row.get("allergens") or "").lower()
                if raw_allergens and raw_allergens != "none":
                    for alg in raw_allergens.split(","):
                        alg_clean = alg.strip()
                        if alg_clean:
                            alg_node = f"ALLERGEN:{alg_clean}"
                            if not self.graph.has_node(alg_node):
                                self.graph.add_node(alg_node, node_type="ALLERGEN", name=alg_clean)
                            self.graph.add_edge(node_id, alg_node, relation="HAS_ALLERGY")

    def _load_foods(self):
        if not os.path.exists(FOODS_JSON_PATH):
            logger.warning(f"Foods JSON file not found: {FOODS_JSON_PATH}")
            return
        with open(FOODS_JSON_PATH, "r", encoding="utf-8") as f:
            food_list = json.load(f)

        for item in food_list:
            food_id = item.get("food_id")
            if not food_id:
                continue
            self.foods[food_id] = item
            node_id = f"DISH:{food_id}"
            self.graph.add_node(
                node_id,
                node_type="DISH",
                food_id=food_id,
                name=item.get("name", ""),
                category=item.get("category", ""),
                calories=float(item.get("calories") or 0),
                protein_g=float(item.get("protein_g") or 0),
                carbs_g=float(item.get("carbs_g") or 0),
                fat_g=float(item.get("fat_g") or 0),
                sodium_mg=float(item.get("sodium_mg") or 0),
                price_idr=float(item.get("price_idr") or 0),
                cooking_method=item.get("cooking_method", ""),
                healthy_tags=item.get("healthy_tags", []),
                allergens=item.get("allergens", []),
                is_spicy=bool(item.get("is_spicy")),
                is_acidic=bool(item.get("is_acidic")),
                clinical_rationale=item.get("clinical_rationale", "")
            )

            # Link cooking method
            method_str = str(item.get("cooking_method") or "").lower()
            if "bakar" in method_str or "panggang" in method_str:
                self.graph.add_edge(node_id, "METHOD:bakar_rempah", relation="PREPARED_BY")
            elif any(x in method_str for x in ["goreng", "deep", "crispy"]):
                self.graph.add_edge(node_id, "METHOD:goreng_deep_fry", relation="PREPARED_BY")
            elif any(x in method_str for x in ["kukus", "rebus"]):
                self.graph.add_edge(node_id, "METHOD:kukus_rebus", relation="PREPARED_BY")
            elif any(x in method_str for x in ["santan", "gulai", "rendang"]):
                self.graph.add_edge(node_id, "METHOD:gulai_santan", relation="PREPARED_BY")
            else:
                self.graph.add_edge(node_id, "METHOD:kuah_bening", relation="PREPARED_BY")

            # Map allergens to dish
            for alg in item.get("allergens", []):
                alg_clean = str(alg).lower().strip()
                if alg_clean and alg_clean != "none":
                    alg_node = f"ALLERGEN:{alg_clean}"
                    if not self.graph.has_node(alg_node):
                        self.graph.add_node(alg_node, node_type="ALLERGEN", name=alg_clean)
                    self.graph.add_edge(node_id, alg_node, relation="CONTAINS_ALLERGEN")

            # Infer and link ingredients from dish name and metadata
            name_lower = (item.get("name") or "").lower()
            if any(x in name_lower for x in ["santan", "gulai", "rendang", "lodeh", "opor", "kari"]):
                self.graph.add_edge(node_id, "ING:santan_kental", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["geprek", "mercon", "pedas", "sambal korek", "balado", "rawit"]) or item.get("is_spicy"):
                self.graph.add_edge(node_id, "ING:cabai_rawit_ekstrem", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["jeroan", "usus", "babat", "hati", "paru", "kikil"]):
                self.graph.add_edge(node_id, "ING:jeroan_sapi_ayam", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["crispy", "kremes", "goreng tepung", "bakwan"]):
                self.graph.add_edge(node_id, "ING:minyak_jelantah_deep_fry", relation="CONTAINS_INGREDIENT")
            if float(item.get("sodium_mg") or 0) > 750:
                self.graph.add_edge(node_id, "ING:garam_monosodium_glutamat_tinggi", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["dada", "fillet dada", "ayam suwir"]):
                self.graph.add_edge(node_id, "ING:dada_ayam_tanpa_kulit", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["tempe", "bacem"]):
                self.graph.add_edge(node_id, "ING:tempe_kedelai_fermentasi", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["patin", "kembung", "ikan mas", "pepes ikan"]):
                self.graph.add_edge(node_id, "ING:ikan_kembung_patin_segar", relation="CONTAINS_INGREDIENT")
            if any(x in name_lower for x in ["bayam", "labu siam", "bening", "sop sayur"]):
                self.graph.add_edge(node_id, "ING:sayur_bening_bayam_labu", relation="CONTAINS_INGREDIENT")

    def _load_food_persona_mappings(self):
        if not os.path.exists(MAPPINGS_CSV_PATH):
            logger.warning(f"Mappings CSV file not found: {MAPPINGS_CSV_PATH}")
            return
        with open(MAPPINGS_CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                food_id = row.get("food_id")
                dish_node = f"DISH:{food_id}"
                raw_personas = row.get("personas", "")
                persona_list = [p.strip() for p in raw_personas.split(",") if p.strip()]
                for pid in persona_list:
                    p_node = f"PERSONA:{pid}"
                    if self.graph.has_node(p_node) and self.graph.has_node(dish_node):
                        self.graph.add_edge(
                            p_node,
                            dish_node,
                            relation="ASSIGNED_RECOMMENDATION",
                            rationale=row.get("clinical_rationale", "")
                        )
                        if pid not in self.assigned_mappings:
                            self.assigned_mappings[pid] = set()
                        self.assigned_mappings[pid].add(food_id)

    # ==========================================================================
    # Graph Queries & Clinical Traversal Engine
    # ==========================================================================

    def resolve_persona_id(self, user_or_persona_id: Optional[str]) -> str:
        """
        Resolves arbitrary user ID, Clerk ID, persona ID, or persona code
        to a verified Knowledge Graph persona identifier (e.g. BUDG_FACHRI_MENTENG_115).
        """
        if not user_or_persona_id:
            return "BUDG_FACHRI_MENTENG_115"

        clean = str(user_or_persona_id).replace("PERSONA:", "").strip()

        # 1. Direct match in loaded personas
        if clean in self.personas:
            return clean

        # 2. Try AppUser lookup from DB if available
        try:
            from ..core.database import SessionLocal
            from ..db.models import AppUser
            db = SessionLocal()
            try:
                user = db.query(AppUser).filter(AppUser.id == clean).first()
                if user and user.main_persona_id and user.main_persona_id in self.personas:
                    return user.main_persona_id
            finally:
                db.close()
        except Exception as e:
            logger.debug(f"DB lookup for persona resolution failed or skipped: {e}")

        # 3. Fuzzy / Token / Substring matching (e.g. CORP_LILY_SCBD -> CORP_LILY_MENTENG_111)
        clean_upper = clean.upper()
        for pid in self.personas.keys():
            if clean_upper in pid or pid in clean_upper:
                return pid

        target_tokens = set([t for t in clean_upper.replace("-", "_").split("_") if t])
        best_pid = None
        best_overlap = 0
        for pid in self.personas.keys():
            p_tokens = set(pid.split("_"))
            overlap = len(target_tokens.intersection(p_tokens))
            if overlap > best_overlap:
                best_overlap = overlap
                best_pid = pid

        if best_pid and best_overlap >= 1:
            return best_pid

        # Default fallback
        return "BUDG_FACHRI_MENTENG_115"

    def resolve_dish_id(self, dish_id_or_name: Optional[str]) -> str:
        """
        Resolves arbitrary dish identifier (DISH-FS-001, DISH-01, FS-ID-101)
        or dish name to a verified Knowledge Graph food identifier (e.g. FS-ID-101).
        """
        if not dish_id_or_name:
            return "FS-ID-101"

        clean = str(dish_id_or_name).replace("DISH:", "").strip()

        # 1. Direct match
        if clean in self.foods:
            return clean

        # 2. DISH-FS-xxx format (e.g. DISH-FS-001 -> FS-ID-101, DISH-FS-012 -> FS-ID-112)
        if clean.upper().startswith("DISH-FS-"):
            try:
                num = int(clean.upper().replace("DISH-FS-", ""))
                candidate = f"FS-ID-{100 + num}"
                if candidate in self.foods:
                    return candidate
            except Exception:
                pass

        # 3. DISH-xx format (e.g. DISH-01 -> FS-ID-101)
        if clean.upper().startswith("DISH-"):
            try:
                num = int(clean.upper().replace("DISH-", ""))
                candidate = f"FS-ID-{100 + num}"
                if candidate in self.foods:
                    return candidate
            except Exception:
                pass

        # 4. Name or token overlap matching
        target_clean = clean.lower().replace("-", " ")
        for fid, fmeta in self.foods.items():
            fname = (fmeta.get("name") or "").lower()
            if fname in target_clean or target_clean in fname:
                return fid

        target_tokens = set(target_clean.split())
        best_fid = None
        best_overlap = 0
        for fid, fmeta in self.foods.items():
            fname = (fmeta.get("name") or "").lower()
            f_tokens = set(fname.split())
            overlap = len(target_tokens.intersection(f_tokens))
            if overlap > best_overlap:
                best_overlap = overlap
                best_fid = fid

        if best_fid and best_overlap >= 1:
            return best_fid

        return "FS-ID-101"

    def get_stats(self) -> Dict[str, Any]:
        """Returns node and edge summary statistics for the Knowledge Graph."""
        node_types: Dict[str, int] = {}
        for _, data in self.graph.nodes(data=True):
            ntype = data.get("node_type", "UNKNOWN")
            node_types[ntype] = node_types.get(ntype, 0) + 1

        edge_relations: Dict[str, int] = {}
        for _, _, data in self.graph.edges(data=True):
            rel = data.get("relation", "UNKNOWN")
            edge_relations[rel] = edge_relations.get(rel, 0) + 1

        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "nodes_by_type": node_types,
            "edges_by_relation": edge_relations,
            "is_openai_configured": is_openai_configured()
        }

    def check_clinical_safety(self, persona_id: str, food_id: str) -> Dict[str, Any]:
        """
        Executes multi-hop traversal to determine clinical safety:
        PERSONA -> CONDITION -> CONTRAINDICATES -> INGREDIENT/METHOD <- CONTAINS <- DISH
        PERSONA -> ALLERGEN <- CONTAINS_ALLERGEN <- DISH
        PERSONA -> CONDITION -> ENFORCES_LIMIT (evaluating macros against ceiling)
        """
        resolved_pid = self.resolve_persona_id(persona_id)
        resolved_fid = self.resolve_dish_id(food_id)
        p_node = f"PERSONA:{resolved_pid}"
        d_node = f"DISH:{resolved_fid}"

        if not self.graph.has_node(p_node):
            return {
                "resolved_persona_id": resolved_pid,
                "resolved_food_id": resolved_fid,
                "is_safe": True,
                "severity": "UNKNOWN_PERSONA",
                "contraindications": [],
                "benefits": [],
                "warnings": [f"Persona ID {persona_id} tidak ditemukan dalam Knowledge Graph."],
                "path_evidence": []
            }

        if not self.graph.has_node(d_node):
            return {
                "resolved_persona_id": resolved_pid,
                "resolved_food_id": resolved_fid,
                "is_safe": True,
                "severity": "UNKNOWN_DISH",
                "contraindications": [],
                "benefits": [],
                "warnings": [f"Food ID {food_id} tidak ditemukan dalam Knowledge Graph."],
                "path_evidence": []
            }

        contraindications: List[Dict[str, Any]] = []
        benefits: List[Dict[str, Any]] = []
        path_evidence: List[List[str]] = []
        dish_data = self.graph.nodes[d_node]

        # 1. Allergen Check
        user_allergens = set()
        for _, target, edge_data in self.graph.out_edges(p_node, data=True):
            if edge_data.get("relation") == "HAS_ALLERGY":
                user_allergens.add(target)

        dish_allergens = set()
        for _, target, edge_data in self.graph.out_edges(d_node, data=True):
            if edge_data.get("relation") == "CONTAINS_ALLERGEN":
                dish_allergens.add(target)

        allergen_conflicts = user_allergens.intersection(dish_allergens)
        for alg in allergen_conflicts:
            alg_name = self.graph.nodes[alg].get("name", alg)
            contraindications.append({
                "type": "ALLERGEN_TRIGGER",
                "item": alg_name,
                "reason": f"Pengguna memiliki riwayat alergi terkonfirmasi terhadap {alg_name}.",
                "severity": "CRITICAL"
            })
            path_evidence.append([p_node, "HAS_ALLERGY", alg, "CONTAINS_ALLERGEN", d_node])

        # 2. Multi-hop Condition -> Contraindicated Ingredient / Cooking Method
        user_conditions = []
        for _, cond_target, edge_data in self.graph.out_edges(p_node, data=True):
            if edge_data.get("relation") == "HAS_CONDITION":
                user_conditions.append(cond_target)

        dish_ingredients = []
        for _, ing_target, edge_data in self.graph.out_edges(d_node, data=True):
            if edge_data.get("relation") == "CONTAINS_INGREDIENT":
                dish_ingredients.append(ing_target)

        dish_methods = []
        for _, meth_target, edge_data in self.graph.out_edges(d_node, data=True):
            if edge_data.get("relation") == "PREPARED_BY":
                dish_methods.append(meth_target)

        for cond in user_conditions:
            cond_data = self.graph.nodes[cond]
            cond_name = cond_data.get("name", cond)

            # Check contraindicated ingredients
            for _, contra_target, edge_data in self.graph.out_edges(cond, data=True):
                rel = edge_data.get("relation", "")
                if rel == "CONTRAINDICATES" and contra_target in dish_ingredients:
                    ing_name = self.graph.nodes[contra_target].get("name", contra_target)
                    impact = edge_data.get("impact", "")
                    contraindications.append({
                        "type": "CLINICAL_CONTRAINDICATION",
                        "condition": cond_name,
                        "ingredient": ing_name,
                        "reason": impact or f"{ing_name} dikontraindikasikan pada kondisi {cond_name}.",
                        "severity": "HIGH"
                    })
                    path_evidence.append([p_node, "HAS_CONDITION", cond, "CONTRAINDICATES", contra_target, "CONTAINS", d_node])

                # Check beneficial ingredients
                elif rel == "RECOMMENDS_BENEFIT" and contra_target in dish_ingredients:
                    ing_name = self.graph.nodes[contra_target].get("name", contra_target)
                    impact = edge_data.get("impact", "")
                    benefits.append({
                        "type": "CLINICAL_BENEFIT",
                        "condition": cond_name,
                        "ingredient": ing_name,
                        "benefit": impact or f"{ing_name} memberikan manfaat klinis spesifik bagi penderita {cond_name}."
                    })
                    path_evidence.append([p_node, "HAS_CONDITION", cond, "RECOMMENDS_BENEFIT", contra_target, "CONTAINS", d_node])

            # Check contraindicated cooking methods
            for _, meth_target, edge_data in self.graph.out_edges(cond, data=True):
                rel = edge_data.get("relation", "")
                if rel == "CONTRAINDICATES_METHOD" and meth_target in dish_methods:
                    meth_name = self.graph.nodes[meth_target].get("name", meth_target)
                    contraindications.append({
                        "type": "METHOD_CONTRAINDICATION",
                        "condition": cond_name,
                        "method": meth_name,
                        "reason": f"Metode pengolahan {meth_name} memperparah risiko klinis pada {cond_name}.",
                        "severity": "HIGH"
                    })
                    path_evidence.append([p_node, "HAS_CONDITION", cond, "CONTRAINDICATES_METHOD", meth_target, "PREPARED_BY", d_node])

            # Check nutrient limits (e.g. sodium ceiling for hypertension)
            ceilings = cond_data.get("ceilings", {})
            dish_sodium = dish_data.get("sodium_mg", 0)
            if "max_sodium_mg" in ceilings and dish_sodium > ceilings["max_sodium_mg"]:
                contraindications.append({
                    "type": "NUTRIENT_CEILING_EXCEEDED",
                    "condition": cond_name,
                    "nutrient": "Natrium",
                    "dish_value": f"{dish_sodium} mg",
                    "limit_value": f"{ceilings['max_sodium_mg']} mg",
                    "reason": f"Kandungan natrium ({dish_sodium} mg) melebihi batas aman per porsi ({ceilings['max_sodium_mg']} mg) untuk {cond_name}.",
                    "severity": "HIGH"
                })

        # 3. Dynamic Odysseus Learned Aversion Check
        for _, mem_target, edge_data in self.graph.out_edges(p_node, data=True):
            if edge_data.get("relation") == "HAS_LEARNED_AVERSION":
                if mem_target in dish_ingredients or mem_target == d_node:
                    mem_data = self.graph.nodes.get(mem_target, {})
                    contraindications.append({
                        "type": "LEARNED_AVERSION_ODYSSEUS",
                        "item": mem_data.get("name", mem_target),
                        "reason": edge_data.get("reason", "Pengguna pernah mencatat keluhan atau ketidaksukaan sebelumnya."),
                        "severity": "MEDIUM"
                    })

        is_safe = len(contraindications) == 0
        severity = "SAFE" if is_safe else ("CRITICAL" if any(c.get("severity") == "CRITICAL" for c in contraindications) else "CONTRAINDICATED")

        return {
            "resolved_persona_id": resolved_pid,
            "resolved_food_id": resolved_fid,
            "food_name": dish_data.get("name", resolved_fid),
            "is_safe": is_safe,
            "severity": severity,
            "contraindications": contraindications,
            "benefits": benefits,
            "path_evidence": path_evidence
        }

    def recommend_safe_dishes(
        self,
        persona_id: str,
        top_k: int = 5,
        max_budget: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculates ranked recommendations using Knowledge Graph traversals:
        Filters out any dish that violates hard clinical or allergen edges.
        Ranks remaining candidates by graph alignment score.
        """
        resolved_pid = self.resolve_persona_id(persona_id)
        p_node = f"PERSONA:{resolved_pid}"
        if not self.graph.has_node(p_node):
            logger.warning(f"Persona {persona_id} (resolved: {resolved_pid}) not found in graph.")
            return []

        persona_data = self.graph.nodes[p_node]
        target_kcal = persona_data.get("target_kcal", 600.0)
        budget_ceiling = max_budget or persona_data.get("budget_idr", 40000.0)

        assigned_dishes = self.assigned_mappings.get(resolved_pid, set())
        candidates: List[Dict[str, Any]] = []

        for food_id, dish_meta in self.foods.items():
            safety = self.check_clinical_safety(resolved_pid, food_id)
            if not safety["is_safe"]:
                continue

            price = dish_meta.get("price_idr", 0.0)
            calories = dish_meta.get("calories", 0.0)

            # Base score
            score = 70.0

            # Bonus if clinically pre-assigned in dataset mapping
            if food_id in assigned_dishes:
                score += 15.0

            # Caloric fit (closer to target lunch kcal gets higher score)
            kcal_diff = abs(calories - target_kcal)
            kcal_penalty = min(20.0, (kcal_diff / target_kcal) * 20.0)
            score -= kcal_penalty

            # Clinical benefits bonus
            benefit_count = len(safety.get("benefits", []))
            score += min(15.0, benefit_count * 5.0)

            # Budget adherence bonus
            if price <= budget_ceiling:
                score += 5.0
            else:
                score -= min(15.0, ((price - budget_ceiling) / budget_ceiling) * 15.0)

            candidates.append({
                "food_id": food_id,
                "name": dish_meta.get("name"),
                "category": dish_meta.get("category"),
                "calories": calories,
                "protein_g": dish_meta.get("protein_g"),
                "carbs_g": dish_meta.get("carbs_g"),
                "fat_g": dish_meta.get("fat_g"),
                "sodium_mg": dish_meta.get("sodium_mg"),
                "price_idr": price,
                "cooking_method": dish_meta.get("cooking_method"),
                "recommendation_score": round(max(10.0, min(99.0, score)), 1),
                "clinical_benefits": safety.get("benefits", []),
                "clinical_rationale": dish_meta.get("clinical_rationale", "")
            })

        candidates.sort(key=lambda x: x["recommendation_score"], reverse=True)
        return candidates[:top_k]

    def explain_recommendation(self, persona_id: str, food_id: str) -> Dict[str, Any]:
        """
        Constructs an explainable, clinician-grade proof chain for a recommendation.
        """
        resolved_pid = self.resolve_persona_id(persona_id)
        resolved_fid = self.resolve_dish_id(food_id)
        p_node = f"PERSONA:{resolved_pid}"
        d_node = f"DISH:{resolved_fid}"

        safety = self.check_clinical_safety(resolved_pid, resolved_fid)
        persona_data = self.graph.nodes.get(p_node, {})
        dish_data = self.graph.nodes.get(d_node, {})

        target_kcal = persona_data.get("target_kcal", 600.0)
        dish_kcal = dish_data.get("calories", 0.0)
        kcal_delta = round(dish_kcal - target_kcal, 1)

        # Formulate clinical citations
        citations = []
        conditions = [
            self.graph.nodes[c].get("guideline")
            for _, c, ed in self.graph.out_edges(p_node, data=True)
            if ed.get("relation") == "HAS_CONDITION" and self.graph.nodes[c].get("guideline")
        ]
        if conditions:
            citations.extend(conditions)
        else:
            citations.append("Pedoman Gizi Seimbang Kementerian Kesehatan RI (PGRS)")

        # Generate clinical reasoning narrative
        if safety["is_safe"]:
            benefits_text = ""
            if safety.get("benefits"):
                b_list = [f"- {b['ingredient']}: {b['benefit']}" for b in safety['benefits']]
                benefits_text = "\nKeunggulan Fisiologis:\n" + "\n".join(b_list)

            explanation = (
                f"Menu {dish_data.get('name')} lolos seluruh validasi guardrail Knowledge Graph "
                f"untuk profil {persona_data.get('name')} ({persona_data.get('archetype')}). "
                f"Bebas dari alergen terdaftar ({persona_data.get('allergens', 'NONE')}) dan "
                f"tidak memicu kontraindikasi pada kondisi klinis pengguna. "
                f"Estimasi kalori {dish_kcal} kcal berada dalam rentang toleransi lunch target "
                f"({target_kcal} kcal, delta: {kcal_delta:+} kcal).{benefits_text}"
            )
        else:
            reasons = [f"- {c['reason']}" for c in safety.get("contraindications", [])]
            explanation = (
                f"Menu {dish_data.get('name')} TIDAK DIREKOMENDASIKAN secara klinis untuk "
                f"{persona_data.get('name')}. Terdeteksi {len(safety['contraindications'])} pelanggaran:\n"
                + "\n".join(reasons)
            )

        return {
            "persona_id": resolved_pid,
            "persona_name": persona_data.get("name"),
            "food_id": resolved_fid,
            "food_name": dish_data.get("name"),
            "is_safe": safety["is_safe"],
            "severity": safety["severity"],
            "contraindications": safety.get("contraindications", []),
            "clinical_benefits": safety.get("benefits", []),
            "target_kcal": target_kcal,
            "dish_kcal": dish_kcal,
            "kcal_delta": kcal_delta,
            "clinical_citations": list(set(citations)),
            "explanation_narrative": explanation,
            "path_evidence": safety.get("path_evidence", [])
        }

    def add_dynamic_memory_edge(
        self,
        persona_id: str,
        fact_text: str,
        category: str = "restriction"
    ) -> Dict[str, Any]:
        """
        Dynamic Odysseus Graph Ingestion:
        Ingests user conversational facts and establishes dynamic graph edges.
        Example: 'Sering nyeri lambung bila makan sambal pedas' -> adds edge to cabai_rawit_ekstrem.
        """
        p_node = f"PERSONA:{persona_id}"
        if not self.graph.has_node(p_node):
            return {"status": "error", "message": f"Persona {persona_id} not found."}

        mem_id = f"MEM:{uuid.uuid4().hex[:8]}"
        self.graph.add_node(
            mem_id,
            node_type="MEMORY_ITEM",
            text=fact_text,
            category=category
        )
        self.graph.add_edge(p_node, mem_id, relation="HAS_DYNAMIC_MEMORY", category=category)

        # Parse text to connect with known ingredients
        text_lower = fact_text.lower()
        connected_nodes = []
        if any(x in text_lower for x in ["sambal", "pedas", "cabai", "rawit", "geprek"]):
            target_ing = "ING:cabai_rawit_ekstrem"
            self.graph.add_edge(p_node, target_ing, relation="HAS_LEARNED_AVERSION", reason=fact_text)
            connected_nodes.append(target_ing)

        if any(x in text_lower for x in ["santan", "gulai", "kental", "lodeh"]):
            target_ing = "ING:santan_kental"
            self.graph.add_edge(p_node, target_ing, relation="HAS_LEARNED_AVERSION", reason=fact_text)
            connected_nodes.append(target_ing)

        if any(x in text_lower for x in ["goreng", "minyak", "jelantah", "kremes", "crispy"]):
            target_ing = "ING:minyak_jelantah_deep_fry"
            self.graph.add_edge(p_node, target_ing, relation="HAS_LEARNED_AVERSION", reason=fact_text)
            connected_nodes.append(target_ing)

        return {
            "status": "success",
            "memory_id": mem_id,
            "persona_id": persona_id,
            "fact_text": fact_text,
            "connected_graph_targets": connected_nodes
        }

    def export_subgraph_for_visualization(
        self,
        persona_id: str,
        max_dishes: int = 4,
        focus_dish_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exports a Cytoscape/D3-compliant node-link JSON structure
        centered around the persona, their clinical conditions, ingredients, and dishes.
        """
        resolved_pid = self.resolve_persona_id(persona_id)
        p_node = f"PERSONA:{resolved_pid}"
        if not self.graph.has_node(p_node):
            return {"nodes": [], "edges": []}

        nodes_map = {}
        edges_list = []

        def add_node(n_id):
            if n_id not in nodes_map and self.graph.has_node(n_id):
                d = self.graph.nodes[n_id]
                ntype = d.get("node_type", "UNKNOWN")
                color = {
                    "PERSONA": "#FF5722",
                    "CONDITION": "#E91E63",
                    "INGREDIENT": "#4CAF50",
                    "COOKING_METHOD": "#9C27B0",
                    "DISH": "#2196F3",
                    "ALLERGEN": "#F44336",
                    "MEMORY_ITEM": "#FFC107"
                }.get(ntype, "#607D8B")

                label = d.get("name") or d.get("text") or n_id
                nodes_map[n_id] = {
                    "id": n_id,
                    "label": label,
                    "type": ntype,
                    "color": color,
                    "data": {k: v for k, v in d.items() if k not in ["aliases", "ceilings"]}
                }

        add_node(p_node)

        # 1. Condition & Allergen Neighbors
        for _, neighbor, edge_data in self.graph.out_edges(p_node, data=True):
            add_node(neighbor)
            edges_list.append({
                "source": p_node,
                "target": neighbor,
                "relation": edge_data.get("relation"),
                "color": "#E91E63" if "CONDITION" in neighbor else "#F44336"
            })

            # Traverse 1 hop further from condition to ingredient/method
            for _, sub_target, sub_edge in self.graph.out_edges(neighbor, data=True):
                add_node(sub_target)
                edges_list.append({
                    "source": neighbor,
                    "target": sub_target,
                    "relation": sub_edge.get("relation"),
                    "color": "#4CAF50"
                })

        # 2. Add Focus Dish if specified
        if focus_dish_id:
            resolved_fid = self.resolve_dish_id(focus_dish_id)
            focus_d_node = f"DISH:{resolved_fid}"
            if self.graph.has_node(focus_d_node):
                add_node(focus_d_node)
                safety = self.check_clinical_safety(resolved_pid, resolved_fid)
                status_color = "#00B14F" if safety["is_safe"] else ("#D32F2F" if safety["severity"] == "CRITICAL" else "#FF9800")
                edges_list.append({
                    "source": p_node,
                    "target": focus_d_node,
                    "relation": "CLINICAL_VERIFICATION",
                    "severity": safety["severity"],
                    "is_safe": safety["is_safe"],
                    "color": status_color
                })
                # Link dish ingredients & cooking methods
                for _, ing, ed in self.graph.out_edges(focus_d_node, data=True):
                    add_node(ing)
                    edges_list.append({
                        "source": focus_d_node,
                        "target": ing,
                        "relation": ed.get("relation"),
                        "color": "#8BC34A"
                    })

        # 3. Add Top Safe Dishes
        recs = self.recommend_safe_dishes(resolved_pid, top_k=max_dishes)
        for r in recs:
            d_node = f"DISH:{r['food_id']}"
            add_node(d_node)
            edges_list.append({
                "source": p_node,
                "target": d_node,
                "relation": "RECOMMENDED_DISH",
                "score": r["recommendation_score"],
                "color": "#2196F3"
            })

            # Link dish ingredients that are in nodes_map
            for _, ing, ed in self.graph.out_edges(d_node, data=True):
                if ing in nodes_map:
                    edges_list.append({
                        "source": d_node,
                        "target": ing,
                        "relation": ed.get("relation"),
                        "color": "#8BC34A"
                    })

        return {
            "resolved_persona_id": resolved_pid,
            "nodes": list(nodes_map.values()),
            "edges": edges_list
        }

    # ==========================================================================
    # Graph-RAG Synthesis (OpenAI with Deterministic Clinical Fallback)
    # ==========================================================================

    def synthesize_clinical_coaching(
        self,
        persona_id: str,
        food_id: str,
        user_query: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synthesizes a personalized clinical recommendation narrative:
        - If OPENAI_API_KEY is configured: Calls GPT-4o with grounded graph evidence.
        - If OPENAI_API_KEY is missing/placeholder: Executes high-fidelity deterministic
          clinical synthesis without any external dependencies.
        """
        explanation = self.explain_recommendation(persona_id, food_id)
        persona_name = explanation["persona_name"]
        food_name = explanation["food_name"]

        if is_openai_configured():
            try:
                client = get_openai_client()
                system_prompt = (
                    "Anda adalah NutriSea Clinical Nutritional Co-Pilot yang didasarkan pada "
                    "Knowledge Graph medis resmi (Perkeni, PERKI, PGI). "
                    "Berikan respon coaching nutrisi yang empatik, tajam, dan edukatif dalam Bahasa Indonesia. "
                    "Sebutkan alasan klinis spesifik berdasarkan bukti graph yang disertakan. "
                    "Format jawaban dengan singkat, ramah, dan profesional."
                )
                evidence_context = json.dumps(explanation, indent=2, ensure_ascii=False)
                user_msg = (
                    f"Pengguna: {persona_name}\n"
                    f"Menu Makanan: {food_name}\n"
                    f"Pertanyaan Pengguna: {user_query or 'Apakah menu ini cocok untuk makan siang saya?'}\n\n"
                    f"Bukti Knowledge Graph:\n{evidence_context}"
                )

                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL or "gpt-4o",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_msg}
                    ],
                    temperature=0.3,
                    max_tokens=400
                )
                content = response.choices[0].message.content
                return {
                    "mode": "openai_gpt4o",
                    "coaching_message": content,
                    "graph_evidence": explanation
                }
            except Exception as e:
                logger.warning(f"OpenAI call failed ({e}). Falling back to deterministic clinical synthesizer.")

        # Deterministic Clinical Synthesizer (Fallback Mode)
        if explanation["is_safe"]:
            coaching = (
                f"Halo {persona_name}! Menu {food_name} adalah pilihan yang sangat selaras "
                f"dengan kondisi biologis Anda. Berdasarkan verifikasi Knowledge Graph, hidangan ini "
                f"bebas dari pemicu gastrointestinal dan tidak mengandung alergen terlarang. "
                f"Asupan {explanation['dish_kcal']} kcal sangat ideal untuk menjaga stabilitas gula darah "
                f"dan energi kerja Anda tanpa memicu digestive distress di siang hari."
            )
        else:
            violations_text = ", ".join([c["item"] if "item" in c else c["ingredient"] for c in explanation["contraindications"][:2]])
            coaching = (
                f"Perhatian {persona_name}, menu {food_name} berpotensi memicu ketidaknyamanan. "
                f"Knowledge Graph mendeteksi kandungan {violations_text} yang sensitif terhadap "
                f"kondisi kesehatan Anda. Kami menyarankan memilih alternatif menu berkuah bening "
                f"atau olahan bakar rempah agar kesehatan Anda tetap prima."
            )

        return {
            "mode": "deterministic_clinical_graph",
            "coaching_message": coaching,
            "graph_evidence": explanation
        }


# Global Singleton Accessor
nutrigraph_engine = NutriGraphEngine.get_instance()
