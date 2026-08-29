"""JWT 认证 + 密码校验。

对应 Node 版 auth.ts。
- 密码方案（简单档）：固定盐 + SHA-256，登录时哈希比对（见 docs/现状/数据库接入分析.md 方案 B）
- 提供 require_auth / require_role 依赖，替代 Express 中间件
"""

import hashlib
import time

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .errors import ForbiddenError, UnauthorizedError

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """SHA-256(password)，加固定盐。"""
    return hashlib.sha256((settings.PASSWORD_SALT + password).encode("utf-8")).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def sign_token(payload: dict) -> str:
    data = dict(payload)
    data["exp"] = int(time.time()) + settings.JWT_EXPIRES
    return jwt.encode(data, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise UnauthorizedError("Token 无效或已过期", "INVALID_TOKEN")


def require_auth(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    """必需登录：无 token 或 token 无效则 401。"""
    if credentials is None:
        raise UnauthorizedError("请先登录", "NO_TOKEN")
    return decode_token(credentials.credentials)


def require_role(*roles: str):
    """在已登录基础上校验角色，无权则 403。"""

    def dep(user: dict = Depends(require_auth)) -> dict:
        if user.get("role") not in roles:
            raise ForbiddenError(f"需要 {'/'.join(roles)} 角色", "ROLE_FORBIDDEN")
        return user

    return dep
