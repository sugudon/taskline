"""User schemas shared across modules."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None = None
    avatar_url: str | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None = None
    avatar_url: str | None = None
    is_active: bool
    is_verified: bool
    oauth_provider: str | None = None
    has_password: bool
    created_at: datetime
