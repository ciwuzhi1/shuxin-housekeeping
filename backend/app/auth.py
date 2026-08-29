"""JWT 认证 + 密码校验。

对应 Node 版 auth.ts。
- 密码方案（V4.0 升级）：Argon2id 哈希（argon2-cffi）；
  存量用户的旧格式（固定盐 + SHA-256 十六进制）在校验时仍兼容，
  并在登录成功后由路由层自动升级为 Argon2id（见 routers/auth.py）
- 提供 require_auth / require_role 依赖，替代 Express 中间件
"""

import hashlib
import logging
import time

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .errors import ForbiddenError, UnauthorizedError

_bearer = HTTPBearer(auto_error=False)

# 模块级单例：argon2-cffi 默认参数即 Argon2id
_hasher = PasswordHasher()

_ARGON2_PREFIX = "$argon2"

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Argon2id 哈希（每次生成随机盐，编码串含全部校验参数）。"""
    return _hasher.hash(password)


def is_legacy_hash(hashed: str | None) -> bool:
    """判断是否旧格式哈希（固定盐 + SHA-256 的 64 位十六进制，非 $argon2 前缀）。"""
    return not (hashed or "").startswith(_ARGON2_PREFIX)


def verify_password(password: str, hashed: str) -> bool:
    """按前缀分流校验：$argon2 开头走 Argon2id，否则走旧版固定盐 SHA-256。"""
    if not hashed:
        return False
    if hashed.startswith(_ARGON2_PREFIX):
        try:
            return _hasher.verify(hashed, password)
        except (VerifyMismatchError, InvalidHashError):
            return False
    # 旧格式兼容：sha256(PASSWORD_SALT + password).hexdigest()
    return hashlib.sha256((settings.PASSWORD_SALT + password).encode("utf-8")).hexdigest() == hashed


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
