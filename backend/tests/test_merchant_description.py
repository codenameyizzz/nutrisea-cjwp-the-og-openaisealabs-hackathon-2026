import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

if os.getenv("NUTRISEA_TESTING") != "1":
    raise RuntimeError("Use python scripts/run_backend_tests.py test_merchant_description.py")

from pydantic import ValidationError
from backend.app.api import merchant


class MerchantDescriptionTests(unittest.TestCase):
    def setUp(self):
        self.config = patch.object(merchant, "settings", SimpleNamespace(
            is_openai_configured=True, OPENAI_MODEL="isolated-test-model"))
        self.config.start()
        self.addCleanup(self.config.stop)
        self.client = MagicMock()
        self.client_patch = patch.object(merchant, "get_openai_client", return_value=self.client)
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)

    def response(self, content):
        self.client.chat.completions.create.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    def test_ai_draft_reports_source_and_requests_english_copy(self):
        self.response('"Rice with steamed tofu."')
        request = merchant.DishDescriptionRequest(dish_name="Rice", ingredients=["100 gram tofu"])
        result = merchant.generate_dish_description(request)
        self.assertEqual(result, {"description": "Rice with steamed tofu.", "source": "ai_generated"})
        self.assertIn("English", self.client.chat.completions.create.call_args.kwargs["messages"][0]["content"])

    def test_provider_failure_fallback_contains_only_supplied_details(self):
        self.client.chat.completions.create.side_effect = RuntimeError("synthetic failure")
        result = merchant.generate_dish_description(merchant.DishDescriptionRequest(
            dish_name="Rice", ingredients=["100 gram rice"], cooking_notes="Steamed"))
        self.assertEqual(result, {"description": "Rice. Ingredients: 100 gram rice. Steamed.", "source": "input_template"})
        self.assertNotIn("fresh", result["description"].lower())
        self.assertNotIn("spices", result["description"].lower())

    def test_missing_configuration_does_not_attempt_provider_request(self):
        merchant.settings.is_openai_configured = False
        with patch.object(merchant, "get_openai_client") as factory:
            result = merchant.generate_dish_description(merchant.DishDescriptionRequest(dish_name="Rice"))
        factory.assert_not_called()
        self.assertEqual(result, {"description": "Rice.", "source": "input_template"})

    def test_empty_ai_response_uses_truthful_template_and_length_is_bounded(self):
        self.response("")
        result = merchant.generate_dish_description(merchant.DishDescriptionRequest(dish_name="Rice"))
        self.assertEqual(result["source"], "input_template")
        self.response("A" * 700)
        result = merchant.generate_dish_description(merchant.DishDescriptionRequest(dish_name="Rice"))
        self.assertEqual(len(result["description"]), 500)

    def test_request_accepts_recipe_limit_and_rejects_oversized_inputs(self):
        request = merchant.DishDescriptionRequest(dish_name="Rice", ingredients=["1 gram rice"] * 100)
        self.assertEqual(len(request.ingredients), 100)
        for values in [{"ingredients": ["x"] * 101}, {"ingredients": ["x" * 201]}, {"dish_name": " "}]:
            with self.assertRaises(ValidationError):
                merchant.DishDescriptionRequest(**{"dish_name": "Rice", **values})
        self.assertTrue(any(dependency.dependency is merchant.require_merchant for dependency in merchant.router.dependencies))


if __name__ == "__main__":
    unittest.main()
