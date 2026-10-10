"""Auth routes: email/password, token rotation, profile and Google OAuth."""

import logging
import re
import secrets
from typing import Annotated
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.auth import google
from app.config import settings
from app.dependencies import CurrentUser, DbSession
from app.exceptions import AppException, BadRequestError
from app.rate_limit import (
    LOGIN_LIMIT,
    PASSWORD_CHANGE_LIMIT,
    REFRESH_LIMIT,
    REGISTER_LIMIT,
    limiter,
)
from app.schemas.auth import (
    LogoutRequest,
    PasswordChange,
    RefreshRequest,
    RegisterRequest,
    Token,
    UserUpdate,
)
from app.schemas.user import UserResponse
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

OAUTH_STATE_COOKIE = "oauth_state"
OAUTH_NONCE_COOKIE = "oauth_nonce"
OAUTH_STATE_MAX_AGE_SECONDS = 600
# Client-generated nonce binding the OAuth round trip to the browser tab that started it.
NONCE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{16,128}$")


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit(REGISTER_LIMIT)
def register(request: Request, data: RegisterRequest, db: DbSession) -> Token:
    return auth_service.register(db, data)


@router.post("/login", response_model=Token)
@limiter.limit(LOGIN_LIMIT)
def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> Token:
    return auth_service.login(db, form.username, form.password)


@router.post("/refresh", response_model=Token)
@limiter.limit(REFRESH_LIMIT)
def refresh(request: Request, data: RefreshRequest, db: DbSession) -> Token:
    return auth_service.refresh(db, data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def logout(data: LogoutRequest, db: DbSession) -> Response:
    auth_service.logout(db, data.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
def update_me(data: UserUpdate, current_user: CurrentUser, db: DbSession) -> UserResponse:
    user = auth_service.update_profile(db, current_user, data)
    return UserResponse.model_validate(user)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
@limiter.limit(PASSWORD_CHANGE_LIMIT)
def change_password(
    request: Request, data: PasswordChange, current_user: CurrentUser, db: DbSession
) -> Response:
    auth_service.change_password(db, current_user, data)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_me(current_user: CurrentUser, db: DbSession) -> Response:
    auth_service.delete_account(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _cookie_secure() -> bool:
    return urlparse(settings.GOOGLE_REDIRECT_URI).scheme == "https"


def _valid_nonce(nonce: str | None) -> bool:
    return nonce is not None and NONCE_PATTERN.fullmatch(nonce) is not None


def _frontend_redirect(fragment: dict[str, str], nonce: str | None = None) -> RedirectResponse:
    """Redirect to the SPA callback with `fragment` (+ `nonce` when known); clear OAuth cookies."""
    if nonce is not None:
        fragment = {**fragment, "nonce": nonce}
    url = f"{settings.FRONTEND_URL.rstrip('/')}/auth/callback#{urlencode(fragment)}"
    response = RedirectResponse(url=url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    for cookie in (OAUTH_STATE_COOKIE, OAUTH_NONCE_COOKIE):
        response.delete_cookie(
            cookie, path="/", secure=_cookie_secure(), httponly=True, samesite="lax"
        )
    return response


def _set_oauth_cookie(response: Response, name: str, value: str) -> None:
    response.set_cookie(
        name,
        value,
        max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        path="/",
        secure=_cookie_secure(),
        httponly=True,
        samesite="lax",
    )


@router.get("/google", response_class=RedirectResponse, response_model=None)
def google_login(
    nonce: Annotated[str | None, Query()] = None,
) -> RedirectResponse:
    if not google.is_configured():
        raise AppException("Google sign-in is not configured", "SERVICE_UNAVAILABLE", 503)
    if nonce is None or not _valid_nonce(nonce):
        return _frontend_redirect({"error": "invalid_request"})
    state = google.generate_state()
    response = RedirectResponse(
        url=google.build_authorization_url(state),
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
    )
    _set_oauth_cookie(response, OAUTH_STATE_COOKIE, state)
    _set_oauth_cookie(response, OAUTH_NONCE_COOKIE, nonce)
    return response


@router.get("/google/callback", response_class=RedirectResponse, response_model=None)
async def google_callback(
    request: Request,
    db: DbSession,
    code: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    error: Annotated[str | None, Query()] = None,
) -> RedirectResponse:
    cookie_nonce = request.cookies.get(OAUTH_NONCE_COOKIE)
    nonce = cookie_nonce if _valid_nonce(cookie_nonce) else None
    if not google.is_configured():
        return _frontend_redirect({"error": "oauth_not_configured"}, nonce)
    if error:
        logger.info("Google OAuth returned error: %s", error)
        return _frontend_redirect({"error": "access_denied"}, nonce)
    cookie_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not state or not cookie_state or not secrets.compare_digest(state, cookie_state):
        logger.warning("Google OAuth state mismatch")
        return _frontend_redirect({"error": "invalid_state"}, nonce)
    if nonce is None:
        logger.warning("Google OAuth callback without a valid nonce cookie")
        return _frontend_redirect({"error": "invalid_state"})
    if not code:
        return _frontend_redirect({"error": "missing_code"}, nonce)
    try:
        google_access_token = await google.exchange_code_for_token(code)
        info = await google.fetch_user_info(google_access_token)
        # Blocking DB work runs off the event loop.
        token = await run_in_threadpool(auth_service.login_with_google, db, info)
    except google.GoogleOAuthError as exc:
        return _frontend_redirect({"error": str(exc)}, nonce)
    except BadRequestError as exc:
        return _frontend_redirect({"error": exc.message}, nonce)
    return _frontend_redirect(
        {"access_token": token.access_token, "refresh_token": token.refresh_token}, nonce
    )
