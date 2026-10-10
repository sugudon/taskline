"""AI feature schemas.

`LLM*` models describe what the model must return (structured outputs: no length/format
constraints, which the API does not support everywhere); the service validates and clamps
them into the API-facing models below.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import AssignmentPriority
from app.schemas.assignment import DESCRIPTION_MAX_LENGTH

PriorityLiteral = Literal["low", "medium", "high", "urgent"]


# ---------- Model output (internal) ----------
class LLMPlanItem(BaseModel):
    title: str
    description: str
    priority: PriorityLiteral
    due_date: str | None
    assignee_user_id: int | None
    rationale: str


class LLMPlan(BaseModel):
    items: list[LLMPlanItem]
    notes: str | None


class LLMReport(BaseModel):
    headline: str
    completed: list[str]
    in_progress: list[str]
    at_risk: list[str]
    next_steps: list[str]
    workload: list[str]


# ---------- API ----------
class AIStatus(BaseModel):
    enabled: bool
    daily_limit: int
    used_today: int
    remaining_today: int


class PlanRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)
    deadline: date | None = None
    max_items: int = Field(default=8, ge=3, le=20)

    @field_validator("goal")
    @classmethod
    def _strip_goal(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 3:
            raise ValueError("Describe the goal in at least 3 characters")
        return stripped


class PlanItem(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=DESCRIPTION_MAX_LENGTH)
    priority: AssignmentPriority = AssignmentPriority.MEDIUM
    due_date: date | None = None
    assignee_id: int | None = None

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Title must not be blank")
        return stripped


class PlanDraftItem(PlanItem):
    rationale: str | None = None


class PlanDraft(BaseModel):
    items: list[PlanDraftItem]
    notes: str | None = None


class PlanApplyRequest(BaseModel):
    items: list[PlanItem] = Field(min_length=1, max_length=30)


class ProjectReport(BaseModel):
    headline: str
    completed: list[str]
    in_progress: list[str]
    at_risk: list[str]
    next_steps: list[str]
    workload: list[str]
    generated_at: datetime
