"""Local ASGI compatibility entrypoint. Vercel production uses the backend service."""
from backend.app.main import app
__all__ = ["app"]
