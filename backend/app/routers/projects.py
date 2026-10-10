"""Projects router: project CRUD and membership management."""

from fastapi import APIRouter, Query, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.project import (
    AddMemberRequest,
    ProjectCreate,
    ProjectDetail,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
)
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: DbSession,
    current_user: CurrentUser,
    include_archived: bool = Query(default=False),
) -> list[ProjectResponse]:
    return project_service.list_projects(db, current_user, include_archived)


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
def create_project(data: ProjectCreate, db: DbSession, current_user: CurrentUser) -> ProjectDetail:
    return project_service.create_project(db, current_user, data)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: DbSession, current_user: CurrentUser) -> ProjectDetail:
    return project_service.get_project_detail(db, current_user, project_id)


@router.put("/{project_id}", response_model=ProjectDetail)
def update_project(
    project_id: int, data: ProjectUpdate, db: DbSession, current_user: CurrentUser
) -> ProjectDetail:
    return project_service.update_project(db, current_user, project_id, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_project(project_id: int, db: DbSession, current_user: CurrentUser) -> None:
    project_service.delete_project(db, current_user, project_id)


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
def list_members(
    project_id: int, db: DbSession, current_user: CurrentUser
) -> list[ProjectMemberResponse]:
    return project_service.list_members(db, current_user, project_id)


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    project_id: int, data: AddMemberRequest, db: DbSession, current_user: CurrentUser
) -> ProjectMemberResponse:
    return project_service.add_member(db, current_user, project_id, data)


@router.delete(
    "/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def remove_member(project_id: int, user_id: int, db: DbSession, current_user: CurrentUser) -> None:
    project_service.remove_member(db, current_user, project_id, user_id)
