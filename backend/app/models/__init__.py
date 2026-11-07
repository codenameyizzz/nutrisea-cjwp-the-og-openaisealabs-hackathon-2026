"""
NutriSea Domain Models
Each table has its own dedicated model file in app/models/:
- app_user.py                -> AppUser ('app_user')
- health_profile.py          -> HealthProfile ('health_profile')
- merchant.py                -> Merchant ('merchant')
- restaurant.py              -> Restaurant ('restaurant')
- menu_item.py               -> MenuItem ('menu_item')
- menu_item_tag.py           -> MenuItemTag ('menu_item_tag')
- recommendation.py          -> Recommendation ('recommendation')
- order.py                   -> Order ('orders')
- order_item.py              -> OrderItem ('order_item')
- meal_log.py                -> MealLog ('meal_log')
- reward_ledger.py           -> RewardLedger ('reward_ledger')
- merchant_demand_insight.py -> MerchantDemandInsight ('merchant_demand_insight')
- chat_message.py            -> ChatMessage ('chat_message')
- persona.py                 -> Persona ('persona')
- user_memory.py             -> UserMemoryItem ('user_memory_item')
"""
from .base import utcnow, JsonColumn
from .merchant_application import MerchantApplication
from .app_user import AppUser, UserRole
from .health_profile import HealthProfile, UserSex, ActivityLevel, HealthGoal
from .merchant import Merchant
from .restaurant import Restaurant
from .menu_item import MenuItem, MealSlot, NutritionSource
from .menu_item_tag import MenuItemTag, TagAuthor
from .recommendation import (
    Recommendation,
    RecommendationMealType,
    RecommendationSource,
    RecommendationStatus
)
from .order import Order, OrderStatus
from .order_item import OrderItem
from .meal_log import MealLog, MealSource, MealTypeEnum
from .reward_ledger import RewardLedger
from .merchant_demand_insight import MerchantDemandInsight
from .chat_message import ChatMessage
from .persona import Persona
from .user_memory import UserMemoryItem
from .user_action import UserActionLog
from .ingredient import Ingredient, IngredientAlias, MenuIngredient
from .ingredient_source import IngredientSourceFood, IngredientSourceServing

__all__ = [
    "Ingredient",
    "IngredientAlias",
    "MenuIngredient",
    "IngredientSourceFood",
    "IngredientSourceServing",
    # 16 Dedicated Models (1 per table)
    "AppUser",
    "HealthProfile",
    "Merchant",
    "Restaurant",
    "MenuItem",
    "MenuItemTag",
    "Recommendation",
    "Order",
    "OrderItem",
    "MealLog",
    "RewardLedger",
    "MerchantDemandInsight",
    "ChatMessage",
    "Persona",
    "UserMemoryItem",
    "UserActionLog",

    # Enums & Utilities
    "UserRole",
    "UserSex",
    "ActivityLevel",
    "HealthGoal",
    "MealSlot",
    "NutritionSource",
    "TagAuthor",
    "RecommendationMealType",
    "RecommendationSource",
    "RecommendationStatus",
    "OrderStatus",
    "MealSource",
    "MealTypeEnum",
    "JsonColumn",
    "utcnow"
]
