"""Thin OpenAI wrapper: one structured-output call, mapped to app errors.

Kept small and module-level so tests can monkeypatch `generate`.
"""

import logging
from typing import TypeVar

from openai import OpenAI, OpenAIError
from pydantic import BaseModel

from app.config import settings
from app.exceptions import AppException

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class AIDisabledError(AppException):
    def __init__(self) -> None:
        super().__init__("AI features are not configured on this server", "AI_DISABLED", 503)


class AIUnavailableError(AppException):
    def __init__(self, message: str = "The AI service is unavailable. Please try again.") -> None:
        super().__init__(message, "AI_UNAVAILABLE", 502)


def is_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY.strip())


def generate(system_prompt: str, user_prompt: str, schema: type[T]) -> T:
    """Ask the model for a response matching `schema` (OpenAI structured outputs)."""
    if not is_enabled():
        raise AIDisabledError()
    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
        max_retries=1,
    )
    try:
        completion = client.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=schema,
        )
    except OpenAIError as exc:
        logger.error("OpenAI request failed (%s): %s", type(exc).__name__, exc)
        raise AIUnavailableError() from exc

    message = completion.choices[0].message
    if message.refusal:
        logger.warning("OpenAI refused the request: %s", message.refusal)
        raise AIUnavailableError("The AI declined this request. Try rephrasing it.")
    if message.parsed is None:
        logger.error("OpenAI returned no parsable content")
        raise AIUnavailableError()
    return message.parsed
