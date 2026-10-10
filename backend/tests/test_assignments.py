from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    AssignmentPriority,
    AssignmentStatus,
    Comment,
    Project,
    User,
)

API = "/api/v1/assignments"

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]
MakeProject = Callable[..., Project]
MakeAssignment = Callable[..., Assignment]
MakeComment = Callable[..., Comment]

TODAY = datetime.now(UTC).date()


@pytest.fixture
def team(make_user: MakeUser, make_project: MakeProject) -> dict[str, Any]:
    """owner + creator + assignee + bystander members, and an outsider with their own project."""
    owner = make_user(email="owner@example.com")
    creator = make_user(email="creator@example.com")
    assignee = make_user(email="assignee@example.com")
    bystander = make_user(email="bystander@example.com")
    outsider = make_user(email="outsider@example.com")
    project = make_project(owner, members=[creator, assignee, bystander], name="Team")
    outsider_project = make_project(outsider, name="Elsewhere")
    return {
        "owner": owner,
        "creator": creator,
        "assignee": assignee,
        "bystander": bystander,
        "outsider": outsider,
        "project": project,
        "outsider_project": outsider_project,
    }


def _ids(response: Any) -> list[int]:
    return [item["id"] for item in response.json()["items"]]


# ---------- create ----------


def test_create_assignment_defaults(
    client: TestClient, team: dict[str, Any], auth_headers: Headers
) -> None:
    creator, project = team["creator"], team["project"]
    response = client.post(
        API, headers=auth_headers(creator), json={"project_id": project.id, "title": "  Essay  "}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Essay"
    assert body["status"] == "todo"
    assert body["priority"] == "medium"
    assert body["due_date"] is None
    assert body["completed_at"] is None
    assert body["assignee"] is None
    assert body["project_name"] == "Team"
    assert body["created_by"]["id"] == creator.id
    assert body["is_overdue"] is False
    assert body["comment_count"] == 0


def test_create_assignment_full(
    client: TestClient, team: dict[str, Any], auth_headers: Headers
) -> None:
    due = (TODAY - timedelta(days=1)).isoformat()
    response = client.post(
        API,
        headers=auth_headers(team["owner"]),
        json={
            "project_id": team["project"].id,
            "title": "Lab report",
            "description": "Write it",
            "priority": "urgent",
            "status": "in_progress",
            "due_date": due,
            "assignee_id": team["assignee"].id,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["due_date"] == due
    assert body["priority"] == "urgent"
    assert body["status"] == "in_progress"
    assert body["assignee"]["id"] == team["assignee"].id
    assert body["is_overdue"] is True


def test_create_done_sets_completed_at(
    client: TestClient, team: dict[str, Any], auth_headers: Headers
) -> None:
    body = client.post(
        API,
        headers=auth_headers(team["owner"]),
        json={
            "project_id": team["project"].id,
            "title": "Already done",
            "status": "done",
            "due_date": (TODAY - timedelta(days=3)).isoformat(),
        },
    ).json()
    assert body["completed_at"] is not None
    assert body["is_overdue"] is False


def test_create_assignee_must_be_member(
    client: TestClient, team: dict[str, Any], auth_headers: Headers
) -> None:
    response = client.post(
        API,
        headers=auth_headers(team["owner"]),
        json={
            "project_id": team["project"].id,
            "title": "x",
            "assignee_id": team["outsider"].id,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Assignee must be a member of the project"


@pytest.mark.parametrize("project_key", ["outsider_project", None])
def test_create_in_inaccessible_project_404(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, project_key: str | None
) -> None:
    project_id = team[project_key].id if project_key else 99999
    response = client.post(
        API, headers=auth_headers(team["owner"]), json={"project_id": project_id, "title": "x"}
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "t" * 201},
        {"title": "ok", "priority": "critical"},
        {"title": "ok", "status": "blocked"},
        {"title": "ok", "due_date": "not-a-date"},
    ],
)
def test_create_validation(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, payload: dict[str, str]
) -> None:
    body = {"project_id": team["project"].id, **payload}
    assert client.post(API, headers=auth_headers(team["owner"]), json=body).status_code == 422


def test_requires_auth(client: TestClient) -> None:
    assert client.get(API).status_code == 401
    assert client.get(f"{API}/1").status_code == 401


# ---------- read ----------


def test_get_assignment_with_comment_count(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    make_comment: MakeComment,
) -> None:
    assignment = make_assignment(team["project"], creator=team["creator"])
    make_comment(assignment, team["owner"])
    make_comment(assignment, team["bystander"])
    response = client.get(f"{API}/{assignment.id}", headers=auth_headers(team["bystander"]))
    assert response.status_code == 200
    assert response.json()["comment_count"] == 2


def test_get_assignment_non_member_and_missing_404(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    outsider = auth_headers(team["outsider"])
    assert client.get(f"{API}/{assignment.id}", headers=outsider).status_code == 404
    missing = client.get(f"{API}/99999", headers=auth_headers(team["owner"]))
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Assignment not found"


# ---------- list: scoping, filters ----------


def test_list_scoped_to_member_projects(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    mine = make_assignment(team["project"])
    make_assignment(team["outsider_project"])
    body = client.get(API, headers=auth_headers(team["bystander"])).json()
    assert [i["id"] for i in body["items"]] == [mine.id]
    assert body["total"] == 1


@pytest.fixture
def catalog(
    team: dict[str, Any], make_assignment: MakeAssignment, make_project: MakeProject
) -> dict[str, Any]:
    project = team["project"]
    second = make_project(team["owner"], members=[team["assignee"]], name="Second")
    a = make_assignment(
        project,
        title="Read chapter 50% done",
        status=AssignmentStatus.TODO,
        priority=AssignmentPriority.LOW,
        due_date=TODAY + timedelta(days=5),
        assignee=team["assignee"],
    )
    b = make_assignment(
        project,
        title="Write essay",
        status=AssignmentStatus.IN_PROGRESS,
        priority=AssignmentPriority.URGENT,
        due_date=TODAY - timedelta(days=2),
    )
    c = make_assignment(
        project,
        title="Review 500 notes",
        status=AssignmentStatus.DONE,
        priority=AssignmentPriority.HIGH,
        due_date=TODAY - timedelta(days=10),
        assignee=team["assignee"],
    )
    d = make_assignment(
        second,
        title="Essay outline",
        status=AssignmentStatus.IN_REVIEW,
        priority=AssignmentPriority.MEDIUM,
        due_date=None,
        assignee=team["owner"],
    )
    return {"a": a, "b": b, "c": c, "d": d, "second": second, **team}


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"status": "todo"}, {"a"}),
        ({"status": "done"}, {"c"}),
        ({"priority": "urgent"}, {"b"}),
        ({"priority": "medium"}, {"d"}),
        ({"overdue": "true"}, {"b"}),
        ({"overdue": "false"}, {"a", "b", "c", "d"}),
        ({"q": "essay"}, {"b", "d"}),
        ({"q": "ESSAY"}, {"b", "d"}),
        ({"q": "50%"}, {"a"}),
        ({"q": "   "}, {"a", "b", "c", "d"}),
        ({"q": "nothing-matches"}, set()),
        ({"status": "in_progress", "priority": "urgent", "overdue": "true"}, {"b"}),
    ],
)
def test_list_filters(
    client: TestClient,
    catalog: dict[str, Any],
    auth_headers: Headers,
    params: dict[str, str],
    expected: set[str],
) -> None:
    response = client.get(API, headers=auth_headers(catalog["owner"]), params=params)
    assert response.status_code == 200
    assert set(_ids(response)) == {catalog[k].id for k in expected}
    assert response.json()["total"] == len(expected)


def test_list_filter_project_and_assignee(
    client: TestClient, catalog: dict[str, Any], auth_headers: Headers
) -> None:
    headers = auth_headers(catalog["owner"])
    by_project = client.get(API, headers=headers, params={"project_id": catalog["second"].id})
    assert _ids(by_project) == [catalog["d"].id]
    by_assignee = client.get(API, headers=headers, params={"assignee_id": catalog["assignee"].id})
    assert set(_ids(by_assignee)) == {catalog["a"].id, catalog["c"].id}
    # Filtering by a project the user is not in yields nothing (no leak).
    hidden = client.get(API, headers=headers, params={"project_id": catalog["outsider_project"].id})
    assert hidden.json()["total"] == 0


def test_list_filter_mine(
    client: TestClient, catalog: dict[str, Any], auth_headers: Headers
) -> None:
    owner_mine = client.get(API, headers=auth_headers(catalog["owner"]), params={"mine": "true"})
    assert _ids(owner_mine) == [catalog["d"].id]
    assignee_mine = client.get(
        API, headers=auth_headers(catalog["assignee"]), params={"mine": "true", "status": "todo"}
    )
    assert _ids(assignee_mine) == [catalog["a"].id]


def test_list_bystander_sees_only_team_project(
    client: TestClient, catalog: dict[str, Any], auth_headers: Headers
) -> None:
    body = client.get(API, headers=auth_headers(catalog["bystander"])).json()
    assert set(i["id"] for i in body["items"]) == {catalog[k].id for k in ("a", "b", "c")}


# ---------- list: sorting ----------


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("due_date", ["c", "b", "a", "d"]),  # nulls last
        ("-due_date", ["a", "b", "c", "d"]),  # nulls last
        ("priority", ["b", "c", "d", "a"]),  # urgent first
        ("-priority", ["a", "d", "c", "b"]),
    ],
)
def test_list_sorting(
    client: TestClient,
    catalog: dict[str, Any],
    auth_headers: Headers,
    sort: str,
    expected: list[str],
) -> None:
    response = client.get(API, headers=auth_headers(catalog["owner"]), params={"sort": sort})
    assert _ids(response) == [catalog[k].id for k in expected]


def test_list_sort_created_at(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    base = datetime(2025, 1, 1, tzinfo=UTC)
    middle = make_assignment(team["project"], title="m", created_at=base + timedelta(hours=1))
    oldest = make_assignment(team["project"], title="o", created_at=base)
    newest = make_assignment(team["project"], title="n", created_at=base + timedelta(hours=2))
    headers = auth_headers(team["owner"])
    asc = client.get(API, headers=headers, params={"sort": "created_at"})
    assert _ids(asc) == [oldest.id, middle.id, newest.id]
    desc = client.get(API, headers=headers, params={"sort": "-created_at"})
    assert _ids(desc) == [newest.id, middle.id, oldest.id]
    default = client.get(API, headers=headers)
    assert _ids(default) == _ids(desc)


def test_list_tie_breaker_by_id(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    same = datetime(2025, 1, 1, tzinfo=UTC)
    first = make_assignment(team["project"], created_at=same)
    second = make_assignment(team["project"], created_at=same)
    headers = auth_headers(team["owner"])
    assert _ids(client.get(API, headers=headers, params={"sort": "created_at"})) == [
        first.id,
        second.id,
    ]
    assert _ids(client.get(API, headers=headers, params={"sort": "-created_at"})) == [
        second.id,
        first.id,
    ]


# ---------- list: pagination ----------


def test_pagination(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    created = [make_assignment(team["project"], title=f"A{i}") for i in range(5)]
    headers = auth_headers(team["owner"])
    expected_order = [a.id for a in reversed(created)]

    page1 = client.get(API, headers=headers, params={"size": 2, "page": 1}).json()
    assert (page1["total"], page1["page"], page1["size"], page1["pages"]) == (5, 1, 2, 3)
    page3 = client.get(API, headers=headers, params={"size": 2, "page": 3}).json()
    assert len(page3["items"]) == 1
    collected: list[int] = []
    for page in (1, 2, 3):
        items = client.get(API, headers=headers, params={"size": 2, "page": page}).json()["items"]
        collected += [i["id"] for i in items]
    assert collected == expected_order

    beyond = client.get(API, headers=headers, params={"size": 2, "page": 10}).json()
    assert beyond["items"] == [] and beyond["total"] == 5 and beyond["page"] == 10

    exact = client.get(API, headers=headers, params={"size": 5}).json()
    assert exact["pages"] == 1
    big = client.get(API, headers=headers, params={"size": 100}).json()
    assert big["pages"] == 1 and len(big["items"]) == 5


def test_pagination_empty(client: TestClient, team: dict[str, Any], auth_headers: Headers) -> None:
    body = client.get(API, headers=auth_headers(team["owner"])).json()
    assert body == {"items": [], "total": 0, "page": 1, "size": 20, "pages": 0}


@pytest.mark.parametrize(
    "params",
    [
        {"page": 0},
        {"size": 0},
        {"size": 101},
        {"sort": "title"},
        {"status": "blocked"},
        {"priority": "zero"},
        {"q": "x" * 201},
        {"mine": "maybe"},
    ],
)
def test_list_query_validation(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, params: dict[str, Any]
) -> None:
    response = client.get(API, headers=auth_headers(team["owner"]), params=params)
    assert response.status_code == 422


# ---------- update ----------


@pytest.mark.parametrize("actor", ["creator", "assignee", "owner"])
def test_update_allowed_roles(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    actor: str,
) -> None:
    assignment = make_assignment(
        team["project"], creator=team["creator"], assignee=team["assignee"]
    )
    response = client.put(
        f"{API}/{assignment.id}",
        headers=auth_headers(team[actor]),
        json={"title": "Renamed", "priority": "high", "due_date": "2030-01-02"},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["title"], body["priority"], body["due_date"]) == (
        "Renamed",
        "high",
        "2030-01-02",
    )
    assert body["updated_at"] is not None


def test_update_forbidden_for_other_member(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"], creator=team["creator"])
    response = client.put(
        f"{API}/{assignment.id}", headers=auth_headers(team["bystander"]), json={"title": "x"}
    )
    assert response.status_code == 403


def test_update_non_member_404(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    response = client.put(
        f"{API}/{assignment.id}", headers=auth_headers(team["outsider"]), json={"title": "x"}
    )
    assert response.status_code == 404


def test_update_partial_and_null_semantics(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(
        team["project"],
        title="Keep",
        description="old",
        priority=AssignmentPriority.HIGH,
        due_date=date(2030, 1, 1),
    )
    body = client.put(
        f"{API}/{assignment.id}",
        headers=auth_headers(team["owner"]),
        json={"title": None, "priority": None, "description": None, "due_date": None},
    ).json()
    assert body["title"] == "Keep"
    assert body["priority"] == "high"
    assert body["description"] is None
    assert body["due_date"] is None


def test_update_ignores_status_and_assignee(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    body = client.put(
        f"{API}/{assignment.id}",
        headers=auth_headers(team["owner"]),
        json={"status": "done", "assignee_id": team["assignee"].id, "title": "t"},
    ).json()
    assert body["status"] == "todo"
    assert body["assignee"] is None


@pytest.mark.parametrize("payload", [{"title": ""}, {"title": "  "}, {"priority": "nope"}])
def test_update_validation(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    payload: dict[str, str],
) -> None:
    assignment = make_assignment(team["project"])
    response = client.put(
        f"{API}/{assignment.id}", headers=auth_headers(team["owner"]), json=payload
    )
    assert response.status_code == 422


# ---------- delete ----------


@pytest.mark.parametrize(("actor", "expected"), [("creator", 204), ("owner", 204)])
def test_delete_allowed(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    make_comment: MakeComment,
    db: Session,
    actor: str,
    expected: int,
) -> None:
    assignment = make_assignment(team["project"], creator=team["creator"])
    comment = make_comment(assignment, team["owner"])
    assignment_id, comment_id = assignment.id, comment.id
    response = client.delete(f"{API}/{assignment_id}", headers=auth_headers(team[actor]))
    assert response.status_code == expected
    db.expire_all()
    assert db.get(Assignment, assignment_id) is None
    assert db.get(Comment, comment_id) is None


@pytest.mark.parametrize(
    ("actor", "expected"), [("assignee", 403), ("bystander", 403), ("outsider", 404)]
)
def test_delete_denied(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    actor: str,
    expected: int,
) -> None:
    assignment = make_assignment(
        team["project"], creator=team["creator"], assignee=team["assignee"]
    )
    response = client.delete(f"{API}/{assignment.id}", headers=auth_headers(team[actor]))
    assert response.status_code == expected


# ---------- status ----------


def test_status_transitions_manage_completed_at(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"], due_date=TODAY - timedelta(days=1))
    headers = auth_headers(team["bystander"])  # any member may change status
    url = f"{API}/{assignment.id}/status"

    done = client.patch(url, headers=headers, json={"status": "done"}).json()
    assert done["status"] == "done"
    assert done["completed_at"] is not None
    assert done["is_overdue"] is False

    again = client.patch(url, headers=headers, json={"status": "done"}).json()
    assert again["completed_at"] == done["completed_at"]  # no-op keeps timestamp

    reopened = client.patch(url, headers=headers, json={"status": "in_review"}).json()
    assert reopened["status"] == "in_review"
    assert reopened["completed_at"] is None
    assert reopened["is_overdue"] is True

    moved = client.patch(url, headers=headers, json={"status": "in_progress"}).json()
    assert moved["completed_at"] is None


def test_status_validation_and_access(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    url = f"{API}/{assignment.id}/status"
    bad = client.patch(url, headers=auth_headers(team["owner"]), json={"status": "blocked"})
    assert bad.status_code == 422
    hidden = client.patch(url, headers=auth_headers(team["outsider"]), json={"status": "done"})
    assert hidden.status_code == 404


# ---------- assignee ----------


def test_assignee_set_and_clear(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    url = f"{API}/{assignment.id}/assignee"
    headers = auth_headers(team["owner"])
    body = client.patch(url, headers=headers, json={"assignee_id": team["assignee"].id}).json()
    assert body["assignee"]["id"] == team["assignee"].id
    cleared = client.patch(url, headers=headers, json={"assignee_id": None}).json()
    assert cleared["assignee"] is None


def test_reassign_allowed_for_scrum_master_and_creator_only(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(
        team["project"], creator=team["creator"], assignee=team["assignee"]
    )
    url = f"{API}/{assignment.id}/assignee"

    # The creator ("task owner") can hand the task to anyone in the project...
    by_creator = client.patch(
        url, headers=auth_headers(team["creator"]), json={"assignee_id": team["bystander"].id}
    )
    assert by_creator.status_code == 200
    assert by_creator.json()["assignee"]["id"] == team["bystander"].id

    # ...and so can the project owner (Scrum master), including to themselves.
    by_owner = client.patch(
        url, headers=auth_headers(team["owner"]), json={"assignee_id": team["owner"].id}
    )
    assert by_owner.status_code == 200

    # Other members, including the current assignee, cannot reassign.
    for who in ("bystander", "assignee"):
        denied = client.patch(
            url, headers=auth_headers(team[who]), json={"assignee_id": team[who].id}
        )
        assert denied.status_code == 403
        assert "Scrum master" in denied.json()["detail"]

    # Non-members still get 404, not 403.
    hidden = client.patch(url, headers=auth_headers(team["outsider"]), json={"assignee_id": None})
    assert hidden.status_code == 404


def test_member_can_create_and_assign_to_anyone(
    client: TestClient, team: dict[str, Any], auth_headers: Headers
) -> None:
    response = client.post(
        API,
        headers=auth_headers(team["bystander"]),
        json={
            "project_id": team["project"].id,
            "title": "Self-created task",
            "assignee_id": team["assignee"].id,
        },
    )
    assert response.status_code == 201
    assert response.json()["assignee"]["id"] == team["assignee"].id
    assert response.json()["created_by"]["id"] == team["bystander"].id


def test_assignee_must_be_member(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    url = f"{API}/{assignment.id}/assignee"
    response = client.patch(
        url, headers=auth_headers(team["owner"]), json={"assignee_id": team["outsider"].id}
    )
    assert response.status_code == 400
    missing_user = client.patch(url, headers=auth_headers(team["owner"]), json={"assignee_id": 999})
    assert missing_user.status_code == 400


def test_assignee_non_member_caller_404_and_validation(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    url = f"{API}/{assignment.id}/assignee"
    response = client.patch(
        url, headers=auth_headers(team["outsider"]), json={"assignee_id": team["outsider"].id}
    )
    assert response.status_code == 404
    assert client.patch(url, headers=auth_headers(team["owner"]), json={}).status_code == 422


# ---------- comments ----------


def test_comments_crud(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    url = f"{API}/{assignment.id}/comments"
    first = client.post(url, headers=auth_headers(team["bystander"]), json={"body": "  First  "})
    assert first.status_code == 201
    first_body = first.json()
    assert first_body["body"] == "First"
    assert first_body["author"]["id"] == team["bystander"].id
    assert first_body["assignment_id"] == assignment.id
    second = client.post(url, headers=auth_headers(team["owner"]), json={"body": "Second"}).json()

    listed = client.get(url, headers=auth_headers(team["creator"])).json()
    assert [c["id"] for c in listed] == [first_body["id"], second["id"]]  # oldest first

    count = client.get(f"{API}/{assignment.id}", headers=auth_headers(team["owner"])).json()
    assert count["comment_count"] == 2

    deleted = client.delete(f"{url}/{second['id']}", headers=auth_headers(team["owner"]))
    assert deleted.status_code == 204
    remaining = client.get(url, headers=auth_headers(team["owner"])).json()
    assert [c["id"] for c in remaining] == [first_body["id"]]


def test_comment_delete_author_only(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    make_comment: MakeComment,
) -> None:
    assignment = make_assignment(team["project"])
    comment = make_comment(assignment, team["bystander"])
    url = f"{API}/{assignment.id}/comments/{comment.id}"
    # Even the project owner may not delete someone else's comment.
    assert client.delete(url, headers=auth_headers(team["owner"])).status_code == 403
    assert client.delete(url, headers=auth_headers(team["outsider"])).status_code == 404


def test_comment_delete_wrong_assignment_or_missing(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    make_comment: MakeComment,
) -> None:
    a1 = make_assignment(team["project"])
    a2 = make_assignment(team["project"])
    comment = make_comment(a1, team["owner"])
    headers = auth_headers(team["owner"])
    mismatched = client.delete(f"{API}/{a2.id}/comments/{comment.id}", headers=headers)
    assert mismatched.status_code == 404
    assert mismatched.json()["detail"] == "Comment not found"
    assert client.delete(f"{API}/{a1.id}/comments/9999", headers=headers).status_code == 404


@pytest.mark.parametrize("body", ["", "   ", "x" * 5001])
def test_comment_validation(
    client: TestClient,
    team: dict[str, Any],
    auth_headers: Headers,
    make_assignment: MakeAssignment,
    body: str,
) -> None:
    assignment = make_assignment(team["project"])
    response = client.post(
        f"{API}/{assignment.id}/comments", headers=auth_headers(team["owner"]), json={"body": body}
    )
    assert response.status_code == 422


def test_comments_hidden_from_non_members(
    client: TestClient, team: dict[str, Any], auth_headers: Headers, make_assignment: MakeAssignment
) -> None:
    assignment = make_assignment(team["project"])
    url = f"{API}/{assignment.id}/comments"
    headers = auth_headers(team["outsider"])
    assert client.get(url, headers=headers).status_code == 404
    assert client.post(url, headers=headers, json={"body": "hi"}).status_code == 404
