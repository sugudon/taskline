"""Archived projects are read-only except for owner project update/delete."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.models import Assignment, Project, User

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]

ARCHIVED = {"detail": "Project is archived", "code": "CONFLICT"}


@pytest.fixture
def archived(
    make_user: MakeUser,
    make_project: Callable[..., Project],
    make_assignment: Callable[..., Assignment],
) -> dict[str, Any]:
    owner = make_user(email="owner@example.com")
    member = make_user(email="member@example.com")
    make_user(email="newbie@example.com")
    project = make_project(owner, members=[member], name="Old", is_archived=True)
    assignment = make_assignment(project, creator=owner, assignee=member)
    return {"owner": owner, "member": member, "project": project, "assignment": assignment}


def test_archived_project_blocks_writes(
    client: TestClient, archived: dict[str, Any], auth_headers: Headers
) -> None:
    owner_h = auth_headers(archived["owner"])
    project_id = archived["project"].id
    assignment_id = archived["assignment"].id
    base = f"/api/v1/assignments/{assignment_id}"

    attempts = [
        client.post(
            "/api/v1/assignments", headers=owner_h, json={"project_id": project_id, "title": "New"}
        ),
        client.put(base, headers=owner_h, json={"title": "Renamed"}),
        client.patch(f"{base}/status", headers=owner_h, json={"status": "done"}),
        client.patch(f"{base}/assignee", headers=owner_h, json={"assignee_id": None}),
        client.post(f"{base}/comments", headers=owner_h, json={"body": "hi"}),
        client.post(
            f"/api/v1/projects/{project_id}/members",
            headers=owner_h,
            json={"email": "newbie@example.com"},
        ),
    ]
    for response in attempts:
        assert response.status_code == 409, response.text
        assert response.json() == ARCHIVED

    # Reads still work and nothing changed.
    detail = client.get(base, headers=owner_h).json()
    assert detail["title"] == "Assignment" and detail["status"] == "todo"
    assert client.get(f"{base}/comments", headers=owner_h).json() == []


def test_archived_permission_errors_take_precedence(
    client: TestClient, archived: dict[str, Any], auth_headers: Headers
) -> None:
    member_h = auth_headers(archived["member"])
    project_id = archived["project"].id
    response = client.post(
        f"/api/v1/projects/{project_id}/members",
        headers=member_h,
        json={"email": "newbie@example.com"},
    )
    assert response.status_code == 403


def test_owner_can_unarchive_then_write(
    client: TestClient, archived: dict[str, Any], auth_headers: Headers
) -> None:
    owner_h = auth_headers(archived["owner"])
    project_id = archived["project"].id
    response = client.put(
        f"/api/v1/projects/{project_id}", headers=owner_h, json={"is_archived": False}
    )
    assert response.status_code == 200
    assert response.json()["is_archived"] is False
    created = client.post(
        "/api/v1/assignments", headers=owner_h, json={"project_id": project_id, "title": "New"}
    )
    assert created.status_code == 201


def test_owner_can_delete_archived_project(
    client: TestClient, archived: dict[str, Any], auth_headers: Headers
) -> None:
    owner_h = auth_headers(archived["owner"])
    project_id = archived["project"].id
    assert client.delete(f"/api/v1/projects/{project_id}", headers=owner_h).status_code == 204
