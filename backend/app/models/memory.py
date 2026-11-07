"""
Memory Domain Models
Maps Odysseus-inspired Long-Term Memory (LTM) and Short-Term Memory (STM)
to production PostgreSQL schema (AppUser, HealthProfile, MealLog).
"""
from .user import (
    AppUser,
    HealthProfile,
    UserRole,
    UserSex,
    ActivityLevel,
    HealthGoal,
    utcnow
)
from .orders import (
    MealLog,
    MealSource,
    MealTypeEnum
)

# Backward-compatibility aliases for early prototype references
User = AppUser
DailySession = MealLog
