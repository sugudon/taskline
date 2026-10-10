"""Dashboard aggregation, scoped to projects the user belongs to."""

from datetime import timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Assignment, AssignmentStatus, Comment, User
from app.schemas.dashboard import DashboardSummary, RecentComment, StatusCounts
from app.schemas.user import UserSummary
from app.services.assignment_service import (
    PRIORITY_RANK,
    overdue_condition,
    responses_from_rows,
    select_assignments_with_counts,
    utc_today,
    visible_condition,
)

LIST_LIMIT = 10
MY_ASSIGNMENTS_LIMIT = 20


def get_summary(db: Session, user: User) -> DashboardSummary:
    today = utc_today()
    visible = visible_condition(user)

    # One grouped query: per-status totals plus overdue / assigned-to-me counts.
    count_rows = db.execute(
        select(
            Assignment.status,
            func.count(Assignment.id),
            func.coalesce(func.sum(case((overdue_condition(today), 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Assignment.assignee_id == user.id)
                            & (Assignment.status != AssignmentStatus.DONE),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .where(visible)
        .group_by(Assignment.status)
    ).all()

    by_status = StatusCounts()
    total = overdue_count = mine_count = 0
    for status, count, overdue, mine in count_rows:
        setattr(by_status, AssignmentStatus(status).value, int(count))
        total += int(count)
        overdue_count += int(overdue)
        mine_count += int(mine)

    due_rows = db.execute(
        select_assignments_with_counts()
        .where(
            visible,
            Assignment.due_date.is_not(None),
            Assignment.due_date >= today,
            Assignment.due_date <= today + timedelta(days=7),
            Assignment.status != AssignmentStatus.DONE,
        )
        .order_by(Assignment.due_date.asc(), Assignment.id.asc())
        .limit(LIST_LIMIT)
    ).all()

    # The user's own open work: dated items first (soonest due), then by urgency.
    priority_rank = case(
        *((Assignment.priority == p, rank) for p, rank in PRIORITY_RANK.items()), else_=99
    )
    my_rows = db.execute(
        select_assignments_with_counts()
        .where(
            visible,
            Assignment.assignee_id == user.id,
            Assignment.status != AssignmentStatus.DONE,
        )
        .order_by(
            Assignment.due_date.is_(None),
            Assignment.due_date.asc(),
            priority_rank,
            Assignment.id.asc(),
        )
        .limit(MY_ASSIGNMENTS_LIMIT)
    ).all()

    overdue_rows = db.execute(
        select_assignments_with_counts()
        .where(visible, overdue_condition(today))
        .order_by(Assignment.due_date.asc(), Assignment.id.asc())
        .limit(LIST_LIMIT)
    ).all()

    comment_rows = db.execute(
        select(Comment, Assignment.title)
        .join(Assignment, Comment.assignment_id == Assignment.id)
        .where(visible)
        .options(joinedload(Comment.author))
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .limit(LIST_LIMIT)
    ).all()

    return DashboardSummary(
        total=total,
        by_status=by_status,
        overdue_count=overdue_count,
        assigned_to_me_count=mine_count,
        my_assignments=responses_from_rows(my_rows, today),
        due_this_week=responses_from_rows(due_rows, today),
        overdue=responses_from_rows(overdue_rows, today),
        recent_comments=[
            RecentComment(
                id=comment.id,
                body=comment.body,
                created_at=comment.created_at,
                author=UserSummary.model_validate(comment.author) if comment.author else None,
                assignment_id=comment.assignment_id,
                assignment_title=title,
            )
            for comment, title in comment_rows
        ],
    )
