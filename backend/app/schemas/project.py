"""Project schemas."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.enums import ProjectRole
from app.schemas.user import UserSummary

COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"
DEFAULT_COLOR = "#805AD5"
DESCRIPTION_MAX_LENGTH = 10000

ProjectName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
ProjectColor = Annotated[str, StringConstraints(pattern=COLOR_PATTERN)]


class ProjectCreate(BaseModel):
    name: ProjectName
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    color: ProjectColor = DEFAULT_COLOR


class ProjectUpdate(BaseModel):
    """Partial update. Only fields explicitly sent are applied.

    `name`, `color` and `is_archived` are non-nullable; sending null for them is ignored.
    """

    name: ProjectName | None = None
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    color: ProjectColor | None = None
    is_archived: bool | None = None


class ProjectMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: UserSummary
    role: ProjectRole
    joined_at: datetime


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    description: str | None = None
    color: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime | None = None
    member_count: int = Field(default=0, ge=0)
    assignment_count: int = Field(default=0, ge=0)
    open_assignment_count: int = Field(default=0, ge=0)


class ProjectDetail(ProjectResponse):
    members: list[ProjectMemberResponse] = Field(default_factory=list)


class AddMemberRequest(BaseModel):
    email: EmailStr
