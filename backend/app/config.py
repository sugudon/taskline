"""Application settings loaded from environment variables / .env."""

from functools import cached_property

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SECRET_KEY_MIN_LENGTH = 32
# Placeholder values from docs/examples that must never be used as a real signing key.
INSECURE_SECRET_KEYS = frozenset(
    {"change-me-to-a-long-random-string", "your-secret-key", "secret", "changeme"}
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Taskline"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = "http://localhost:5173"
    LOG_LEVEL: str = "INFO"
    RATE_LIMIT_ENABLED: bool = True
    # AI features (OpenAI). Disabled when OPENAI_API_KEY is empty.
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.4-mini"
    OPENAI_TIMEOUT_SECONDS: float = 60.0
    AI_DAILY_LIMIT: int = 30

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, value: str) -> str:
        if value.strip().lower() in INSECURE_SECRET_KEYS:
            raise ValueError("SECRET_KEY is a known placeholder; generate a random secret")
        if len(value) < SECRET_KEY_MIN_LENGTH:
            raise ValueError(f"SECRET_KEY must be at least {SECRET_KEY_MIN_LENGTH} characters")
        return value

    @cached_property
    def cors_origins_list(self) -> list[str]:
        """CORS_ORIGINS as a list (comma-separated in the environment)."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()  # type: ignore[call-arg]  # values come from env / .env
