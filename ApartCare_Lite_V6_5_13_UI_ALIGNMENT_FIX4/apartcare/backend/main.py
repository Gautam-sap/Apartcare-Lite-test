from fastapi import FastAPI
from starlette.types import Scope, Receive, Send
from app.main import app as core_app

class StripApiPrefix:
    """Expose the existing FastAPI routes below /api for Vercel Services."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] in {"http", "websocket"} and scope.get("path", "").startswith("/api"):
            scope = dict(scope)
            new_path = scope["path"][4:]
            scope["path"] = new_path or "/"
            if "raw_path" in scope:
                scope["raw_path"] = scope["raw_path"][4:] or b"/"
        await self.app(scope, receive, send)

app = FastAPI(title="ApartCare Lite API Service", version="6.5.13")
app.add_middleware(StripApiPrefix)
app.mount("/", core_app)
