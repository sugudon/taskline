"""Shared pytest fixtures.

Environment defaults are set BEFORE the app is imported so `app.config.settings` picks them up.
`TEST_DATABASE_URL` (e.g. Postgres in CI) is used when set, otherwise in-memory SQLite.
"""

import os
import secrets
import warnings
from collections.abc import Callable, Generator, Iterator
from datetime import date
from typing import Any

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or "sqlite://"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
# Fresh random signing key per test run; no key material lives in the repo.
os.environ["SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["GOOGLE_CLIENT_SECRET"] = ""
os.environ["FRONTEND_URL"] = "http://frontend.test"
os.environ.setdefault("LOG_LEVEL", "WARNING")
# Rate limiting is exercised by a dedicated test that turns it back on.
os.environ["RATE_LIMIT_ENABLED"] = "false"

# starlette's TestClient warns that httpx is deprecated in favour of httpx2; not actionable here.
warnings.filterwarnings("ignore", message="Using `httpx` with `starlette.testclient`")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Engine, create_engine, event  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.auth.security import create_access_token, hash_password  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Assignment,
    AssignmentPriority,
    AssignmentStatus,
    Comment,
    Project,
    ProjectMember,
    ProjectRole,
    User,
)

DEFAULT_PASSWORD = "password123"
# Hashing is slow; hash the default password once and reuse it.
_DEFAULT_HASH = hash_password(DEFAULT_PASSWORD)


def _make_engine() -> Engine:
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def _enable_fks(dbapi_connection: Any, _record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    return create_engine(TEST_DATABASE_URL)


engine = _make_engine()
TestingSession = sessionmaker(
    bind=engine, autocommit=False, autoflush=False, expire_on_commit=False
)


@pytest.fixture
def db() -> Iterator[Session]:
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    def _override_get_db() -> Generator[Session, None, None]:
        session = TestingSession()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(db: Session) -> Callable[..., User]:
    counter = {"n": 0}

    def _make(
        email: str | None = None,
        password: str | None = DEFAULT_PASSWORD,
        full_name: str | None = "Test User",
        **kwargs: Any,
    ) -> User:
        counter["n"] += 1
        if email is None:
            email = f"user{counter['n']}@example.com"
        if password is None:
            hashed = None
        elif password == DEFAULT_PASSWORD:
            hashed = _DEFAULT_HASH
        else:
            hashed = hash_password(password)
        user = User(email=email, hashed_password=hashed, full_name=full_name, **kwargs)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture
def auth_headers() -> Callable[[User], dict[str, str]]:
    def _headers(user: User) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(user.id)}"}

    return _headers


@pytest.fixture
def make_project(db: Session) -> Callable[..., Project]:
    def _make(
        owner: User,
        members: list[User] | None = None,
        name: str = "Project",
        **kwargs: Any,
    ) -> Project:
        project = Project(owner_id=owner.id, name=name, **kwargs)
        db.add(project)
        db.flush()
        db.add(ProjectMember(project_id=project.id, user_id=owner.id, role=ProjectRole.OWNER))
        for member in members or []:
            db.add(ProjectMember(project_id=project.id, user_id=member.id, role=ProjectRole.MEMBER))
        db.commit()
        db.refresh(project)
        return project

    return _make


@pytest.fixture
def make_assignment(db: Session) -> Callable[..., Assignment]:
    def _make(
        project: Project,
        creator: User | None = None,
        title: str = "Assignment",
        status: AssignmentStatus = AssignmentStatus.TODO,
        priority: AssignmentPriority = AssignmentPriority.MEDIUM,
        due_date: date | None = None,
        assignee: User | None = None,
        **kwargs: Any,
    ) -> Assignment:
        assignment = Assignment(
            project_id=project.id,
            created_by_id=(creator.id if creator else project.owner_id),
            title=title,
            status=status,
            priority=priority,
            due_date=due_date,
            assignee_id=assignee.id if assignee else None,
            **kwargs,
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return assignment

    return _make


@pytest.fixture
def make_comment(db: Session) -> Callable[..., Comment]:
    def _make(assignment: Assignment, author: User, body: str = "A comment") -> Comment:
        comment = Comment(assignment_id=assignment.id, author_id=author.id, body=body)
        db.add(comment)
        db.commit()
        db.refresh(comment)
        return comment

    return _make
