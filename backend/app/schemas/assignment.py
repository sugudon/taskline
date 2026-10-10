"""Assignment schemas."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import AssignmentPriority, AssignmentStatus
from app.schemas.user import UserSummary

DESCRIPTION_MAX_LENGTH = 10000

AssignmentSort = Literal[
    "due_date", "-due_date", "created_at", "-created_at", "priority", "-priority"
]


def _strip_title(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("Title must not be blank")
    return stripped


class AssignmentCreate(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    priority: AssignmentPriority = AssignmentPriority.MEDIUM
    status: AssignmentStatus = AssignmentStatus.TODO
    due_date: date | None = None
    assignee_id: int | None = None

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str) -> str:
        return _strip_title(value)


class AssignmentUpdate(BaseModel):
    """Partial update. Status and assignee have dedicated endpoints."""

    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    priority: AssignmentPriority | None = None
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, value: str | None) -> str | None:
        return None if value is None else _strip_title(value)


class StatusUpdate(BaseModel):
    status: AssignmentStatus


class AssigneeUpdate(BaseModel):
    assignee_id: int | None


class AssignmentResponse(BaseModel):
    id: int
    project_id: int
    project_name: str
    title: str
    description: str | None
    status: AssignmentStatus
    priority: AssignmentPriority
    due_date: date | None
    completed_at: datetime | None
    created_by: UserSummary | None
    assignee: UserSummary | None
    is_overdue: bool
    comment_count: int
    created_at: datetime
    updated_at: datetime | None


class AssignmentPage(BaseModel):
    items: list[AssignmentResponse]
    total: int
    page: int
    size: int
    pages: int
