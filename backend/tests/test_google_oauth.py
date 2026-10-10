import asyncio
from collections.abc import Callable, Iterator
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import google
from app.auth.google import GoogleOAuthError, GoogleUserInfo
from app.config import settings
from app.models import User
from app.services import auth_service
from tests.conftest import DEFAULT_PASSWORD

API = "/api/v1/auth"
STATE = "known-state-value"
NONCE = "client-nonce_0123456789-abcdef"

MakeUser = Callable[..., User]


@pytest.fixture
def configured(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "client-secret")
    yield


def _fragment(response: httpx.Response) -> dict[str, str]:
    location = response.headers["location"]
    parsed = urlparse(location)
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == "http://frontend.test/auth/callback"
    return {k: v[0] for k, v in parse_qs(parsed.fragment).items()}


def _patch_google(
    monkeypatch: pytest.MonkeyPatch,
    info: GoogleUserInfo | None = None,
    exchange_error: str | None = None,
) -> None:
    async def fake_exchange(code: str) -> str:
        if exchange_error:
            raise GoogleOAuthError(exchange_error)
        assert code == "auth-code"
        return "google-access-token"

    async def fake_userinfo(token: str) -> GoogleUserInfo:
        assert token == "google-access-token"
        assert info is not None
        return info

    monkeypatch.setattr(google, "exchange_code_for_token", fake_exchange)
    monkeypatch.setattr(google, "fetch_user_info", fake_userinfo)


def _callback(
    client: TestClient,
    state: str | None = STATE,
    nonce: str | None = NONCE,
    **params: str,
) -> httpx.Response:
    query = {"code": "auth-code", "state": STATE, **params}
    if state is None:
        query.pop("state")
    else:
        query["state"] = state
    client.cookies.set("oauth_state", STATE)
    if nonce is not None:
        client.cookies.set("oauth_nonce", nonce)
    return client.get(f"{API}/google/callback", params=query, follow_redirects=False)


def _info(**overrides: object) -> GoogleUserInfo:
    data: dict[str, object] = {
        "google_id": "g-123",
        "email": "guser@example.com",
        "email_verified": True,
        "full_name": "Google User",
        "avatar_url": "https://lh3.example/avatar.png",
    }
    data.update(overrides)
    return GoogleUserInfo(**data)  # type: ignore[arg-type]


# ---------- /auth/google ----------


def test_google_login_not_configured(client: TestClient) -> None:
    response = client.get(f"{API}/google", follow_redirects=False)
    assert response.status_code == 503
    assert response.json()["code"] == "SERVICE_UNAVAILABLE"


def _set_cookies(response: httpx.Response) -> list[str]:
    return response.headers.get_list("set-cookie")


def test_google_login_redirects_with_state_cookie(client: TestClient, configured: None) -> None:
    response = client.get(f"{API}/google", params={"nonce": NONCE}, follow_redirects=False)
    assert response.status_code == 307
    location = urlparse(response.headers["location"])
    assert location.netloc == "accounts.google.com"
    query = parse_qs(location.query)
    assert query["client_id"] == [settings.GOOGLE_CLIENT_ID]
    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid email profile"]
    assert query["redirect_uri"] == [settings.GOOGLE_REDIRECT_URI]
    state = query["state"][0]
    assert len(state) >= 32

    cookies = _set_cookies(response)
    assert len(cookies) == 2
    state_cookie = next(c for c in cookies if c.startswith("oauth_state="))
    nonce_cookie = next(c for c in cookies if c.startswith("oauth_nonce="))
    assert state_cookie.startswith(f"oauth_state={state};")
    assert nonce_cookie.startswith(f"oauth_nonce={NONCE};")
    for cookie in cookies:
        assert "HttpOnly" in cookie
        assert "Max-Age=600" in cookie
        assert "samesite=lax" in cookie.lower()
        assert "Path=/" in cookie
        assert "Secure" not in cookie  # http redirect URI in tests


@pytest.mark.parametrize(
    "nonce",
    [None, "", "short", "x" * 15, "x" * 129, "has space in it 1234", "bad!chars#0123456789"],
)
def test_google_login_rejects_missing_or_invalid_nonce(
    client: TestClient, configured: None, nonce: str | None
) -> None:
    params = {} if nonce is None else {"nonce": nonce}
    response = client.get(f"{API}/google", params=params, follow_redirects=False)
    assert response.status_code == 307
    assert _fragment(response) == {"error": "invalid_request"}
    assert not any(
        c.startswith("oauth_state=") and 'oauth_state=""' not in c for c in _set_cookies(response)
    )


@pytest.mark.parametrize("nonce", ["a" * 16, "A-b_9" * 25 + "xyz"])
def test_google_login_accepts_boundary_nonces(
    client: TestClient, configured: None, nonce: str
) -> None:
    response = client.get(f"{API}/google", params={"nonce": nonce}, follow_redirects=False)
    assert urlparse(response.headers["location"]).netloc == "accounts.google.com"


def test_google_login_secure_cookie_for_https(
    client: TestClient, configured: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://api.example/cb")
    response = client.get(f"{API}/google", params={"nonce": NONCE}, follow_redirects=False)
    cookies = _set_cookies(response)
    assert len(cookies) == 2
    assert all("Secure" in c for c in cookies)


# ---------- /auth/google/callback ----------


def test_callback_not_configured(client: TestClient) -> None:
    response = _callback(client)
    assert response.status_code == 307
    assert _fragment(response) == {"error": "oauth_not_configured", "nonce": NONCE}


def test_callback_provider_error(client: TestClient, configured: None) -> None:
    response = _callback(client, error="access_denied")
    assert _fragment(response) == {"error": "access_denied", "nonce": NONCE}


@pytest.mark.parametrize("state", ["wrong-state", None])
def test_callback_bad_or_missing_state(
    client: TestClient, configured: None, state: str | None
) -> None:
    response = _callback(client, state=state)
    assert _fragment(response) == {"error": "invalid_state", "nonce": NONCE}


@pytest.mark.parametrize("nonce", [None, "short", "bad nonce value with spaces"])
def test_callback_missing_or_invalid_nonce_cookie(
    client: TestClient, configured: None, monkeypatch: pytest.MonkeyPatch, nonce: str | None
) -> None:
    _patch_google(monkeypatch, info=_info())
    response = _callback(client, nonce=nonce)
    assert _fragment(response) == {"error": "invalid_state"}


def test_callback_without_state_cookie(client: TestClient, configured: None) -> None:
    response = client.get(
        f"{API}/google/callback",
        params={"code": "auth-code", "state": STATE},
        follow_redirects=False,
    )
    assert _fragment(response) == {"error": "invalid_state"}


def test_callback_missing_code(client: TestClient, configured: None) -> None:
    client.cookies.set("oauth_state", STATE)
    client.cookies.set("oauth_nonce", NONCE)
    response = client.get(f"{API}/google/callback", params={"state": STATE}, follow_redirects=False)
    assert _fragment(response) == {"error": "missing_code", "nonce": NONCE}


def test_callback_exchange_failure(
    client: TestClient, configured: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_google(monkeypatch, exchange_error="token_exchange_failed")
    response = _callback(client)
    assert _fragment(response) == {"error": "token_exchange_failed", "nonce": NONCE}


def test_callback_creates_new_user(
    client: TestClient, configured: None, monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    _patch_google(monkeypatch, info=_info())
    response = _callback(client)
    assert response.status_code == 307
    fragment = _fragment(response)
    assert set(fragment) == {"access_token", "refresh_token", "nonce"}
    assert fragment["nonce"] == NONCE
    # Both OAuth cookies are cleared.
    cleared = _set_cookies(response)
    assert any(c.startswith('oauth_state="";') for c in cleared)
    assert any(c.startswith('oauth_nonce="";') for c in cleared)

    me = client.get(
        f"{API}/me", headers={"Authorization": f"Bearer {fragment['access_token']}"}
    ).json()
    assert me["email"] == "guser@example.com"
    assert me["oauth_provider"] == "google"
    assert me["has_password"] is False
    assert me["is_verified"] is True
    assert me["full_name"] == "Google User"
    assert me["avatar_url"] == "https://lh3.example/avatar.png"

    refreshed = client.post(f"{API}/refresh", json={"refresh_token": fragment["refresh_token"]})
    assert refreshed.status_code == 200


def test_callback_links_verified_password_account_keeps_password(
    client: TestClient,
    configured: None,
    monkeypatch: pytest.MonkeyPatch,
    make_user: MakeUser,
    db: Session,
) -> None:
    existing = make_user(email="guser@example.com", full_name="Original Name", is_verified=True)
    _patch_google(monkeypatch, info=_info())
    fragment = _fragment(_callback(client))
    assert "access_token" in fragment

    db.expire_all()
    users = db.scalars(select(User)).all()
    assert len(users) == 1
    linked = db.get(User, existing.id)
    assert linked is not None
    assert linked.google_id == "g-123"
    assert linked.oauth_provider == "google"
    assert linked.hashed_password is not None  # password login still works
    assert linked.full_name == "Original Name"  # not overwritten
    assert linked.avatar_url == "https://lh3.example/avatar.png"  # filled in


def test_callback_linking_unverified_password_account_clears_password_and_sessions(
    client: TestClient,
    configured: None,
    monkeypatch: pytest.MonkeyPatch,
    make_user: MakeUser,
    db: Session,
) -> None:
    """Pre-account takeover: an attacker registered the victim's email with a password."""
    squatter = make_user(email="guser@example.com", full_name="Squatter")
    attacker_session = client.post(
        f"{API}/login", data={"username": "guser@example.com", "password": DEFAULT_PASSWORD}
    ).json()

    _patch_google(monkeypatch, info=_info())
    fragment = _fragment(_callback(client))
    assert "access_token" in fragment

    db.expire_all()
    linked = db.get(User, squatter.id)
    assert linked is not None
    assert linked.hashed_password is None
    assert linked.is_verified is True
    assert linked.google_id == "g-123"
    # The attacker's password and refresh token no longer work; the Google session does.
    login = client.post(
        f"{API}/login", data={"username": "guser@example.com", "password": DEFAULT_PASSWORD}
    )
    assert login.status_code == 401
    fresh = client.post(f"{API}/refresh", json={"refresh_token": fragment["refresh_token"]})
    assert fresh.status_code == 200
    stale = client.post(f"{API}/refresh", json={"refresh_token": attacker_session["refresh_token"]})
    assert stale.status_code == 401


def test_callback_returning_user_matched_by_google_id(
    client: TestClient,
    configured: None,
    monkeypatch: pytest.MonkeyPatch,
    make_user: MakeUser,
    db: Session,
) -> None:
    existing = make_user(
        email="old@example.com", password=None, google_id="g-123", oauth_provider="google"
    )
    _patch_google(monkeypatch, info=_info(email="renamed@example.com"))
    fragment = _fragment(_callback(client))
    me = client.get(f"{API}/me", headers={"Authorization": f"Bearer {fragment['access_token']}"})
    assert me.json()["id"] == existing.id
    assert me.json()["email"] == "old@example.com"


def test_callback_unverified_email(
    client: TestClient, configured: None, monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    _patch_google(monkeypatch, info=_info(email_verified=False))
    assert _fragment(_callback(client)) == {"error": "email_not_verified", "nonce": NONCE}
    assert db.scalars(select(User)).all() == []


def test_callback_disabled_account(
    client: TestClient,
    configured: None,
    monkeypatch: pytest.MonkeyPatch,
    make_user: MakeUser,
) -> None:
    make_user(email="guser@example.com", is_active=False)
    _patch_google(monkeypatch, info=_info())
    assert _fragment(_callback(client)) == {"error": "account_disabled", "nonce": NONCE}


def test_callback_upsert_conflict(
    client: TestClient,
    configured: None,
    monkeypatch: pytest.MonkeyPatch,
    make_user: MakeUser,
) -> None:
    make_user(email="guser@example.com")
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, _email: None)
    _patch_google(monkeypatch, info=_info())
    assert _fragment(_callback(client)) == {"error": "account_conflict", "nonce": NONCE}


# ---------- google.py helpers ----------


def _patch_transport(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    real_client = httpx.AsyncClient

    def factory(*args: object, **kwargs: object) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(google.httpx, "AsyncClient", factory)


def test_is_configured(configured: None) -> None:
    assert google.is_configured() is True


def test_generate_state_is_random() -> None:
    assert google.generate_state() != google.generate_state()


def test_exchange_code_success(monkeypatch: pytest.MonkeyPatch, configured: None) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == google.GOOGLE_TOKEN_URL
        assert b"code=the-code" in request.content
        assert b"grant_type=authorization_code" in request.content
        return httpx.Response(200, json={"access_token": "tok"})

    _patch_transport(monkeypatch, handler)
    assert asyncio.run(google.exchange_code_for_token("the-code")) == "tok"


@pytest.mark.parametrize(
    "response",
    [httpx.Response(400, json={"error": "invalid_grant"}), httpx.Response(200, json={})],
)
def test_exchange_code_bad_response(
    monkeypatch: pytest.MonkeyPatch, response: httpx.Response
) -> None:
    _patch_transport(monkeypatch, lambda _r: response)
    with pytest.raises(GoogleOAuthError, match="token_exchange_failed"):
        asyncio.run(google.exchange_code_for_token("c"))


def test_exchange_code_network_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    _patch_transport(monkeypatch, handler)
    with pytest.raises(GoogleOAuthError, match="token_exchange_failed"):
        asyncio.run(google.exchange_code_for_token("c"))


def test_fetch_user_info_success(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer tok"
        return httpx.Response(
            200,
            json={
                "sub": "1",
                "email": " Mixed@Example.com ",
                "email_verified": True,
                "name": "N",
                "picture": "https://p",
            },
        )

    _patch_transport(monkeypatch, handler)
    info = asyncio.run(google.fetch_user_info("tok"))
    assert info == GoogleUserInfo("1", "mixed@example.com", True, "N", "https://p")


def test_fetch_user_info_bad_status(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_transport(monkeypatch, lambda _r: httpx.Response(401))
    with pytest.raises(GoogleOAuthError, match="userinfo_failed"):
        asyncio.run(google.fetch_user_info("tok"))


def test_fetch_user_info_network_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    _patch_transport(monkeypatch, handler)
    with pytest.raises(GoogleOAuthError, match="userinfo_failed"):
        asyncio.run(google.fetch_user_info("tok"))


def test_parse_user_info_legacy_fields_and_string_verified() -> None:
    info = google.parse_user_info({"id": "9", "email": "a@b.co", "verified_email": "TRUE"})
    assert info.google_id == "9"
    assert info.email_verified is True
    assert info.full_name is None and info.avatar_url is None
    unverified = google.parse_user_info({"sub": "9", "email": "a@b.co", "email_verified": "false"})
    assert unverified.email_verified is False
    missing_flag = google.parse_user_info({"sub": "9", "email": "a@b.co", "name": ""})
    assert missing_flag.email_verified is False
    assert missing_flag.full_name is None


@pytest.mark.parametrize("payload", [{"email": "a@b.co"}, {"sub": "1"}, {"sub": "", "email": "x"}])
def test_parse_user_info_incomplete(payload: dict[str, str]) -> None:
    with pytest.raises(GoogleOAuthError, match="userinfo_incomplete"):
        google.parse_user_info(payload)
