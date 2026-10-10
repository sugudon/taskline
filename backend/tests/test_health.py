from collections.abc import Generator, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import app


def test_health_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


class _BrokenSession:
    def execute(self, *_args: object, **_kwargs: object) -> None:
        raise OperationalError("SELECT 1", {}, Exception("db down"))

    def close(self) -> None:
        return None


@pytest.fixture
def broken_client(client: TestClient) -> Iterator[TestClient]:
    def _broken() -> Generator[_BrokenSession, None, None]:
        yield _BrokenSession()

    app.dependency_overrides[get_db] = _broken
    yield client


def test_health_db_unreachable(broken_client: TestClient) -> None:
    response = broken_client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unhealthy", "database": "unreachable"}


def test_unknown_route_404(client: TestClient) -> None:
    assert client.get("/api/v1/nope").status_code == 404


def test_validation_error_shape(client: TestClient) -> None:
    response = client.post("/api/v1/auth/register", json={"email": "bad"})
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list) and detail
    assert {"loc", "msg", "type"} <= set(detail[0])


def test_app_exception_shape_and_auth_header(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or expired token", "code": "UNAUTHORIZED"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_get_db_dependency_yields_and_closes() -> None:
    from app import database

    gen = database.get_db()
    session = next(gen)
    assert session is not None
    with pytest.raises(StopIteration):
        next(gen)
