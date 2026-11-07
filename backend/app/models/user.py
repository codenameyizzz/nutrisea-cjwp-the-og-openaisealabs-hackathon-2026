"""
User & Profile Models (Re-export)
Canonical definitions:
- app_user.py
- health_profile.py
"""
from .app_user import AppUser, UserRole
from .health_profile import HealthProfile, UserSex, ActivityLevel, HealthGoal

__all__ = [
    "AppUser",
    "HealthProfile",
    "UserRole",
    "UserSex",
    "ActivityLevel",
    "HealthGoal"
]
