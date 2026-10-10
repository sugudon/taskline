"""Assignment model."""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin
from app.models.enums import AssignmentPriority, AssignmentStatus

if TYPE_CHECKING:
    from app.models.comment import Comment
    from app.models.project import Project
    from app.models.user import User


class Assignment(TimestampMixin, Base):
    __tablename__ = "assignments"
    __table_args__ = (
        Index("ix_assignments_project_id_status", "project_id", "status"),
        Index("ix_assignments_assignee_id", "assignee_id"),
        Index("ix_assignments_due_date", "due_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    # Nullable so an author deleting their account does not destroy shared work.
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    assignee_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(
        Enum(
            AssignmentStatus,
            name="assignment_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=AssignmentStatus.TODO,
        nullable=False,
    )
    priority: Mapped[AssignmentPriority] = mapped_column(
        Enum(
            AssignmentPriority,
            name="assignment_priority",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=AssignmentPriority.MEDIUM,
        nullable=False,
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="assignments")
    created_by: Mapped["User | None"] = relationship(
        back_populates="created_assignments", foreign_keys=[created_by_id]
    )
    assignee: Mapped["User | None"] = relationship(
        back_populates="assigned_assignments", foreign_keys=[assignee_id]
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="assignment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Comment.created_at",
    )

    def __repr__(self) -> str:
        return f"<Assignment id={self.id} title={self.title!r} status={self.status}>"
