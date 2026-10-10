from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Assignment, AssignmentStatus, Project, User
from app.services import access

API = "/api/v1/projects"

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]
MakeProject = Callable[..., Project]
MakeAssignment = Callable[..., Assignment]


# ---------- create / read ----------


def test_create_project_defaults(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.post(API, headers=auth_headers(user), json={"name": "  Thesis  "})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Thesis"
    assert body["color"] == "#805AD5"
    assert body["description"] is None
    assert body["is_archived"] is False
    assert body["owner_id"] == user.id
    assert body["member_count"] == 1
    assert body["assignment_count"] == 0
    assert body["open_assignment_count"] == 0
    assert len(body["members"]) == 1
    assert body["members"][0]["role"] == "owner"
    assert body["members"][0]["user"]["id"] == user.id


@pytest.mark.parametrize(
    "payload",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 101},
        {"name": "ok", "color": "red"},
        {"name": "ok", "color": "#12345"},
        {"name": "ok", "color": "#GGGGGG"},
        {},
    ],
)
def test_create_project_validation(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, payload: dict[str, str]
) -> None:
    user = make_user()
    assert client.post(API, headers=auth_headers(user), json=payload).status_code == 422


def test_create_project_custom_color_and_description(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    body = client.post(
        API,
        headers=auth_headers(user),
        json={"name": "P", "description": "desc", "color": "#aBcDeF"},
    ).json()
    assert body["color"] == "#aBcDeF"
    assert body["description"] == "desc"


def test_projects_require_auth(client: TestClient) -> None:
    assert client.get(API).status_code == 401
    assert client.post(API, json={"name": "x"}).status_code == 401


def test_list_projects_only_member_projects_with_counts(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
) -> None:
    owner = make_user()
    member = make_user()
    stranger = make_user()
    p1 = make_project(owner, members=[member], name="First")
    p2 = make_project(owner, name="Second")
    make_project(stranger, name="Hidden")
    make_assignment(p1)
    make_assignment(p1, status=AssignmentStatus.DONE)
    make_assignment(p1, status=AssignmentStatus.IN_REVIEW)

    owner_list = client.get(API, headers=auth_headers(owner)).json()
    assert [p["id"] for p in owner_list] == [p2.id, p1.id]  # newest first
    first = next(p for p in owner_list if p["id"] == p1.id)
    assert first["member_count"] == 2
    assert first["assignment_count"] == 3
    assert first["open_assignment_count"] == 2
    second = next(p for p in owner_list if p["id"] == p2.id)
    assert (second["member_count"], second["assignment_count"]) == (1, 0)
    assert "members" not in first

    member_list = client.get(API, headers=auth_headers(member)).json()
    assert [p["id"] for p in member_list] == [p1.id]


def test_list_projects_archived_filter(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    active = make_project(owner, name="Active")
    archived = make_project(owner, name="Old", is_archived=True)
    default = client.get(API, headers=auth_headers(owner)).json()
    assert [p["id"] for p in default] == [active.id]
    everything = client.get(
        API, headers=auth_headers(owner), params={"include_archived": "true"}
    ).json()
    assert {p["id"] for p in everything} == {active.id, archived.id}


def test_get_project_detail(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
) -> None:
    owner = make_user()
    member = make_user()
    project = make_project(owner, members=[member])
    make_assignment(project, assignee=member)
    make_assignment(project)  # not the member's: hidden from their counts
    response = client.get(f"{API}/{project.id}", headers=auth_headers(member))
    assert response.status_code == 200
    body = response.json()
    assert body["assignment_count"] == 1
    assert body["open_assignment_count"] == 1
    owner_body = client.get(f"{API}/{project.id}", headers=auth_headers(owner)).json()
    assert owner_body["assignment_count"] == 2
    roles = [m["role"] for m in body["members"]]
    assert roles == ["owner", "member"]  # owner listed first
    assert body["members"][1]["user"]["email"] == member.email


def test_get_missing_project_404(
    client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = client.get(f"{API}/9999", headers=auth_headers(user))
    assert response.status_code == 404
    assert response.json() == {"detail": "Project not found", "code": "NOT_FOUND"}


# ---------- update / delete ----------


def test_update_project_owner(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    project = make_project(owner, name="Before", description="old")
    response = client.put(
        f"{API}/{project.id}",
        headers=auth_headers(owner),
        json={"name": "After", "color": "#000000", "is_archived": True},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["name"], body["color"], body["is_archived"]) == ("After", "#000000", True)
    assert body["description"] == "old"
    assert body["updated_at"] is not None


def test_update_project_null_handling(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    project = make_project(owner, name="Keep", description="clear me")
    body = client.put(
        f"{API}/{project.id}",
        headers=auth_headers(owner),
        json={"name": None, "color": None, "is_archived": None, "description": None},
    ).json()
    assert body["name"] == "Keep"
    assert body["color"] == "#805AD5"
    assert body["is_archived"] is False
    assert body["description"] is None


@pytest.mark.parametrize("payload", [{"name": ""}, {"color": "blue"}, {"name": "y" * 101}])
def test_update_project_validation(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    payload: dict[str, str],
) -> None:
    owner = make_user()
    project = make_project(owner)
    response = client.put(f"{API}/{project.id}", headers=auth_headers(owner), json=payload)
    assert response.status_code == 422


def test_delete_project_cascades(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
    db: Session,
) -> None:
    owner = make_user()
    project = make_project(owner, members=[make_user()])
    assignment = make_assignment(project)
    project_id, assignment_id = project.id, assignment.id
    response = client.delete(f"{API}/{project_id}", headers=auth_headers(owner))
    assert response.status_code == 204
    db.expire_all()
    assert db.get(Project, project_id) is None
    assert db.get(Assignment, assignment_id) is None
    assert client.get(f"{API}/{project_id}", headers=auth_headers(owner)).status_code == 404


# ---------- permission matrix ----------


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("GET", "", None),
        ("PUT", "", {"name": "x"}),
        ("DELETE", "", None),
        ("GET", "/members", None),
        ("POST", "/members", {"email": "someone@example.com"}),
        ("DELETE", "/members/{owner_id}", None),
    ],
)
def test_non_member_gets_404(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    method: str,
    path: str,
    json: dict[str, str] | None,
) -> None:
    owner = make_user()
    make_user(email="someone@example.com")
    stranger = make_user()
    project = make_project(owner)
    url = f"{API}/{project.id}{path.format(owner_id=owner.id)}"
    response = client.request(method, url, headers=auth_headers(stranger), json=json)
    assert response.status_code == 404


@pytest.mark.parametrize(
    ("method", "path", "json"),
    [
        ("PUT", "", {"name": "x"}),
        ("DELETE", "", None),
        ("POST", "/members", {"email": "someone@example.com"}),
        ("DELETE", "/members/{other_id}", None),
    ],
)
def test_member_without_permission_gets_403(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    method: str,
    path: str,
    json: dict[str, str] | None,
) -> None:
    owner = make_user()
    member = make_user()
    other = make_user(email="someone@example.com")
    project = make_project(owner, members=[member, other])
    url = f"{API}/{project.id}{path.format(other_id=other.id)}"
    response = client.request(method, url, headers=auth_headers(member), json=json)
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_member_can_read(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    member = make_user()
    project = make_project(owner, members=[member])
    assert client.get(f"{API}/{project.id}", headers=auth_headers(member)).status_code == 200
    members = client.get(f"{API}/{project.id}/members", headers=auth_headers(member))
    assert members.status_code == 200
    assert [m["user"]["id"] for m in members.json()] == [owner.id, member.id]


# ---------- members ----------


def test_add_member_by_email(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    newbie = make_user(email="newbie@example.com", full_name="Newbie")
    project = make_project(owner)
    response = client.post(
        f"{API}/{project.id}/members",
        headers=auth_headers(owner),
        json={"email": "NEWBIE@example.com"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "member"
    assert body["user"] == {
        "id": newbie.id,
        "email": "newbie@example.com",
        "full_name": "Newbie",
        "avatar_url": None,
    }
    assert body["joined_at"]
    detail = client.get(f"{API}/{project.id}", headers=auth_headers(newbie)).json()
    assert detail["member_count"] == 2


def test_add_member_unknown_user_404(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    project = make_project(owner)
    response = client.post(
        f"{API}/{project.id}/members",
        headers=auth_headers(owner),
        json={"email": "ghost@example.com"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "User not found"


def test_add_member_already_member_409(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user(email="owner@example.com")
    member = make_user(email="member@example.com")
    project = make_project(owner, members=[member])
    for email in ("member@example.com", "owner@example.com"):
        response = client.post(
            f"{API}/{project.id}/members", headers=auth_headers(owner), json={"email": email}
        )
        assert response.status_code == 409


def test_add_member_invalid_email_422(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    project = make_project(owner)
    response = client.post(
        f"{API}/{project.id}/members", headers=auth_headers(owner), json={"email": "nope"}
    )
    assert response.status_code == 422


def test_remove_owner_400(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    project = make_project(owner)
    response = client.delete(f"{API}/{project.id}/members/{owner.id}", headers=auth_headers(owner))
    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot remove the project owner"


def test_remove_non_member_404(
    client: TestClient, make_user: MakeUser, auth_headers: Headers, make_project: MakeProject
) -> None:
    owner = make_user()
    outsider = make_user()
    project = make_project(owner)
    response = client.delete(
        f"{API}/{project.id}/members/{outsider.id}", headers=auth_headers(owner)
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Member not found"


def test_remove_member_unassigns_open_work_in_project_only(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
    db: Session,
) -> None:
    owner = make_user()
    member = make_user()
    project = make_project(owner, members=[member])
    other_project = make_project(owner, members=[member], name="Other")
    open_one = make_assignment(project, assignee=member)
    done_one = make_assignment(project, assignee=member, status=AssignmentStatus.DONE)
    elsewhere = make_assignment(other_project, assignee=member)

    response = client.delete(f"{API}/{project.id}/members/{member.id}", headers=auth_headers(owner))
    assert response.status_code == 204

    db.expire_all()
    assert db.get(Assignment, open_one.id).assignee_id is None  # type: ignore[union-attr]
    assert db.get(Assignment, done_one.id).assignee_id == member.id  # type: ignore[union-attr]
    assert db.get(Assignment, elsewhere.id).assignee_id == member.id  # type: ignore[union-attr]

    # Removed member loses access (404, not 403).
    assert client.get(f"{API}/{project.id}", headers=auth_headers(member)).status_code == 404
    assert client.get(f"{API}/{other_project.id}", headers=auth_headers(member)).status_code == 200


# ---------- access helpers ----------


def test_member_project_ids_signatures(make_user: MakeUser, db: Session) -> None:
    user = make_user()
    assert str(access.member_project_ids(user)) == str(access.member_project_ids(db, user))
    with pytest.raises(TypeError):
        access.member_project_ids(db)
