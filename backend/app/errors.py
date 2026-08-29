"""统一错误体系 + FastAPI 异常处理器（对应 Node 版 errors.ts）。"""

import logging
import re

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """业务异常基类。"""

    def __init__(self, message: str, status_code: int = 500, code: str = "INTERNAL_ERROR"):
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class BadRequestError(AppError):
    def __init__(self, message: str = "请求参数错误", code: str = "BAD_REQUEST"):
        super().__init__(message, 400, code)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "未授权", code: str = "UNAUTHORIZED"):
        super().__init__(message, 401, code)


class ForbiddenError(AppError):
    def __init__(self, message: str = "无权限", code: str = "FORBIDDEN"):
        super().__init__(message, 403, code)


class NotFoundError(AppError):
    def __init__(self, message: str = "资源不存在", code: str = "NOT_FOUND"):
        super().__init__(message, 404, code)


class ConflictError(AppError):
    def __init__(self, message: str = "资源冲突", code: str = "CONFLICT"):
        super().__init__(message, 409, code)


class ValidationError(AppError):
    def __init__(self, errors: list | None = None, message: str = "数据验证失败"):
        super().__init__(message, 422, "VALIDATION_ERROR")
        self.errors = errors or []


def _camel_key(k: str) -> str:
    return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), k)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_req: Request, exc: AppError):
        body: dict = {"success": False, "code": exc.code, "message": exc.message}
        if isinstance(exc, ValidationError) and exc.errors:
            body["errors"] = exc.errors
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_req: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            loc = [str(p) for p in e.get("loc", [])[1:]]  # 去掉 'body'/'query'
            errors.append({"path": ".".join(loc), "message": e.get("msg", "")})
        return JSONResponse(
            status_code=422,
            content={"success": False, "code": "VALIDATION_ERROR", "message": "数据验证失败", "errors": errors},
        )

    @app.exception_handler(Exception)
    async def _generic_handler(_req: Request, exc: Exception):
        logging.getLogger("uvicorn.error").exception("UNHANDLED_EXCEPTION", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "code": "INTERNAL_ERROR", "message": "服务器内部错误"},
        )
