"""Dashboard router."""

from fastapi import APIRouter

from app.dependencies import CurrentUser, DbSession
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: DbSession, user: CurrentUser) -> DashboardSummary:
    return dashboard_service.get_summary(db, user)
