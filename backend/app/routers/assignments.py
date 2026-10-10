"""Assignments router: CRUD, status/assignee updates and comments."""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.dependencies import CurrentUser, DbSession
from app.models import AssignmentPriority, AssignmentStatus
from app.schemas.assignment import (
    AssigneeUpdate,
    AssignmentCreate,
    AssignmentPage,
    AssignmentResponse,
    AssignmentSort,
    AssignmentUpdate,
    StatusUpdate,
)
from app.schemas.comment import CommentCreate, CommentResponse
from app.services import assignment_service, comment_service
from app.services.assignment_service import AssignmentFilters

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("", response_model=AssignmentPage)
def list_assignments(
    db: DbSession,
    user: CurrentUser,
    project_id: int | None = None,
    status_: Annotated[AssignmentStatus | None, Query(alias="status")] = None,
    priority: AssignmentPriority | None = None,
    assignee_id: int | None = None,
    mine: bool = False,
    overdue: bool = False,
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort: AssignmentSort = "-created_at",
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AssignmentPage:
    filters = AssignmentFilters(
        project_id=project_id,
        status=status_,
        priority=priority,
        assignee_id=assignee_id,
        mine=mine,
        overdue=overdue,
        q=q,
    )
    return assignment_service.list_assignments(db, user, filters, sort, page, size)


@router.post("", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    data: AssignmentCreate, db: DbSession, user: CurrentUser
) -> AssignmentResponse:
    return assignment_service.create_assignment(db, user, data)


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(assignment_id: int, db: DbSession, user: CurrentUser) -> AssignmentResponse:
    return assignment_service.get_assignment(db, assignment_id, user)


@router.put("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    assignment_id: int, data: AssignmentUpdate, db: DbSession, user: CurrentUser
) -> AssignmentResponse:
    return assignment_service.update_assignment(db, assignment_id, user, data)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_assignment(assignment_id: int, db: DbSession, user: CurrentUser) -> Response:
    assignment_service.delete_assignment(db, assignment_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{assignment_id}/status", response_model=AssignmentResponse)
def update_status(
    assignment_id: int, data: StatusUpdate, db: DbSession, user: CurrentUser
) -> AssignmentResponse:
    return assignment_service.update_status(db, assignment_id, user, data.status)


@router.patch("/{assignment_id}/assignee", response_model=AssignmentResponse)
def update_assignee(
    assignment_id: int, data: AssigneeUpdate, db: DbSession, user: CurrentUser
) -> AssignmentResponse:
    return assignment_service.update_assignee(db, assignment_id, user, data.assignee_id)


@router.get("/{assignment_id}/comments", response_model=list[CommentResponse])
def list_comments(assignment_id: int, db: DbSession, user: CurrentUser) -> list[CommentResponse]:
    return comment_service.list_comments(db, assignment_id, user)


@router.post(
    "/{assignment_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    assignment_id: int, data: CommentCreate, db: DbSession, user: CurrentUser
) -> CommentResponse:
    return comment_service.create_comment(db, assignment_id, user, data)


@router.delete(
    "/{assignment_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_comment(
    assignment_id: int, comment_id: int, db: DbSession, user: CurrentUser
) -> Response:
    comment_service.delete_comment(db, assignment_id, comment_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
