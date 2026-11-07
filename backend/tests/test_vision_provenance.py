import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from backend.app.ai import vision

class VisionProvenanceTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        with patch.object(vision, "get_openai_client", return_value=self.client):
            self.classifier = vision.PlateVisionClassifier()

    def test_missing_key_or_image_is_not_an_estimate(self):
        with patch.object(vision.settings, "OPENAI_API_KEY", ""):
            result = self.classifier.analyze_plate("synthetic")
        self.assertEqual(result["analysis_status"], "unavailable")
        self.assertIsNone(result["qualitative_kcal_estimate"])
        self.client.chat.completions.create.assert_not_called()

    def test_provider_error_and_invalid_response_do_not_invent_food(self):
        with patch.object(vision.settings, "OPENAI_API_KEY", "synthetic-only"):
            self.client.chat.completions.create.side_effect = RuntimeError("synthetic failure")
            result = self.classifier.analyze_plate("synthetic")
        self.assertEqual(result["analysis_source"], "unavailable")
        self.assertIsNone(result["detected_dish"])

    def test_success_has_estimate_provenance_and_no_automatic_logging_claim(self):
        self.client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"detected_dish":"synthetic dish","qualitative_kcal_estimate":123,"analysis_source":"lab"}'))])
        with patch.object(vision.settings, "OPENAI_API_KEY", "synthetic-only"):
            result = self.classifier.analyze_plate("synthetic")
        self.assertEqual(result["analysis_source"], "ai")
        self.assertEqual(result["analysis_status"], "success")
        self.assertEqual(result["qualitative_kcal_estimate"], 123)
        self.assertIn("belum dicatat", result["friendly_rebalance_note"])

    def test_supported_image_formats_reach_provider_with_their_original_type(self):
        self.client.chat.completions.create.return_value = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"detected_dish":"synthetic dish"}'))])
        with patch.object(vision.settings, "OPENAI_API_KEY", "synthetic-only"):
            for mime_type in ("image/jpeg", "image/png", "image/webp"):
                with self.subTest(mime_type=mime_type):
                    self.classifier.analyze_plate("synthetic", mime_type)
                    content = self.client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
                    self.assertEqual(content[1]["image_url"]["url"], f"data:{mime_type};base64,synthetic")
