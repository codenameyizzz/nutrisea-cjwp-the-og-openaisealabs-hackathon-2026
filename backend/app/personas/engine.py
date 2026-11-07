from typing import Dict, Any, List
from .presets import PERSONA_PRESETS

class PersonaSynthesizer:
    """
    Behavioral profiling engine inspired by Odysseus.
    Synthesizes active user constraints and learns from implicit interactions (such as menu swaps).
    """
    def __init__(self, default_persona_id: str = "CORP_LILY_SCBD"):
        self.active_persona_id = default_persona_id
        self._learned_swaps: List[Dict[str, str]] = []

    def get_persona(self, persona_id: str = None) -> Dict[str, Any]:
        target_id = persona_id or self.active_persona_id
        return PERSONA_PRESETS.get(target_id, PERSONA_PRESETS["CORP_LILY_SCBD"])

    def record_meal_swap(self, rejected_item: str, accepted_item: str):
        """
        Implicit learning: logs swap choices without interrupting user with surveys.
        """
        self._learned_swaps.append({
            "rejected": rejected_item,
            "accepted": accepted_item
        })

    def get_effective_constraints(self, persona_id: str = None) -> Dict[str, Any]:
        persona = self.get_persona(persona_id)
        constraints = dict(persona["constraints"])
        constraints["biometrics"] = persona["biometrics"]
        return constraints
