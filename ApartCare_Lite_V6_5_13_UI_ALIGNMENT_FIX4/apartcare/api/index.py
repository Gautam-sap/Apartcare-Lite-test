"""Vercel ASGI entrypoint for ApartCare Lite FastAPI."""
from backend.app.main import app

__all__ = ["app"]
