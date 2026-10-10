"""Dashboard schemas."""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.assignment import AssignmentResponse
from app.schemas.user import UserSummary


class StatusCounts(BaseModel):
    todo: int = 0
    in_progress: int = 0
    in_review: int = 0
    done: int = 0


class RecentComment(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: UserSummary | None
    assignment_id: int
    assignment_title: str


class DashboardSummary(BaseModel):
    total: int
    by_status: StatusCounts
    overdue_count: int
    # Open (not done) assignments where the current user is the assignee.
    assigned_to_me_count: int
    my_assignments: list[AssignmentResponse]
    due_this_week: list[AssignmentResponse]
    overdue: list[AssignmentResponse]
    recent_comments: list[RecentComment]
