"""Google OAuth 2.0 / OpenID Connect helpers.

HTTP calls are kept in small module-level functions so tests can monkeypatch them.
"""

import logging
import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPE = "openid email profile"
HTTP_TIMEOUT_SECONDS = 10.0


class GoogleOAuthError(Exception):
    """Raised when the Google OAuth exchange or userinfo lookup fails."""


@dataclass(frozen=True)
class GoogleUserInfo:
    google_id: str
    email: str
    email_verified: bool
    full_name: str | None
    avatar_url: str | None


def is_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def generate_state() -> str:
    return secrets.token_urlsafe(32)


def build_authorization_url(state: str) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_SCOPE,
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_token(code: str) -> str:
    """Exchange an authorization code for a Google access token."""
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        logger.warning("Google token exchange request failed: %s", exc)
        raise GoogleOAuthError("token_exchange_failed") from exc
    if response.status_code != 200:
        logger.warning("Google token exchange returned status %s", response.status_code)
        raise GoogleOAuthError("token_exchange_failed")
    payload: dict[str, Any] = response.json()
    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise GoogleOAuthError("token_exchange_failed")
    return access_token


async def fetch_user_info(access_token: str) -> GoogleUserInfo:
    """Fetch the OpenID Connect userinfo for the given Google access token."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.get(
                GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
    except httpx.HTTPError as exc:
        logger.warning("Google userinfo request failed: %s", exc)
        raise GoogleOAuthError("userinfo_failed") from exc
    if response.status_code != 200:
        logger.warning("Google userinfo returned status %s", response.status_code)
        raise GoogleOAuthError("userinfo_failed")
    return parse_user_info(response.json())


def parse_user_info(payload: dict[str, Any]) -> GoogleUserInfo:
    google_id = payload.get("sub") or payload.get("id")
    email = payload.get("email")
    if not isinstance(google_id, str) or not google_id or not isinstance(email, str) or not email:
        raise GoogleOAuthError("userinfo_incomplete")
    verified = payload.get("email_verified", payload.get("verified_email", False))
    if isinstance(verified, str):
        verified = verified.lower() == "true"
    name = payload.get("name")
    picture = payload.get("picture")
    return GoogleUserInfo(
        google_id=google_id,
        email=email.strip().lower(),
        email_verified=bool(verified),
        full_name=name if isinstance(name, str) and name else None,
        avatar_url=picture if isinstance(picture, str) and picture else None,
    )
