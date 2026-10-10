"""Shared project access-control helpers.

Non-members get 404 (no data leak); members lacking permission get 403.
"""

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models import Project, ProjectMember, User


def get_membership(db: Session, project_id: int, user: User) -> ProjectMember | None:
    stmt = select(ProjectMember).where(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
    )
    return db.scalars(stmt).first()


def get_project_for_member(db: Session, project_id: int, user: User) -> Project:
    """Return the project if `user` is a member, else raise NotFoundError("Project")."""
    project = db.get(Project, project_id)
    if project is None or get_membership(db, project_id, user) is None:
        raise NotFoundError("Project")
    return project


def is_owner(project: Project, user: User) -> bool:
    return project.owner_id == user.id


def require_owner(project: Project, user: User) -> None:
    if not is_owner(project, user):
        raise ForbiddenError("Only the project owner can perform this action")


def require_not_archived(project: Project) -> None:
    """Archived projects are read-only (except owner project update/delete to unarchive)."""
    if project.is_archived:
        raise ConflictError("Project is archived")


def member_project_ids(db_or_user: Session | User, user: User | None = None) -> Select[int]:
    """SELECT of ids of projects the user belongs to (for use in `.in_()` filters).

    Callable as `member_project_ids(user)` or `member_project_ids(db, user)`; no session is
    needed because a statement (not a result) is returned.
    """
    target = user if user is not None else db_or_user
    if not isinstance(target, User):
        raise TypeError("member_project_ids requires a User")
    return select(ProjectMember.project_id).where(ProjectMember.user_id == target.id)
