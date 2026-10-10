"""Password hashing (bcrypt) and JWT creation/decoding (PyJWT)."""

import base64
import hashlib
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from functools import cache
from typing import Any, Literal

import bcrypt
import jwt

from app.config import settings

logger = logging.getLogger(__name__)

TokenType = Literal["access", "refresh"]

_BCRYPT_MAX_BYTES = 72


def _prepare_password(password: str) -> bytes:
    """Encode a password for bcrypt.

    bcrypt only uses the first 72 bytes (and bcrypt>=4.1 raises on longer input), so longer
    passwords are pre-hashed with SHA-256 and base64-encoded (44 bytes) to keep all entropy.
    """
    raw = password.encode("utf-8")
    if len(raw) > _BCRYPT_MAX_BYTES:
        return base64.b64encode(hashlib.sha256(raw).digest())
    return raw


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare_password(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_prepare_password(plain_password), hashed_password.encode("utf-8"))
    except ValueError:
        logger.warning("Malformed password hash encountered during verification")
        return False


@cache
def _dummy_hash() -> str:
    """A real bcrypt hash of a random value, computed once, used for timing equalization."""
    return hash_password(secrets.token_urlsafe(32))


def burn_password_check(plain_password: str) -> None:
    """Run a bcrypt verification that always fails, so unknown users cost the same time."""
    verify_password(plain_password, _dummy_hash())


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return _encode(payload)


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    """Create a refresh token. Returns (token, jti, expires_at)."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    jti = uuid.uuid4().hex
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    return _encode(payload), jti, expires_at


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any] | None:
    """Decode and validate a JWT. Returns the payload, or None if invalid/expired/wrong type."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload


def hash_token(token: str) -> str:
    """SHA-256 hex digest of a token (stored instead of the raw refresh token)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
