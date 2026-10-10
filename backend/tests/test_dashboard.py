from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.models import Assignment, AssignmentStatus, Comment, Project, User

API = "/api/v1/dashboard/summary"

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]
MakeProject = Callable[..., Project]
MakeAssignment = Callable[..., Assignment]
MakeComment = Callable[..., Comment]

TODAY = datetime.now(UTC).date()


def test_dashboard_requires_auth(client: TestClient) -> None:
    assert client.get(API).status_code == 401


def test_dashboard_empty(client: TestClient, make_user: MakeUser, auth_headers: Headers) -> None:
    body = client.get(API, headers=auth_headers(make_user())).json()
    assert body == {
        "total": 0,
        "by_status": {"todo": 0, "in_progress": 0, "in_review": 0, "done": 0},
        "overdue_count": 0,
        "assigned_to_me_count": 0,
        "my_assignments": [],
        "due_this_week": [],
        "overdue": [],
        "recent_comments": [],
    }


def test_dashboard_counts_and_lists(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
    make_comment: MakeComment,
) -> None:
    me = make_user()
    teammate = make_user()
    stranger = make_user()
    project = make_project(teammate, members=[me])
    hidden_project = make_project(stranger)

    due_today = make_assignment(project, title="today", due_date=TODAY, assignee=me)
    due_in_7 = make_assignment(project, title="in7", due_date=TODAY + timedelta(days=7))
    make_assignment(project, title="in8", due_date=TODAY + timedelta(days=8))
    overdue_old = make_assignment(
        project,
        title="old",
        due_date=TODAY - timedelta(days=5),
        status=AssignmentStatus.IN_PROGRESS,
        assignee=me,
    )
    overdue_new = make_assignment(
        project, title="new", due_date=TODAY - timedelta(days=1), status=AssignmentStatus.IN_REVIEW
    )
    make_assignment(
        project, title="done-late", due_date=TODAY - timedelta(days=2), status=AssignmentStatus.DONE
    )
    make_assignment(
        project, title="done-soon", due_date=TODAY + timedelta(days=1), status=AssignmentStatus.DONE
    )
    make_assignment(project, title="no-date")
    # Invisible to `me`.
    secret = make_assignment(hidden_project, title="secret", due_date=TODAY - timedelta(days=1))
    make_comment(secret, stranger, body="hidden")

    c1 = make_comment(due_today, teammate, body="first")
    c2 = make_comment(overdue_old, me, body="second")

    body = client.get(API, headers=auth_headers(me)).json()
    assert body["total"] == 8
    assert body["by_status"] == {"todo": 4, "in_progress": 1, "in_review": 1, "done": 2}
    assert body["overdue_count"] == 2
    assert body["assigned_to_me_count"] == 2

    assert [a["id"] for a in body["due_this_week"]] == [due_today.id, due_in_7.id]
    assert [a["id"] for a in body["overdue"]] == [overdue_old.id, overdue_new.id]
    assert all(a["is_overdue"] for a in body["overdue"])
    assert body["overdue"][0]["project_name"] == project.name
    assert body["overdue"][0]["comment_count"] == 1

    recent = body["recent_comments"]
    assert [c["id"] for c in recent] == [c2.id, c1.id]  # newest first
    assert recent[0]["assignment_title"] == "old"
    assert recent[0]["assignment_id"] == overdue_old.id
    assert recent[0]["author"]["id"] == me.id
    assert recent[1]["body"] == "first"


def test_dashboard_lists_capped_at_ten(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
    make_comment: MakeComment,
) -> None:
    me = make_user()
    project = make_project(me)
    for i in range(12):
        make_assignment(project, title=f"soon{i}", due_date=TODAY + timedelta(days=i % 7))
        late = make_assignment(project, title=f"late{i}", due_date=TODAY - timedelta(days=i + 1))
        make_comment(late, me, body=f"c{i}")
    body = client.get(API, headers=auth_headers(me)).json()
    assert body["total"] == 24
    assert body["overdue_count"] == 12
    assert len(body["due_this_week"]) == 10
    assert len(body["overdue"]) == 10
    assert len(body["recent_comments"]) == 10
    dues = [a["due_date"] for a in body["due_this_week"]]
    assert dues == sorted(dues)
    overdue_dues = [a["due_date"] for a in body["overdue"]]
    assert overdue_dues == sorted(overdue_dues)  # most overdue first


def test_dashboard_scoped_per_user(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
) -> None:
    alice = make_user()
    bob = make_user()
    make_assignment(make_project(alice), assignee=alice)
    make_assignment(make_project(bob))
    make_assignment(make_project(bob))
    assert client.get(API, headers=auth_headers(alice)).json()["total"] == 1
    bob_body = client.get(API, headers=auth_headers(bob)).json()
    assert bob_body["total"] == 2
    assert bob_body["assigned_to_me_count"] == 0


def test_my_assignments_lists_only_my_open_work_in_order(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
    make_assignment: MakeAssignment,
) -> None:
    scrum_master, employee = make_user(), make_user()
    project = make_project(scrum_master, members=[employee])
    no_date_urgent = make_assignment(
        project, title="No date, urgent", priority="urgent", assignee=employee
    )
    no_date_low = make_assignment(project, title="No date, low", priority="low", assignee=employee)
    far = make_assignment(
        project, title="Far", due_date=TODAY + timedelta(days=60), assignee=employee
    )
    soon = make_assignment(
        project, title="Soon", due_date=TODAY + timedelta(days=1), assignee=employee
    )
    late = make_assignment(
        project, title="Late", due_date=TODAY - timedelta(days=3), assignee=employee
    )
    make_assignment(project, title="Done", status=AssignmentStatus.DONE, assignee=employee)
    make_assignment(project, title="Someone else's", assignee=scrum_master)

    body = client.get(API, headers=auth_headers(employee)).json()

    assert [a["id"] for a in body["my_assignments"]] == [
        late.id,
        soon.id,
        far.id,
        no_date_urgent.id,
        no_date_low.id,
    ]
    assert body["assigned_to_me_count"] == 5  # open work only
    assert body["my_assignments"][0]["is_overdue"] is True


def test_reassignment_moves_task_between_dashboards(
    client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    make_project: MakeProject,
) -> None:
    scrum_master, alice, bob = make_user(), make_user(), make_user()
    project = make_project(scrum_master, members=[alice, bob])

    # An employee creates a task for themselves...
    created = client.post(
        "/api/v1/assignments",
        headers=auth_headers(alice),
        json={"project_id": project.id, "title": "Write tests", "assignee_id": alice.id},
    ).json()

    def mine(user: User) -> list[str]:
        return [
            a["title"] for a in client.get(API, headers=auth_headers(user)).json()["my_assignments"]
        ]

    assert mine(alice) == ["Write tests"]
    assert mine(bob) == []

    # ...and the Scrum master reassigns it to Bob: it moves to Bob's dashboard.
    response = client.patch(
        f"/api/v1/assignments/{created['id']}/assignee",
        headers=auth_headers(scrum_master),
        json={"assignee_id": bob.id},
    )
    assert response.status_code == 200
    assert mine(alice) == []
    assert mine(bob) == ["Write tests"]
