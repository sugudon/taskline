from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models import Assignment, Comment, Project, ProjectMember, RefreshToken, User
from app.services import project_service

MakeUser = Callable[..., User]


def test_model_reprs(
    make_user: MakeUser,
    make_project: Callable[..., Project],
    make_assignment: Callable[..., Assignment],
    make_comment: Callable[..., Comment],
    db: Session,
) -> None:
    user = make_user(email="repr@example.com")
    project = make_project(user, name="Repr")
    assignment = make_assignment(project, title="Task")
    comment = make_comment(assignment, user)
    member = db.query(ProjectMember).filter_by(project_id=project.id).one()
    token = RefreshToken(id=1, user_id=user.id, token_hash="h", expires_at=user.created_at)

    assert repr(user) == f"<User id={user.id} email='repr@example.com'>"
    assert repr(project) == f"<Project id={project.id} name='Repr'>"
    assert "title='Task'" in repr(assignment)
    assert repr(comment) == f"<Comment id={comment.id} assignment_id={assignment.id}>"
    assert f"user_id={user.id}" in repr(member)
    assert "revoked=None" in repr(token) or "revoked=False" in repr(token)


def test_has_password(make_user: MakeUser) -> None:
    assert make_user().has_password is True
    assert make_user(password=None).has_password is False


def test_counts_for_missing_project_are_zero(db: Session) -> None:
    assert project_service._get_counts(db, 12345) == project_service.ProjectCounts()
