"""Assignment business logic.

Visibility rule: a user only sees assignments in projects they are a member of; anything
else is reported as 404 so existence is never leaked.
"""

import logging
import math
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import ColumnElement, Select, and_, case, func, select
from sqlalchemy.orm import Session, joinedload

from app.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.models import (
    Assignment,
    AssignmentPriority,
    AssignmentStatus,
    Comment,
    ProjectMember,
    User,
)
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentPage,
    AssignmentResponse,
    AssignmentSort,
    AssignmentUpdate,
)
from app.schemas.user import UserSummary
from app.services.access import (
    get_project_for_member,
    is_owner,
    member_project_ids,
    require_not_archived,
)

logger = logging.getLogger(__name__)

# Lower rank = more urgent, so ascending "priority" sort lists urgent work first.
PRIORITY_RANK: dict[AssignmentPriority, int] = {
    AssignmentPriority.URGENT: 0,
    AssignmentPriority.HIGH: 1,
    AssignmentPriority.MEDIUM: 2,
    AssignmentPriority.LOW: 3,
}


@dataclass(frozen=True)
class AssignmentFilters:
    project_id: int | None = None
    status: AssignmentStatus | None = None
    priority: AssignmentPriority | None = None
    assignee_id: int | None = None
    mine: bool = False
    overdue: bool = False
    q: str | None = None


def utc_today() -> date:
    return datetime.now(UTC).date()


def overdue_condition(today: date) -> ColumnElement[bool]:
    """SQL condition matching overdue assignments (due before today and not done)."""
    return and_(
        Assignment.due_date.is_not(None),
        Assignment.due_date < today,
        Assignment.status != AssignmentStatus.DONE,
    )


def visible_condition(user: User) -> ColumnElement[bool]:
    """SQL condition restricting assignments to projects the user belongs to."""
    return Assignment.project_id.in_(member_project_ids(user))


def _comment_count_subquery() -> Any:
    return (
        select(Comment.assignment_id, func.count(Comment.id).label("comment_count"))
        .group_by(Comment.assignment_id)
        .subquery()
    )


def select_assignments_with_counts() -> Select[Assignment, int]:
    """SELECT (Assignment, comment_count) with project/creator/assignee eager-loaded.

    Uses a grouped comment-count subquery and joined eager loads to avoid N+1 queries.
    Callers add their own WHERE / ORDER BY / LIMIT.
    """
    counts = _comment_count_subquery()
    return (
        select(Assignment, func.coalesce(counts.c.comment_count, 0))
        .outerjoin(counts, counts.c.assignment_id == Assignment.id)
        .options(
            joinedload(Assignment.project),
            joinedload(Assignment.created_by),
            joinedload(Assignment.assignee),
        )
    )


def build_assignment_response(
    assignment: Assignment, comment_count: int, today: date
) -> AssignmentResponse:
    """Single place that turns an Assignment row into the API response."""
    is_overdue = (
        assignment.due_date is not None
        and assignment.due_date < today
        and assignment.status != AssignmentStatus.DONE
    )
    return AssignmentResponse(
        id=assignment.id,
        project_id=assignment.project_id,
        project_name=assignment.project.name,
        title=assignment.title,
        description=assignment.description,
        status=assignment.status,
        priority=assignment.priority,
        due_date=assignment.due_date,
        completed_at=assignment.completed_at,
        created_by=(
            UserSummary.model_validate(assignment.created_by) if assignment.created_by else None
        ),
        assignee=(UserSummary.model_validate(assignment.assignee) if assignment.assignee else None),
        is_overdue=is_overdue,
        comment_count=int(comment_count),
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


def responses_from_rows(rows: Any, today: date) -> list[AssignmentResponse]:
    return [build_assignment_response(a, count, today) for a, count in rows]


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _filter_conditions(
    filters: AssignmentFilters, user: User, today: date
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [visible_condition(user)]
    if filters.project_id is not None:
        conditions.append(Assignment.project_id == filters.project_id)
    if filters.status is not None:
        conditions.append(Assignment.status == filters.status)
    if filters.priority is not None:
        conditions.append(Assignment.priority == filters.priority)
    if filters.assignee_id is not None:
        conditions.append(Assignment.assignee_id == filters.assignee_id)
    if filters.mine:
        conditions.append(Assignment.assignee_id == user.id)
    if filters.overdue:
        conditions.append(overdue_condition(today))
    if filters.q:
        term = filters.q.strip()
        if term:
            conditions.append(Assignment.title.ilike(f"%{_escape_like(term)}%", escape="\\"))
    return conditions


def _order_by(sort: AssignmentSort) -> list[Any]:
    priority_rank = case(
        *[(Assignment.priority == p, rank) for p, rank in PRIORITY_RANK.items()],
        else_=len(PRIORITY_RANK),
    )
    orderings: dict[str, list[Any]] = {
        "due_date": [Assignment.due_date.asc().nulls_last()],
        "-due_date": [Assignment.due_date.desc().nulls_last()],
        "created_at": [Assignment.created_at.asc()],
        "-created_at": [Assignment.created_at.desc()],
        "priority": [priority_rank.asc(), Assignment.due_date.asc().nulls_last()],
        "-priority": [priority_rank.desc(), Assignment.due_date.asc().nulls_last()],
    }
    tie_breaker = Assignment.id.asc() if sort == "created_at" else Assignment.id.desc()
    return [*orderings[sort], tie_breaker]


def list_assignments(
    db: Session,
    user: User,
    filters: AssignmentFilters,
    sort: AssignmentSort,
    page: int,
    size: int,
) -> AssignmentPage:
    today = utc_today()
    conditions = _filter_conditions(filters, user, today)

    total = db.scalar(select(func.count(Assignment.id)).where(*conditions)) or 0
    rows = db.execute(
        select_assignments_with_counts()
        .where(*conditions)
        .order_by(*_order_by(sort))
        .offset((page - 1) * size)
        .limit(size)
    ).all()

    return AssignmentPage(
        items=responses_from_rows(rows, today),
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


def _fetch_visible(db: Session, assignment_id: int, user: User) -> tuple[Assignment, int]:
    # populate_existing refreshes identity-mapped rows (sessions use expire_on_commit=False).
    row = db.execute(
        select_assignments_with_counts()
        .where(Assignment.id == assignment_id, visible_condition(user))
        .execution_options(populate_existing=True)
    ).first()
    if row is None:
        raise NotFoundError("Assignment")
    return row[0], int(row[1])


def get_visible_assignment(db: Session, assignment_id: int, user: User) -> Assignment:
    """Return the assignment if the user is a member of its project, else 404."""
    return _fetch_visible(db, assignment_id, user)[0]


def _response_for(db: Session, assignment_id: int, user: User) -> AssignmentResponse:
    assignment, count = _fetch_visible(db, assignment_id, user)
    return build_assignment_response(assignment, count, utc_today())


def get_assignment(db: Session, assignment_id: int, user: User) -> AssignmentResponse:
    return _response_for(db, assignment_id, user)


def _ensure_assignee_is_member(db: Session, project_id: int, assignee_id: int) -> None:
    membership = db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == assignee_id
        )
    )
    if membership is None:
        raise BadRequestError("Assignee must be a member of the project")


def create_assignment(db: Session, user: User, data: AssignmentCreate) -> AssignmentResponse:
    project = get_project_for_member(db, data.project_id, user)
    require_not_archived(project)
    if data.assignee_id is not None:
        _ensure_assignee_is_member(db, project.id, data.assignee_id)

    assignment = Assignment(
        project_id=project.id,
        created_by_id=user.id,
        assignee_id=data.assignee_id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        status=data.status,
        due_date=data.due_date,
        completed_at=datetime.now(UTC) if data.status == AssignmentStatus.DONE else None,
    )
    db.add(assignment)
    db.commit()
    logger.info("User %s created assignment %s in project %s", user.id, assignment.id, project.id)
    return _response_for(db, assignment.id, user)


def update_assignment(
    db: Session, assignment_id: int, user: User, data: AssignmentUpdate
) -> AssignmentResponse:
    assignment = get_visible_assignment(db, assignment_id, user)
    if user.id not in (assignment.created_by_id, assignment.assignee_id) and not is_owner(
        assignment.project, user
    ):
        raise ForbiddenError("Only the creator, assignee or project owner can edit this assignment")
    require_not_archived(assignment.project)

    changes = data.model_dump(exclude_unset=True)
    # title and priority are non-nullable: an explicit null means "leave unchanged".
    for field in ("title", "priority"):
        if changes.get(field, ...) is None:
            changes.pop(field)
    for field, value in changes.items():
        setattr(assignment, field, value)

    db.commit()
    logger.info("User %s updated assignment %s (%s)", user.id, assignment_id, sorted(changes))
    return _response_for(db, assignment_id, user)


def delete_assignment(db: Session, assignment_id: int, user: User) -> None:
    assignment = get_visible_assignment(db, assignment_id, user)
    if assignment.created_by_id != user.id and not is_owner(assignment.project, user):
        raise ForbiddenError("Only the creator or project owner can delete this assignment")
    db.delete(assignment)
    db.commit()
    logger.info("User %s deleted assignment %s", user.id, assignment_id)


def update_status(
    db: Session, assignment_id: int, user: User, new_status: AssignmentStatus
) -> AssignmentResponse:
    assignment = get_visible_assignment(db, assignment_id, user)
    require_not_archived(assignment.project)
    previous = assignment.status
    if new_status != previous:
        assignment.status = new_status
        if new_status == AssignmentStatus.DONE:
            assignment.completed_at = datetime.now(UTC)
        elif previous == AssignmentStatus.DONE:
            assignment.completed_at = None
        db.commit()
        logger.info(
            "User %s moved assignment %s from %s to %s",
            user.id,
            assignment_id,
            previous.value,
            new_status.value,
        )
    return _response_for(db, assignment_id, user)


def update_assignee(
    db: Session, assignment_id: int, user: User, assignee_id: int | None
) -> AssignmentResponse:
    assignment = get_visible_assignment(db, assignment_id, user)
    require_not_archived(assignment.project)
    if assignee_id is not None:
        _ensure_assignee_is_member(db, assignment.project_id, assignee_id)
    assignment.assignee_id = assignee_id
    db.commit()
    logger.info("User %s set assignee of %s to %s", user.id, assignment_id, assignee_id)
    return _response_for(db, assignment_id, user)
