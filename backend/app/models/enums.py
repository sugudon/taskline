"""Enumerations shared by models and schemas."""

import enum


class AssignmentStatus(str, enum.Enum):  # noqa: UP042
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class AssignmentPriority(str, enum.Enum):  # noqa: UP042
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ProjectRole(str, enum.Enum):  # noqa: UP042
    OWNER = "owner"
    MEMBER = "member"
