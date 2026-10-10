"""Auth business logic: registration, login, token rotation, profile and Google OAuth."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, delete, exists, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.google import GoogleUserInfo
from app.auth.security import (
    burn_password_check,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.exceptions import BadRequestError, ConflictError, UnauthorizedError
from app.models import Project, ProjectMember, RefreshToken, User
from app.schemas.auth import PasswordChange, RegisterRequest, Token, UserUpdate

logger = logging.getLogger(__name__)

GOOGLE_PROVIDER = "google"
_INVALID_CREDENTIALS = "Incorrect email or password"
_INVALID_REFRESH = "Invalid or expired refresh token"
# Expired / revoked refresh-token rows are kept this long before being purged.
STALE_TOKEN_RETENTION = timedelta(days=1)


def _as_aware(value: datetime) -> datetime:
    """Treat naive datetimes (e.g. from SQLite) as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == _normalize_email(email)))


def issue_tokens(db: Session, user: User) -> Token:
    """Create an access/refresh pair and persist the refresh token hash. Does not commit.

    Also purges this user's refresh-token rows that expired, or were revoked, more than
    STALE_TOKEN_RETENTION ago so the table does not grow without bound.
    """
    purge_stale_tokens(db, user.id)
    refresh_token, _jti, expires_at = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    return Token(access_token=create_access_token(user.id), refresh_token=refresh_token)


def purge_stale_tokens(db: Session, user_id: int) -> None:
    """Delete a user's refresh tokens that are expired or revoked and older than a day."""
    cutoff = datetime.now(UTC) - STALE_TOKEN_RETENTION
    db.execute(
        delete(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            or_(
                RefreshToken.expires_at < cutoff,
                and_(RefreshToken.revoked.is_(True), RefreshToken.created_at < cutoff),
            ),
        )
        .execution_options(synchronize_session=False)
    )


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    """Revoke every active refresh token of a user. Does not commit."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )


def register(db: Session, data: RegisterRequest) -> Token:
    email = _normalize_email(data.email)
    if get_user_by_email(db, email) is not None:
        raise ConflictError("An account with this email already exists")
    user = User(
        email=email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("An account with this email already exists") from exc
    token = issue_tokens(db, user)
    db.commit()
    logger.info("Registered user id=%s", user.id)
    return token


def login(db: Session, email: str, password: str) -> Token:
    user = get_user_by_email(db, email)
    if user is None or user.hashed_password is None:
        # OAuth-only users have no password; respond identically to unknown emails,
        # including spending the same bcrypt time so timing does not reveal accounts.
        burn_password_check(password)
        raise UnauthorizedError(_INVALID_CREDENTIALS)
    if not verify_password(password, user.hashed_password):
        raise UnauthorizedError(_INVALID_CREDENTIALS)
    if not user.is_active:
        raise UnauthorizedError("Account is inactive")
    token = issue_tokens(db, user)
    db.commit()
    logger.info("User id=%s logged in", user.id)
    return token


def refresh(db: Session, refresh_token: str) -> Token:
    """Rotate a refresh token. Reuse of a revoked token revokes all of the user's tokens."""
    payload = decode_token(refresh_token, "refresh")
    if payload is None:
        raise UnauthorizedError(_INVALID_REFRESH)
    stored = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(refresh_token))
        .with_for_update()
    )
    if stored is None or str(stored.user_id) != str(payload.get("sub")):
        raise UnauthorizedError(_INVALID_REFRESH)
    if stored.revoked:
        logger.warning(
            "Refresh token reuse detected for user id=%s; revoking all sessions", stored.user_id
        )
        revoke_all_user_tokens(db, stored.user_id)
        db.commit()
        raise UnauthorizedError(_INVALID_REFRESH)
    if _as_aware(stored.expires_at) <= datetime.now(UTC):
        raise UnauthorizedError(_INVALID_REFRESH)
    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError(_INVALID_REFRESH)
    stored.revoked = True
    token = issue_tokens(db, user)
    db.commit()
    return token


def logout(db: Session, refresh_token: str) -> None:
    """Revoke the given refresh token. Idempotent: unknown/revoked tokens are ignored."""
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    if stored is not None and not stored.revoked:
        stored.revoked = True
        db.commit()


def update_profile(db: Session, user: User, data: UserUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, data: PasswordChange) -> None:
    if user.hashed_password is None:
        raise BadRequestError("Password cannot be changed for accounts that sign in with Google")
    if not verify_password(data.current_password, user.hashed_password):
        raise BadRequestError("Current password is incorrect")
    user.hashed_password = hash_password(data.new_password)
    # Invalidate other sessions; existing access tokens expire naturally.
    revoke_all_user_tokens(db, user.id)
    db.commit()
    logger.info("User id=%s changed password", user.id)


def delete_account(db: Session, user: User) -> None:
    """Delete the user. Owned solo projects are deleted; shared owned projects block deletion.

    Assignments/comments the user authored elsewhere are kept with a NULL creator/author.
    """
    other_member = exists().where(
        ProjectMember.project_id == Project.id, ProjectMember.user_id != user.id
    )
    shared_owned = db.scalar(
        select(Project.id).where(Project.owner_id == user.id, other_member).limit(1)
    )
    if shared_owned is not None:
        raise ConflictError("Transfer or delete your shared projects before deleting your account")
    user_id = user.id
    db.delete(user)
    db.commit()
    logger.info("Deleted user id=%s", user_id)


def login_with_google(db: Session, info: GoogleUserInfo) -> Token:
    """Upsert a user from Google userinfo (by google_id, then email) and issue tokens.

    Raises BadRequestError with a short error code as the message on failure.
    """
    if not info.email_verified:
        raise BadRequestError("email_not_verified")
    user = db.scalar(select(User).where(User.google_id == info.google_id))
    linking = False
    if user is None:
        user = get_user_by_email(db, info.email)
        linking = user is not None
    if user is None:
        user = User(email=info.email, hashed_password=None)
        db.add(user)
    if user.id is not None and not user.is_active:
        raise BadRequestError("account_disabled")
    if linking:
        logger.info("Linking Google account to existing user id=%s", user.id)
        if not user.is_verified and user.hashed_password is not None:
            # Whoever set this password never proved they own the email (pre-account
            # takeover). Drop it and end every existing session before Google takes over.
            logger.warning(
                "Clearing unverified password and revoking sessions for user id=%s on Google link",
                user.id,
            )
            user.hashed_password = None
            revoke_all_user_tokens(db, user.id)
    user.google_id = info.google_id
    user.oauth_provider = GOOGLE_PROVIDER
    user.is_verified = True
    if info.avatar_url and not user.avatar_url:
        user.avatar_url = info.avatar_url[:500]
    if info.full_name and not user.full_name:
        user.full_name = info.full_name[:100]
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Google login upsert conflict for %s", info.email)
        raise BadRequestError("account_conflict") from exc
    token = issue_tokens(db, user)
    db.commit()
    logger.info("User id=%s logged in with Google", user.id)
    return token
