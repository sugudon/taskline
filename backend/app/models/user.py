"""User model."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.comment import Comment
    from app.models.project import Project
    from app.models.project_member import ProjectMember
    from app.models.refresh_token import RefreshToken


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )
    oauth_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    owned_projects: Mapped[list["Project"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan", passive_deletes=True
    )
    project_memberships: Mapped[list["ProjectMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    # No delete cascade: the DB sets created_by_id / author_id to NULL on user deletion.
    created_assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="created_by",
        foreign_keys="Assignment.created_by_id",
        passive_deletes=True,
    )
    assigned_assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="assignee",
        foreign_keys="Assignment.assignee_id",
        passive_deletes=True,
    )
    comments: Mapped[list["Comment"]] = relationship(back_populates="author", passive_deletes=True)
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    @property
    def has_password(self) -> bool:
        return self.hashed_password is not None

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
