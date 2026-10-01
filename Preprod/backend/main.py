"""Vercel Services entrypoint for ApartCare Lite FastAPI.

This wrapper deliberately keeps startup minimal.  It exposes /health without
importing the large application module, then lazily imports the real FastAPI
application for other requests.  If the application import fails, the caller
gets the actual exception as JSON instead of Vercel's generic
FUNCTION_INVOCATION_FAILED page.
"""
import json
import traceback
from typing import Any

_core_app = None
_core_import_error = None


def _json_response(send, status: int, payload: dict[str, Any]):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = [
        (b"content-type", b"application/json; charset=utf-8"),
        (b"content-length", str(len(body)).encode("ascii")),
        (b"cache-control", b"no-store"),
    ]
    async def _send():
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})
    return _send


def _load_core():
    global _core_app, _core_import_error
    if _core_app is not None:
        return _core_app
    if _core_import_error is not None:
        raise _core_import_error
    try:
        from app.main import app as core_app
        _core_app = core_app
        return _core_app
    except Exception as exc:
        _core_import_error = exc
        raise


async def app(scope, receive, send):
    if scope.get("type") != "http":
        try:
            core = _load_core()
            await core(scope, receive, send)
        except Exception as exc:
            await _json_response(send, 500, {
                "status": "backend_import_failed",
                "error_type": type(exc).__name__,
                "error": str(exc),
            })()
        return

    path = scope.get("path", "")
    public_path = path
    if public_path == "/api":
        public_path = "/"
    elif public_path.startswith("/api/"):
        public_path = public_path[4:]

    # Minimal health probe: this proves the Vercel Python function itself is alive.
    # It intentionally does not touch Postgres or import the large application.
    if public_path == "/health":
        await _json_response(send, 200, {
            "status": "ok",
            "version": "6.5.13",
            "build": "CLEAN_UI_BUILD_2",
            "service": "apartcare-fastapi",
            "runtime": "vercel-services",
            "core_loaded": _core_app is not None,
        })()
        return

    try:
        core = _load_core()
    except Exception as exc:
        await _json_response(send, 500, {
            "status": "backend_import_failed",
            "error_type": type(exc).__name__,
            "error": str(exc),
            "traceback_tail": traceback.format_exc().splitlines()[-12:],
        })()
        return

    # Services routes are currently public as /api/*. The application itself
    # keeps its legacy /health, /account/* and /platform/* route definitions.
    forwarded = dict(scope)
    forwarded["path"] = public_path
    raw_path = forwarded.get("raw_path")
    if raw_path:
        if raw_path == b"/api":
            forwarded["raw_path"] = b"/"
        elif raw_path.startswith(b"/api/"):
            forwarded["raw_path"] = raw_path[4:]
    await core(forwarded, receive, send)
