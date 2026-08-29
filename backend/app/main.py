"""舒心家政 · FastAPI 服务入口（端口 3001）。

启动: uvicorn backend.app.main:app --port 3001
"""

import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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


app = FastAPI(title="舒心家政 API", version="2.1.0", docs_url=None, redoc_url=None, lifespan=lifespan)

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
        "version": "2.1.0",
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
