"""舒心家政 · FastAPI 服务入口（端口 3001）。

启动: uvicorn backend.app.main:app --port 3001
"""

import logging
import os
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import init_db, row
from .errors import register_exception_handlers
from .routers import admin, auth, categories, client, finance, notifications, orders, provider, providers, reviews
from .seed import ensure_seed

_start = time.time()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    ensure_seed()
    yield


app = FastAPI(title="舒心家政 API", version="4.3.0", docs_url=None, redoc_url=None, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGIN.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# 简单内存限流（固定窗口 60s，按客户端 IP）；测试环境通过 RATE_LIMIT_MAX>=100000 关闭
_requests: dict[str, list[float]] = defaultdict(list)
_WINDOW = 60


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if settings.RATE_LIMIT_MAX < 100000:
        client = request.client.host if request.client else "unknown"
        now = time.time()
        _requests[client] = [t for t in _requests[client] if now - t < _WINDOW]
        if len(_requests[client]) >= settings.RATE_LIMIT_MAX:
            return JSONResponse(
                status_code=429,
                content={"success": False, "code": "TOO_MANY_REQUESTS", "message": "请求过于频繁，请稍后再试"},
            )
        _requests[client].append(now)
    return await call_next(request)


# 安全响应头（V4.0 第 10 节）：包住包括 429 在内的所有响应
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# 轻量访问日志（V4.0 第 20 节）：request_id/method/path/status/latency；
# 只记录 path，不记录 querystring、token 与任何请求体，避免敏感信息进日志。
# 自建 logger（不挂在 uvicorn.access 上，避免其 AccessFormatter 按位置拆参数拼错行）。
_access_logger = logging.getLogger("shuxin.access")
if not _access_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("[req] %(message)s"))
    _access_logger.addHandler(_handler)
_access_logger.setLevel(logging.INFO)
_access_logger.propagate = False


@app.middleware("http")
async def access_log(request: Request, call_next):
    request_id = uuid.uuid4().hex[:8]
    start = time.perf_counter()
    try:
        response = await call_next(request)
        status = response.status_code
    except Exception:
        _access_logger.info("%s %s %s 500 %.1fms", request_id, request.method, request.url.path, (time.perf_counter() - start) * 1000)
        raise
    _access_logger.info("%s %s %s %s %.1fms", request_id, request.method, request.url.path, status, (time.perf_counter() - start) * 1000)
    return response


@app.get("/api/health")
def health():
    counts = {}
    for t in ["users", "orders", "service_categories", "service_subcategories", "reviews", "transactions", "notifications"]:
        r = row(f"SELECT COUNT(*) AS c FROM {t}")
        counts[t] = (r or {}).get("c", 0)
    return {
        "success": True,
        "message": "舒心家政 API 服务运行正常",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": "4.3.0",
        "environment": "development",
        "database": {"type": "MySQL", "host": settings.DB_HOST},
        "stats": counts,
        "uptime": int(time.time() - _start),
    }


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(client.router, prefix="/api/client", tags=["client"])
app.include_router(provider.router, prefix="/api/provider", tags=["provider"])

# 资质材料上传目录（certification_files.file_path 指向此处）
_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOAD_DIR), name="uploads")
