"""Rate limiting, settings validation, DB error handling, lifespan and migrations."""

import asyncio
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import IntegrityError, OperationalError

import app.main as main_module
from alembic import command
from app import database
from app.config import Settings, settings
from app.main import app
from app.models import User
from app.rate_limit import limiter
from app.services import project_service

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]
BACKEND_DIR = Path(__file__).resolve().parents[1]


# ---------- rate limiting ----------


@pytest.fixture
def rate_limited(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(limiter, "enabled", True)
    limiter.reset()
    yield
    limiter.reset()


def test_login_rate_limited_with_cors_headers(client: TestClient, rate_limited: None) -> None:
    origin = settings.cors_origins_list[0]
    form = {"username": "nobody@example.com", "password": "wrong-password"}
    for _ in range(5):
        response = client.post("/api/v1/auth/login", data=form, headers={"Origin": origin})
        assert response.status_code == 401
    response = client.post("/api/v1/auth/login", data=form, headers={"Origin": origin})
    assert response.status_code == 429
    body = response.json()
    assert body["code"] == "RATE_LIMITED"
    assert isinstance(body["detail"], str) and body["detail"]
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["retry-after"] == "60"


def test_register_rate_limited(client: TestClient, rate_limited: None) -> None:
    codes = [
        client.post(
            "/api/v1/auth/register", json={"email": f"r{i}@example.com", "password": "password123"}
        ).status_code
        for i in range(4)
    ]
    assert codes == [201, 201, 201, 429]


def test_password_change_rate_limited(
    client: TestClient, rate_limited: None, make_user: MakeUser, auth_headers: Headers
) -> None:
    headers = auth_headers(make_user())
    payload = {"current_password": "wrong-one", "new_password": "brand-new-pass"}
    codes = [
        client.put("/api/v1/auth/password", headers=headers, json=payload).status_code
        for _ in range(6)
    ]
    assert codes == [400] * 5 + [429]


def test_rate_limit_disabled_by_default_in_tests(client: TestClient) -> None:
    form = {"username": "nobody@example.com", "password": "wrong-password"}
    codes = {client.post("/api/v1/auth/login", data=form).status_code for _ in range(7)}
    assert codes == {401}


# ---------- SECRET_KEY validation ----------


@pytest.mark.parametrize(
    "key",
    ["change-me-to-a-long-random-string", "your-secret-key", "secret", "CHANGEME", "x" * 31],
)
def test_secret_key_rejected(key: str) -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(DATABASE_URL="sqlite://", SECRET_KEY=key, _env_file=None)  # type: ignore[call-arg]


def test_secret_key_accepted() -> None:
    key = "k" * 32
    assert Settings(DATABASE_URL="sqlite://", SECRET_KEY=key, _env_file=None).SECRET_KEY == key  # type: ignore[call-arg]


def test_backend_env_file_secret_key_is_valid() -> None:
    env_file = BACKEND_DIR / ".env"
    if not env_file.exists():
        pytest.skip("no backend/.env")
    values = dict(
        line.split("=", 1)
        for line in env_file.read_text().splitlines()
        if "=" in line and not line.lstrip().startswith("#")
    )
    key = values["SECRET_KEY"].strip().strip('"').strip("'")
    Settings(DATABASE_URL="sqlite://", SECRET_KEY=key, _env_file=None)  # type: ignore[call-arg]


# ---------- DB error handlers ----------


def _raise(exc: Exception) -> Callable[..., Any]:
    def _inner(*_args: object, **_kwargs: object) -> None:
        raise exc

    return _inner


def test_integrity_error_maps_to_409(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        project_service, "create_project", _raise(IntegrityError("INSERT", {}, Exception("dup")))
    )
    response = client.post(
        "/api/v1/projects", headers=auth_headers(make_user()), json={"name": "P"}
    )
    assert response.status_code == 409
    assert response.json() == {"detail": "Conflicting data", "code": "CONFLICT"}


def test_operational_error_maps_to_503_with_cors(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        project_service, "list_projects", _raise(OperationalError("SELECT", {}, Exception("down")))
    )
    origin = settings.cors_origins_list[0]
    response = client.get(
        "/api/v1/projects", headers={**auth_headers(make_user()), "Origin": origin}
    )
    assert response.status_code == 503
    assert response.json()["code"] == "SERVICE_UNAVAILABLE"
    assert response.headers["access-control-allow-origin"] == origin


class _SpySession:
    def __init__(self) -> None:
        self.rolled_back = False
        self.closed = False

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        self.closed = True


def test_get_db_rolls_back_on_error(monkeypatch: pytest.MonkeyPatch) -> None:
    spy = _SpySession()
    monkeypatch.setattr(database, "SessionLocal", lambda: spy)
    gen = database.get_db()
    assert next(gen) is spy
    with pytest.raises(RuntimeError):
        gen.throw(RuntimeError("boom"))
    assert spy.rolled_back and spy.closed


def test_lifespan_disposes_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    disposed: list[bool] = []

    class _FakeEngine:
        def dispose(self) -> None:
            disposed.append(True)

    monkeypatch.setattr(main_module, "engine", _FakeEngine())
    with TestClient(app):
        assert disposed == []
    assert disposed == [True]


# ---------- migrations ----------


def _alembic_config() -> Config:
    # No ini file: avoids alembic's fileConfig() reconfiguring logging for the test session.
    config = Config()
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return config


def test_migrations_upgrade_check_downgrade(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    url = f"sqlite:///{tmp_path / 'migrations.db'}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    config = _alembic_config()

    command.upgrade(config, "head")
    command.check(config)  # raises if the models drifted from the migrations

    engine = create_engine(url)
    try:
        insp = sa_inspect(engine)
        columns = {c["name"]: c for c in insp.get_columns("assignments")}
        assert columns["created_by_id"]["nullable"] is True
        fks = {fk["name"]: fk for fk in insp.get_foreign_keys("comments")}
        assert fks["fk_comments_author_id_users"]["options"].get("ondelete") == "SET NULL"
        indexes = {ix["name"] for ix in insp.get_indexes("refresh_tokens")}
        assert "ix_refresh_tokens_expires_at" in indexes
        assert "ai_usage" in insp.get_table_names()

        command.downgrade(config, "0002")
        assert "ai_usage" not in sa_inspect(engine).get_table_names()

        command.downgrade(config, "0001")
        insp = sa_inspect(engine)
        columns = {c["name"]: c for c in insp.get_columns("assignments")}
        assert columns["created_by_id"]["nullable"] is False
        assert "ix_refresh_tokens_expires_at" not in {
            ix["name"] for ix in insp.get_indexes("refresh_tokens")
        }
        command.upgrade(config, "head")
    finally:
        engine.dispose()


# ---------- input limits / sync routes ----------


def test_description_max_length(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
) -> None:
    headers = auth_headers(make_user())
    too_long = "d" * 10001
    assert (
        client.post(
            "/api/v1/projects", headers=headers, json={"name": "P", "description": too_long}
        ).status_code
        == 422
    )
    project = client.post(
        "/api/v1/projects", headers=headers, json={"name": "P", "description": "d" * 10000}
    )
    assert project.status_code == 201
    project_id = project.json()["id"]
    assert (
        client.put(
            f"/api/v1/projects/{project_id}", headers=headers, json={"description": too_long}
        ).status_code
        == 422
    )
    payload = {"project_id": project_id, "title": "T", "description": too_long}
    assert client.post("/api/v1/assignments", headers=headers, json=payload).status_code == 422
    created = client.post(
        "/api/v1/assignments", headers=headers, json={**payload, "description": "ok"}
    )
    assert created.status_code == 201
    assert (
        client.put(
            f"/api/v1/assignments/{created.json()['id']}",
            headers=headers,
            json={"description": too_long},
        ).status_code
        == 422
    )


def test_auth_db_routes_are_sync() -> None:
    """Blocking DB work must not run on the event loop (only the OAuth callback is async)."""
    from fastapi.routing import APIRoute

    from app.routers import auth

    async_routes = {
        route.name
        for route in auth.router.routes
        if isinstance(route, APIRoute) and asyncio.iscoroutinefunction(route.endpoint)
    }
    assert async_routes == {"google_callback"}
