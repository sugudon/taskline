"""Project business logic: CRUD, membership management and aggregate counts."""

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Row, Select, case, func, select, update
from sqlalchemy.orm import Session, selectinload

from app.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models import Assignment, AssignmentStatus, Project, ProjectMember, ProjectRole, User
from app.schemas.project import (
    AddMemberRequest,
    ProjectCreate,
    ProjectDetail,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.access import (
    get_project_for_member,
    member_project_ids,
    require_not_archived,
    require_owner,
)

logger = logging.getLogger(__name__)

_NON_NULLABLE_UPDATE_FIELDS = {"name", "color", "is_archived"}


@dataclass(frozen=True)
class ProjectCounts:
    member_count: int = 0
    assignment_count: int = 0
    open_assignment_count: int = 0


def _projects_with_counts_stmt() -> Select:
    """SELECT Project plus member/assignment/open-assignment counts via grouped subqueries."""
    member_sq = (
        select(
            ProjectMember.project_id.label("project_id"),
            func.count(ProjectMember.id).label("member_count"),
        )
        .group_by(ProjectMember.project_id)
        .subquery()
    )
    assignment_sq = (
        select(
            Assignment.project_id.label("project_id"),
            func.count(Assignment.id).label("assignment_count"),
            func.coalesce(
                func.sum(case((Assignment.status != AssignmentStatus.DONE, 1), else_=0)), 0
            ).label("open_assignment_count"),
        )
        .group_by(Assignment.project_id)
        .subquery()
    )
    return (
        select(
            Project,
            func.coalesce(member_sq.c.member_count, 0),
            func.coalesce(assignment_sq.c.assignment_count, 0),
            func.coalesce(assignment_sq.c.open_assignment_count, 0),
        )
        .outerjoin(member_sq, member_sq.c.project_id == Project.id)
        .outerjoin(assignment_sq, assignment_sq.c.project_id == Project.id)
    )


def _base_fields(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "owner_id": project.owner_id,
        "name": project.name,
        "description": project.description,
        "color": project.color,
        "is_archived": project.is_archived,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


def _to_response(project: Project, counts: ProjectCounts) -> ProjectResponse:
    return ProjectResponse(
        **_base_fields(project),
        member_count=counts.member_count,
        assignment_count=counts.assignment_count,
        open_assignment_count=counts.open_assignment_count,
    )


def _row_counts(row: Row) -> ProjectCounts:
    return ProjectCounts(int(row[1]), int(row[2]), int(row[3]))


def _get_counts(db: Session, project_id: int) -> ProjectCounts:
    row = db.execute(_projects_with_counts_stmt().where(Project.id == project_id)).first()
    if row is None:
        return ProjectCounts()
    return _row_counts(row)


def _list_member_models(db: Session, project_id: int) -> list[ProjectMember]:
    """Members of a project with users eager-loaded, owner first then by joined_at."""
    stmt = (
        select(ProjectMember)
        .options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
        .order_by(
            case((ProjectMember.role == ProjectRole.OWNER, 0), else_=1),
            ProjectMember.joined_at,
            ProjectMember.id,
        )
    )
    return list(db.scalars(stmt).all())


def _build_detail(db: Session, project: Project) -> ProjectDetail:
    counts = _get_counts(db, project.id)
    members = [ProjectMemberResponse.model_validate(m) for m in _list_member_models(db, project.id)]
    return ProjectDetail(
        **_base_fields(project),
        member_count=counts.member_count,
        assignment_count=counts.assignment_count,
        open_assignment_count=counts.open_assignment_count,
        members=members,
    )


def list_projects(db: Session, user: User, include_archived: bool = False) -> list[ProjectResponse]:
    stmt = _projects_with_counts_stmt().where(Project.id.in_(member_project_ids(db, user)))
    if not include_archived:
        stmt = stmt.where(Project.is_archived.is_(False))
    stmt = stmt.order_by(Project.created_at.desc(), Project.id.desc())
    return [_to_response(row[0], _row_counts(row)) for row in db.execute(stmt).all()]


def create_project(db: Session, user: User, data: ProjectCreate) -> ProjectDetail:
    project = Project(
        owner_id=user.id,
        name=data.name,
        description=data.description,
        color=data.color,
    )
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role=ProjectRole.OWNER))
    db.commit()
    db.refresh(project)
    logger.info("User %s created project %s", user.id, project.id)
    return _build_detail(db, project)


def get_project_detail(db: Session, user: User, project_id: int) -> ProjectDetail:
    project = get_project_for_member(db, project_id, user)
    return _build_detail(db, project)


def update_project(db: Session, user: User, project_id: int, data: ProjectUpdate) -> ProjectDetail:
    project = get_project_for_member(db, project_id, user)
    require_owner(project, user)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None and field in _NON_NULLABLE_UPDATE_FIELDS:
            continue
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    logger.info("User %s updated project %s (fields=%s)", user.id, project.id, sorted(changes))
    return _build_detail(db, project)


def delete_project(db: Session, user: User, project_id: int) -> None:
    project = get_project_for_member(db, project_id, user)
    require_owner(project, user)
    db.delete(project)
    db.commit()
    logger.info("User %s deleted project %s", user.id, project_id)


def list_members(db: Session, user: User, project_id: int) -> list[ProjectMemberResponse]:
    get_project_for_member(db, project_id, user)
    return [ProjectMemberResponse.model_validate(m) for m in _list_member_models(db, project_id)]


def add_member(
    db: Session, user: User, project_id: int, data: AddMemberRequest
) -> ProjectMemberResponse:
    project = get_project_for_member(db, project_id, user)
    require_owner(project, user)
    require_not_archived(project)
    target = db.scalars(
        select(User).where(func.lower(User.email) == data.email.strip().lower())
    ).first()
    if target is None:
        raise NotFoundError("User")
    existing = db.scalars(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == target.id
        )
    ).first()
    if existing is not None:
        raise ConflictError("User is already a member of this project")
    member = ProjectMember(project_id=project_id, user_id=target.id, role=ProjectRole.MEMBER)
    db.add(member)
    db.commit()
    db.refresh(member)
    logger.info("User %s added user %s to project %s", user.id, target.id, project_id)
    return ProjectMemberResponse.model_validate(member)


def remove_member(db: Session, user: User, project_id: int, member_user_id: int) -> None:
    project = get_project_for_member(db, project_id, user)
    require_owner(project, user)
    if member_user_id == project.owner_id:
        raise BadRequestError("Cannot remove the project owner")
    member = db.scalars(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == member_user_id
        )
    ).first()
    if member is None:
        raise NotFoundError("Member")
    if member.role == ProjectRole.OWNER:
        raise BadRequestError("Cannot remove the project owner")
    result = db.execute(
        update(Assignment)
        .where(
            Assignment.project_id == project_id,
            Assignment.assignee_id == member_user_id,
            Assignment.status != AssignmentStatus.DONE,
        )
        .values(assignee_id=None)
        .execution_options(synchronize_session="fetch")
    )
    db.delete(member)
    db.commit()
    logger.info(
        "User %s removed user %s from project %s (unassigned %s assignments)",
        user.id,
        member_user_id,
        project_id,
        getattr(result, "rowcount", 0),
    )
