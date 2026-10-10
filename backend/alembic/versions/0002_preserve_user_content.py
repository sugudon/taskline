"""preserve user content on account deletion; index refresh_tokens.expires_at

assignments.created_by_id and comments.author_id become nullable with ON DELETE SET NULL
(previously NOT NULL + CASCADE, so deleting an account destroyed other people's work).

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-10 00:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (table, column, fk name) — names follow NAMING_CONVENTION in app/database.py.
_USER_FKS = (
    ("assignments", "created_by_id", "fk_assignments_created_by_id_users"),
    ("comments", "author_id", "fk_comments_author_id_users"),
)


def _retarget(nullable: bool, ondelete: str) -> None:
    for table, column, fk_name in _USER_FKS:
        # batch_alter_table recreates the table on SQLite and emits plain ALTERs on PostgreSQL.
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(fk_name, type_="foreignkey")
            batch.alter_column(column, existing_type=sa.Integer(), nullable=nullable)
            batch.create_foreign_key(fk_name, "users", [column], ["id"], ondelete=ondelete)


def upgrade() -> None:
    _retarget(nullable=True, ondelete="SET NULL")
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_expires_at", table_name="refresh_tokens")
    # Rows orphaned by account deletion cannot satisfy NOT NULL; under the old schema they
    # would have been cascade-deleted with their author, so delete them.
    op.execute(
        sa.text(
            "DELETE FROM comments WHERE author_id IS NULL OR assignment_id IN "
            "(SELECT id FROM assignments WHERE created_by_id IS NULL)"
        )
    )
    op.execute(sa.text("DELETE FROM assignments WHERE created_by_id IS NULL"))
    _retarget(nullable=False, ondelete="CASCADE")
