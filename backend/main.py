"""
Top-level application entrypoint for deployment platforms (Vercel, Railway, Docker, Uvicorn).

Exposes the FastAPI 'app' instance from app.main.
"""

from app.main import app

__all__ = ["app"]
