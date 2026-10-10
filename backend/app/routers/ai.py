"""AI router: plan-from-goal drafts and project status reports."""

from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DbSession
from app.schemas.ai import AIStatus, PlanApplyRequest, PlanDraft, PlanRequest, ProjectReport
from app.schemas.assignment import AssignmentResponse
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status", response_model=AIStatus)
def get_status(db: DbSession, user: CurrentUser) -> AIStatus:
    return ai_service.get_status(db, user)


@router.post("/projects/{project_id}/plan", response_model=PlanDraft)
def generate_plan(project_id: int, req: PlanRequest, db: DbSession, user: CurrentUser) -> PlanDraft:
    return ai_service.generate_plan(db, user, project_id, req)


@router.post(
    "/projects/{project_id}/plan/apply",
    response_model=list[AssignmentResponse],
    status_code=status.HTTP_201_CREATED,
)
def apply_plan(
    project_id: int, req: PlanApplyRequest, db: DbSession, user: CurrentUser
) -> list[AssignmentResponse]:
    return ai_service.apply_plan(db, user, project_id, req)


@router.post("/projects/{project_id}/report", response_model=ProjectReport)
def generate_report(project_id: int, db: DbSession, user: CurrentUser) -> ProjectReport:
    return ai_service.generate_report(db, user, project_id)
