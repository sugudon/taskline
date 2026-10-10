"""Application exceptions. Rendered as {"detail": message, "code": code}."""


class AppException(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class NotFoundError(AppException):
    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found", "NOT_FOUND", 404)


class ConflictError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, "CONFLICT", 409)


class ForbiddenError(AppException):
    def __init__(self, message: str = "You do not have permission to perform this action") -> None:
        super().__init__(message, "FORBIDDEN", 403)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Could not validate credentials") -> None:
        super().__init__(message, "UNAUTHORIZED", 401)


class BadRequestError(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(message, "BAD_REQUEST", 400)
