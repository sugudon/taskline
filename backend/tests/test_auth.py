from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import create_refresh_token, hash_token
from app.config import settings
from app.models import Assignment, Comment, Project, ProjectMember, RefreshToken, User
from app.services import auth_service
from tests.conftest import DEFAULT_PASSWORD

API = "/api/v1/auth"

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]


def _login(client: TestClient, email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
    response = client.post(f"{API}/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


# ---------- register ----------


def test_register_returns_tokens_and_normalizes_email(client: TestClient, db: Session) -> None:
    response = client.post(
        f"{API}/register",
        json={"email": "  New@Example.COM ", "password": "password123", "full_name": "  Ann  "},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]

    me = client.get(f"{API}/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"
    assert me.json()["full_name"] == "Ann"
    assert me.json()["has_password"] is True
    assert me.json()["oauth_provider"] is None

    stored = db.scalar(select(RefreshToken).where(RefreshToken.user_id == me.json()["id"]))
    assert stored is not None
    assert stored.token_hash == hash_token(body["refresh_token"])


def test_register_blank_full_name_becomes_null(client: TestClient) -> None:
    body = client.post(
        f"{API}/register",
        json={"email": "blank@example.com", "password": "password123", "full_name": "   "},
    ).json()
    me = client.get(f"{API}/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["full_name"] is None


def test_register_duplicate_email_case_insensitive(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="dup@example.com")
    response = client.post(
        f"{API}/register", json={"email": "DUP@example.com", "password": "password123"}
    )
    assert response.status_code == 409
    assert response.json()["code"] == "CONFLICT"


def test_register_integrity_error_race_is_conflict(
    client: TestClient, make_user: MakeUser, monkeypatch: pytest.MonkeyPatch
) -> None:
    make_user(email="race@example.com")
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, _email: None)
    response = client.post(
        f"{API}/register", json={"email": "race@example.com", "password": "password123"}
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "x@example.com", "password": "short"},
        {"email": "not-an-email", "password": "password123"},
        {"password": "password123"},
        {"email": "x@example.com", "password": "p" * 129},
    ],
)
def test_register_validation(client: TestClient, payload: dict[str, str]) -> None:
    assert client.post(f"{API}/register", json=payload).status_code == 422


# ---------- login ----------


def test_login_success_case_insensitive(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="login@example.com")
    tokens = _login(client, "LOGIN@example.com")
    assert tokens["token_type"] == "bearer"


@pytest.mark.parametrize(
    ("email", "password"),
    [("login@example.com", "wrong-password"), ("nobody@example.com", DEFAULT_PASSWORD)],
)
def test_login_bad_credentials(
    client: TestClient, make_user: MakeUser, email: str, password: str
) -> None:
    make_user(email="login@example.com")
    response = client.post(f"{API}/login", data={"username": email, "password": password})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_oauth_only_user_rejected(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="g@example.com", password=None, oauth_provider="google")
    response = client.post(f"{API}/login", data={"username": "g@example.com", "password": "x"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_inactive_user(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="off@example.com", is_active=False)
    response = client.post(
        f"{API}/login", data={"username": "off@example.com", "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Account is inactive"


def test_login_requires_form_fields(client: TestClient) -> None:
    assert client.post(f"{API}/login", json={"username": "a", "password": "b"}).status_code == 422


# ---------- refresh / logout ----------


def test_refresh_rotates_token(client: TestClient, make_user: MakeUser, db: Session) -> None:
    make_user(email="r@example.com")
    first = _login(client, "r@example.com")
    response = client.post(f"{API}/refresh", json={"refresh_token": first["refresh_token"]})
    assert response.status_code == 200
    second = response.json()
    assert second["refresh_token"] != first["refresh_token"]

    db.expire_all()
    old = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(first["refresh_token"]))
    )
    new = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(second["refresh_token"]))
    )
    assert old is not None and old.revoked is True
    assert new is not None and new.revoked is False

    # The new access token works.
    me = client.get(f"{API}/me", headers={"Authorization": f"Bearer {second['access_token']}"})
    assert me.status_code == 200


def test_refresh_reuse_detection_revokes_all_sessions(
    client: TestClient, make_user: MakeUser
) -> None:
    make_user(email="reuse@example.com")
    first = _login(client, "reuse@example.com")
    other_session = _login(client, "reuse@example.com")
    second = client.post(f"{API}/refresh", json={"refresh_token": first["refresh_token"]}).json()

    # Replaying the rotated (revoked) token is treated as theft.
    replay = client.post(f"{API}/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401

    # Every outstanding refresh token for the user is now revoked.
    for token in (second["refresh_token"], other_session["refresh_token"]):
        assert client.post(f"{API}/refresh", json={"refresh_token": token}).status_code == 401


def test_refresh_rejects_access_token_and_garbage(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="a@example.com")
    tokens = _login(client, "a@example.com")
    for bad in (tokens["access_token"], "garbage"):
        response = client.post(f"{API}/refresh", json={"refresh_token": bad})
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired refresh token"


def test_refresh_unknown_but_valid_jwt_rejected(client: TestClient, make_user: MakeUser) -> None:
    user = make_user()
    token, _, _ = create_refresh_token(user.id)  # never persisted
    assert client.post(f"{API}/refresh", json={"refresh_token": token}).status_code == 401


def test_refresh_subject_mismatch_rejected(
    client: TestClient, make_user: MakeUser, db: Session
) -> None:
    alice = make_user()
    bob = make_user()
    token, _, expires = create_refresh_token(alice.id)
    db.add(RefreshToken(user_id=bob.id, token_hash=hash_token(token), expires_at=expires))
    db.commit()
    assert client.post(f"{API}/refresh", json={"refresh_token": token}).status_code == 401


def test_refresh_expired_in_db_rejected(
    client: TestClient, make_user: MakeUser, db: Session
) -> None:
    user = make_user()
    token, _, _ = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
    )
    db.commit()
    assert client.post(f"{API}/refresh", json={"refresh_token": token}).status_code == 401


def test_refresh_expired_jwt_rejected(client: TestClient, make_user: MakeUser) -> None:
    user = make_user()
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": str(user.id), "type": "refresh", "jti": "x", "exp": now - timedelta(seconds=1)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    assert client.post(f"{API}/refresh", json={"refresh_token": token}).status_code == 401


def test_refresh_inactive_user_rejected(
    client: TestClient, make_user: MakeUser, db: Session
) -> None:
    user = make_user(email="soon-off@example.com")
    tokens = _login(client, "soon-off@example.com")
    user.is_active = False
    db.commit()
    response = client.post(f"{API}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 401


def test_refresh_empty_token_validation(client: TestClient) -> None:
    assert client.post(f"{API}/refresh", json={"refresh_token": ""}).status_code == 422


def test_logout_revokes_refresh_token(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="out@example.com")
    tokens = _login(client, "out@example.com")
    response = client.post(f"{API}/logout", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 204
    assert response.content == b""
    refreshed = client.post(f"{API}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 401


def test_logout_is_idempotent(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="out2@example.com")
    tokens = _login(client, "out2@example.com")
    for _ in range(2):
        response = client.post(f"{API}/logout", json={"refresh_token": tokens["refresh_token"]})
        assert response.status_code == 204
    assert client.post(f"{API}/logout", json={"refresh_token": "unknown"}).status_code == 204


# ---------- me ----------


def test_me_requires_auth(client: TestClient) -> None:
    response = client.get(f"{API}/me")
    assert response.status_code == 401


def test_me_returns_user(client: TestClient, make_user: MakeUser, auth_headers: Headers) -> None:
    user = make_user(email="me@example.com", full_name="Me")
    response = client.get(f"{API}/me", headers=auth_headers(user))
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user.id
    assert body["email"] == "me@example.com"
    assert body["has_password"] is True
    assert body["is_active"] is True
    assert set(body) == {
        "id",
        "email",
        "full_name",
        "avatar_url",
        "is_active",
        "is_verified",
        "oauth_provider",
        "has_password",
        "created_at",
    }


def test_me_rejects_refresh_token(client: TestClient, make_user: MakeUser) -> None:
    make_user(email="x@example.com")
    tokens = _login(client, "x@example.com")
    response = client.get(
        f"{API}/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert response.status_code == 401


def test_me_bad_subject(client: TestClient) -> None:
    token = jwt.encode(
        {"sub": "abc", "type": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    response = client.get(f"{API}/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid token subject"


def test_me_deleted_or_inactive_user(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, db: Session
) -> None:
    user = make_user()
    headers = auth_headers(user)
    user.is_active = False
    db.commit()
    assert client.get(f"{API}/me", headers=headers).status_code == 401
    db.delete(user)
    db.commit()
    assert client.get(f"{API}/me", headers=headers).status_code == 401


def test_update_me(client: TestClient, make_user: MakeUser, auth_headers: Headers) -> None:
    user = make_user(full_name="Old")
    response = client.put(
        f"{API}/me",
        headers=auth_headers(user),
        json={"full_name": "  New Name ", "avatar_url": "https://img.example/a.png"},
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "New Name"
    assert response.json()["avatar_url"] == "https://img.example/a.png"

    # Partial update: only avatar cleared, name untouched.
    response = client.put(f"{API}/me", headers=auth_headers(user), json={"avatar_url": None})
    assert response.json()["full_name"] == "New Name"
    assert response.json()["avatar_url"] is None


def test_update_me_validation(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.put(f"{API}/me", headers=auth_headers(user), json={"full_name": "x" * 101})
    assert response.status_code == 422


# ---------- password ----------


def test_change_password_success_revokes_sessions(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user(email="pw@example.com")
    tokens = _login(client, "pw@example.com")
    response = client.put(
        f"{API}/password",
        headers=auth_headers(user),
        json={"current_password": DEFAULT_PASSWORD, "new_password": "brand-new-pass"},
    )
    assert response.status_code == 204
    assert (
        client.post(f"{API}/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code
        == 401
    )
    old = client.post(
        f"{API}/login", data={"username": "pw@example.com", "password": DEFAULT_PASSWORD}
    )
    assert old.status_code == 401
    _login(client, "pw@example.com", "brand-new-pass")


def test_change_password_wrong_current(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.put(
        f"{API}/password",
        headers=auth_headers(user),
        json={"current_password": "nope-nope", "new_password": "brand-new-pass"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_change_password_oauth_only_user(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user(password=None, oauth_provider="google")
    response = client.put(
        f"{API}/password",
        headers=auth_headers(user),
        json={"current_password": "x", "new_password": "brand-new-pass"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "BAD_REQUEST"


def test_change_password_too_short(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.put(
        f"{API}/password",
        headers=auth_headers(user),
        json={"current_password": DEFAULT_PASSWORD, "new_password": "short"},
    )
    assert response.status_code == 422


# ---------- delete account ----------


def test_delete_me_cascades(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: Callable[..., Project],
    make_assignment: Callable[..., Assignment],
    db: Session,
) -> None:
    doomed = make_user(email="doomed@example.com")
    other = make_user()
    own_project = make_project(doomed, name="Mine")
    shared = make_project(other, members=[doomed], name="Shared")
    assigned = make_assignment(shared, creator=other, assignee=doomed)
    _login(client, "doomed@example.com")
    headers = auth_headers(doomed)
    doomed_id, own_id, shared_id, assigned_id = doomed.id, own_project.id, shared.id, assigned.id

    response = client.delete(f"{API}/me", headers=headers)
    assert response.status_code == 204

    db.expire_all()
    assert db.get(User, doomed_id) is None
    assert db.get(Project, own_id) is None
    assert db.get(Project, shared_id) is not None
    assert db.scalar(select(ProjectMember).where(ProjectMember.user_id == doomed_id)) is None
    assert db.scalar(select(RefreshToken).where(RefreshToken.user_id == doomed_id)) is None
    remaining = db.get(Assignment, assigned_id)
    assert remaining is not None and remaining.assignee_id is None
    assert client.get(f"{API}/me", headers=headers).status_code == 401


def test_delete_me_preserves_authored_work_in_others_projects(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: Callable[..., Project],
    make_assignment: Callable[..., Assignment],
    make_comment: Callable[..., Comment],
    db: Session,
) -> None:
    leaver = make_user(email="leaver@example.com")
    owner = make_user(email="owner@example.com")
    shared = make_project(owner, members=[leaver], name="Shared")
    solo = make_project(leaver, name="Solo")
    solo_task = make_assignment(solo, creator=leaver)
    authored = make_assignment(shared, creator=leaver, title="Leaver's task")
    comment = make_comment(authored, leaver, body="Leaver's note")
    owner_comment = make_comment(authored, owner, body="Owner reply")
    ids = (leaver.id, solo.id, solo_task.id, authored.id, comment.id, owner_comment.id)

    assert client.delete(f"{API}/me", headers=auth_headers(leaver)).status_code == 204

    leaver_id, solo_id, solo_task_id, authored_id, comment_id, owner_comment_id = ids
    db.expire_all()
    assert db.get(User, leaver_id) is None
    assert db.get(Project, solo_id) is None  # owned solo project is deleted
    assert db.get(Assignment, solo_task_id) is None
    kept = db.get(Assignment, authored_id)
    assert kept is not None and kept.created_by_id is None
    kept_comment = db.get(Comment, comment_id)
    assert kept_comment is not None and kept_comment.author_id is None
    assert db.get(Comment, owner_comment_id) is not None

    owner_h = auth_headers(owner)
    detail = client.get(f"/api/v1/assignments/{authored_id}", headers=owner_h).json()
    assert detail["created_by"] is None
    assert detail["comment_count"] == 2
    comments = client.get(f"/api/v1/assignments/{authored_id}/comments", headers=owner_h).json()
    assert comments[0]["author"] is None
    assert comments[1]["author"]["id"] == owner.id
    dashboard = client.get("/api/v1/dashboard/summary", headers=owner_h).json()
    authors = {c["body"]: c["author"] for c in dashboard["recent_comments"]}
    assert authors["Leaver's note"] is None

    # Ownerless work: nobody matches the creator; project owner keeps control.
    member = make_user(email="member@example.com")
    client.post(
        f"/api/v1/projects/{shared.id}/members", headers=owner_h, json={"email": member.email}
    )
    member_h = auth_headers(member)
    assert (
        client.put(
            f"/api/v1/assignments/{authored_id}", headers=member_h, json={"title": "x"}
        ).status_code
        == 403
    )
    assert client.delete(f"/api/v1/assignments/{authored_id}", headers=member_h).status_code == 403
    assert (
        client.delete(
            f"/api/v1/assignments/{authored_id}/comments/{comment_id}", headers=member_h
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/v1/assignments/{authored_id}", headers=owner_h, json={"title": "Adopted"}
        ).status_code
        == 200
    )


def test_delete_me_blocked_when_owning_shared_project(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: Callable[..., Project],
    db: Session,
) -> None:
    owner = make_user()
    member = make_user()
    project = make_project(owner, members=[member], name="Team")
    response = client.delete(f"{API}/me", headers=auth_headers(owner))
    assert response.status_code == 409
    assert response.json() == {
        "detail": "Transfer or delete your shared projects before deleting your account",
        "code": "CONFLICT",
    }
    db.expire_all()
    assert db.get(User, owner.id) is not None
    assert db.get(Project, project.id) is not None

    # Once the member is removed, deletion goes through.
    client.delete(f"/api/v1/projects/{project.id}/members/{member.id}", headers=auth_headers(owner))
    assert client.delete(f"{API}/me", headers=auth_headers(owner)).status_code == 204


# ---------- input hardening ----------


@pytest.mark.parametrize(
    "avatar_url",
    [
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "ftp://example.com/a.png",
        "//example.com/a.png",
        "not a url",
        "https://example.com/" + "a" * 500,
    ],
)
def test_update_me_rejects_bad_avatar_url(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, avatar_url: str
) -> None:
    response = client.put(
        f"{API}/me", headers=auth_headers(make_user()), json={"avatar_url": avatar_url}
    )
    assert response.status_code == 422


def test_update_me_blank_avatar_becomes_null(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user(avatar_url="https://img.example/a.png")
    response = client.put(f"{API}/me", headers=auth_headers(user), json={"avatar_url": "  "})
    assert response.status_code == 200
    assert response.json()["avatar_url"] is None
    response = client.put(
        f"{API}/me", headers=auth_headers(user), json={"avatar_url": " HTTP://img.example/b.png "}
    )
    assert response.json()["avatar_url"] == "HTTP://img.example/b.png"


@pytest.mark.parametrize("password", [None, DEFAULT_PASSWORD])
def test_login_unknown_or_oauth_user_still_runs_bcrypt(
    client: TestClient,
    make_user: MakeUser,
    monkeypatch: pytest.MonkeyPatch,
    password: str | None,
) -> None:
    calls: list[str] = []
    real = auth_service.burn_password_check

    def spy(plain: str) -> None:
        calls.append(plain)
        real(plain)

    monkeypatch.setattr(auth_service, "burn_password_check", spy)
    make_user(email="g@example.com", password=None)
    email = "g@example.com" if password is None else "nobody@example.com"
    response = client.post(f"{API}/login", data={"username": email, "password": "guess-1234"})
    assert response.status_code == 401
    assert calls == ["guess-1234"]


def test_dummy_hash_is_a_real_bcrypt_hash() -> None:
    from app.auth import security

    assert security._dummy_hash().startswith("$2")
    assert security._dummy_hash() is security._dummy_hash()  # computed once
    security.burn_password_check("anything")  # never raises


# ---------- refresh token cleanup ----------


def test_issue_tokens_purges_stale_rows(
    client: TestClient, make_user: MakeUser, db: Session
) -> None:
    user = make_user(email="purge@example.com")
    other = make_user()
    now = datetime.now(UTC)
    old = now - timedelta(days=2)

    def row(owner: User, *, expires_at: datetime, revoked: bool, created_at: datetime) -> str:
        token_hash = hash_token(f"{owner.id}-{expires_at}-{revoked}-{created_at}")
        db.add(
            RefreshToken(
                user_id=owner.id,
                token_hash=token_hash,
                expires_at=expires_at,
                revoked=revoked,
                created_at=created_at,
            )
        )
        return token_hash

    long_expired = row(user, expires_at=old, revoked=False, created_at=old - timedelta(days=7))
    old_revoked = row(user, expires_at=now + timedelta(days=5), revoked=True, created_at=old)
    fresh_revoked = row(user, expires_at=now + timedelta(days=7), revoked=True, created_at=now)
    just_expired = row(
        user, expires_at=now - timedelta(hours=1), revoked=False, created_at=now - timedelta(days=7)
    )
    active = row(user, expires_at=now + timedelta(days=7), revoked=False, created_at=old)
    others_stale = row(other, expires_at=old, revoked=True, created_at=old)
    db.commit()

    _login(client, "purge@example.com")

    db.expire_all()
    remaining = set(db.scalars(select(RefreshToken.token_hash)).all())
    assert long_expired not in remaining
    assert old_revoked not in remaining
    assert {fresh_revoked, just_expired, active, others_stale} <= remaining
    # Plus the newly issued token.
    assert len(db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)).all()) == 4
