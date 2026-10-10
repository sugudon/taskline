"""Comment business logic (comments live under a visible assignment)."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.exceptions import ForbiddenError, NotFoundError
from app.models import Comment, User
from app.schemas.comment import CommentCreate, CommentResponse
from app.services.access import require_not_archived
from app.services.assignment_service import get_visible_assignment

logger = logging.getLogger(__name__)


def list_comments(db: Session, assignment_id: int, user: User) -> list[CommentResponse]:
    get_visible_assignment(db, assignment_id, user)
    comments = db.scalars(
        select(Comment)
        .where(Comment.assignment_id == assignment_id)
        .options(joinedload(Comment.author))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    return [CommentResponse.model_validate(c) for c in comments]


def create_comment(
    db: Session, assignment_id: int, user: User, data: CommentCreate
) -> CommentResponse:
    assignment = get_visible_assignment(db, assignment_id, user)
    require_not_archived(assignment.project)
    comment = Comment(assignment_id=assignment_id, author_id=user.id, body=data.body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    logger.info("User %s commented %s on assignment %s", user.id, comment.id, assignment_id)
    return CommentResponse.model_validate(comment)


def delete_comment(db: Session, assignment_id: int, comment_id: int, user: User) -> None:
    get_visible_assignment(db, assignment_id, user)
    comment = db.get(Comment, comment_id)
    if comment is None or comment.assignment_id != assignment_id:
        raise NotFoundError("Comment")
    if comment.author_id != user.id:
        raise ForbiddenError("You can only delete your own comments")
    db.delete(comment)
    db.commit()
    logger.info("User %s deleted comment %s", user.id, comment_id)
