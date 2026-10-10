"""Shared slowapi limiter (per client IP). Disabled via RATE_LIMIT_ENABLED=false."""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings

LOGIN_LIMIT = "5/minute"
REGISTER_LIMIT = "3/minute"
REFRESH_LIMIT = "30/minute"
PASSWORD_CHANGE_LIMIT = "5/minute"

limiter = Limiter(key_func=get_remote_address, enabled=settings.RATE_LIMIT_ENABLED)


async def rate_limit_exceeded_handler(request: Request, exc: Exception) -> JSONResponse:
    """Render 429 in the app's standard error shape."""
    limit = exc.detail if isinstance(exc, RateLimitExceeded) else ""
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Too many requests ({limit}). Please try again later.",
            "code": "RATE_LIMITED",
        },
        headers={"Retry-After": "60"},
    )
