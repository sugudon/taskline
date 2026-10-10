from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.auth import security
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.config import settings


def test_hash_and_verify_roundtrip() -> None:
    hashed = hash_password("s3cret-pass")
    assert hashed != "s3cret-pass"
    assert hashed.startswith("$2")
    assert verify_password("s3cret-pass", hashed)
    assert not verify_password("wrong-pass", hashed)


def test_hash_is_salted() -> None:
    assert hash_password("same-password") != hash_password("same-password")


def test_long_password_over_72_bytes_keeps_entropy() -> None:
    base = "a" * 72
    long_a = base + "X"
    long_b = base + "Y"
    hashed = hash_password(long_a)
    assert verify_password(long_a, hashed)
    # Differences past byte 72 must still matter (plain bcrypt would truncate them).
    assert not verify_password(long_b, hashed)
    assert not verify_password(base, hashed)


def test_multibyte_password_over_72_bytes() -> None:
    password = "é" * 40  # 80 bytes in UTF-8
    hashed = hash_password(password)
    assert verify_password(password, hashed)
    assert not verify_password("é" * 39, hashed)


def test_exactly_72_bytes_password() -> None:
    password = "b" * 72
    assert verify_password(password, hash_password(password))


@pytest.mark.parametrize("stored", [None, ""])
def test_verify_without_hash_is_false(stored: str | None) -> None:
    assert verify_password("anything", stored) is False


def test_verify_malformed_hash_is_false() -> None:
    assert verify_password("anything", "not-a-bcrypt-hash") is False


def test_access_token_payload() -> None:
    token = create_access_token(42)
    payload = decode_token(token, "access")
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "access"
    lifetime = payload["exp"] - payload["iat"]
    assert lifetime == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def test_refresh_token_payload_and_jti() -> None:
    token, jti, expires_at = create_refresh_token(7)
    payload = decode_token(token, "refresh")
    assert payload is not None
    assert payload["sub"] == "7"
    assert payload["jti"] == jti
    assert int(expires_at.timestamp()) == payload["exp"]
    assert expires_at > datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS - 1)
    # Each token is unique.
    other, other_jti, _ = create_refresh_token(7)
    assert other != token and other_jti != jti


def test_token_type_mismatch_rejected() -> None:
    access = create_access_token(1)
    refresh, _, _ = create_refresh_token(1)
    assert decode_token(access, "refresh") is None
    assert decode_token(refresh, "access") is None


def test_expired_token_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "1", "type": "access", "iat": now - timedelta(hours=2), "exp": now - timedelta(1)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    assert decode_token(token, "access") is None


def test_wrong_signature_rejected() -> None:
    token = jwt.encode(
        {"sub": "1", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "another-secret-key-that-is-long-enough-for-hs256-0123456789",
        algorithm="HS256",
    )
    assert decode_token(token, "access") is None


@pytest.mark.parametrize("missing", ["exp", "sub", "type"])
def test_missing_required_claim_rejected(missing: str) -> None:
    claims = {"sub": "1", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)}
    claims.pop(missing)
    token = jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert decode_token(token, "access") is None


def test_garbage_token_rejected() -> None:
    assert decode_token("not.a.jwt", "access") is None


def test_hash_token_is_sha256_hex() -> None:
    digest = hash_token("abc")
    assert len(digest) == 64
    assert digest == hash_token("abc")
    assert digest != hash_token("abd")


def test_prepare_password_prehashes_only_long_input() -> None:
    assert security._prepare_password("short") == b"short"
    assert len(security._prepare_password("x" * 100)) == 44
