"""
API Routers Package.

Exports endpoint modules handling authentication, user profiles, workout plans,
sessions and logging, conversational AI coach, and progress analytics.
"""

from app.routers import auth, users, plans, chat, sessions, progress

__all__ = [
    "auth",
    "users",
    "plans",
    "chat",
    "sessions",
    "progress",
]
