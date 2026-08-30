"""认证路由：登录 / 注册。

- 登录携带密码并校验（Argon2id，兼容旧版固定盐 SHA-256，见 app/auth.py）
- 旧格式哈希用户登录成功后自动升级为 Argon2id（升级失败不阻断登录）
"""

import logging
import time

from fastapi import APIRouter, Depends

from ..auth import hash_password, is_legacy_hash, require_auth, sign_token, verify_password
from ..database import execute, row
from ..errors import BadRequestError, ConflictError, UnauthorizedError
from ..schemas import LoginIn, PasswordChangeIn, RegisterIn

logger = logging.getLogger(__name__)

router = APIRouter()

# 按角色返回不同字段（与 Node 版一致）
USER_FIELDS = {
    "client": "id, username, name, phone, avatar, role, address, total_orders, total_spent, created_at",
    "provider": "id, username, name, phone, avatar, role, age, gender, experience, certification_status, status, rating, completed_orders, balance, service_area, introduction, skills, created_at",
    "admin": "id, username, name, phone, avatar, role, department, created_at",
}

_ID_PREFIX = {"client": "c", "provider": "p", "admin": "a"}


@router.post("/login")
def login(data: LoginIn):
    user = row(f"SELECT {USER_FIELDS[data.role]} FROM users WHERE username = %s AND role = %s", [data.username, data.role])
    if not user:
        raise UnauthorizedError("用户名或角色不正确", "INVALID_CREDENTIALS")

    stored = row("SELECT password FROM users WHERE username = %s AND role = %s", [data.username, data.role])
    hashed = (stored or {}).get("password")
    if not hashed or not verify_password(data.password, hashed):
        raise UnauthorizedError("密码错误", "INVALID_PASSWORD")

    # 旧格式哈希（SHA-256+固定盐）登录成功后自动升级为 Argon2id；失败不阻断登录
    if is_legacy_hash(hashed):
        try:
            execute("UPDATE users SET password = %s WHERE id = %s", [hash_password(data.password), user["id"]])
        except Exception:
            logger.exception("LEGACY_HASH_UPGRADE_FAILED user_id=%s", user["id"])

    token = sign_token({"userId": user["id"], "username": user["username"], "role": data.role})
    return {"success": True, "data": {**user, "token": token}, "message": "登录成功"}


@router.get("/me")
def me(user: dict = Depends(require_auth)):
    """根据 token 返回当前登录用户（供前端刷新页面后恢复会话）。"""
    fields = USER_FIELDS.get(user.get("role"), USER_FIELDS["client"])
    me_user = row(f"SELECT {fields} FROM users WHERE id = %s", [user.get("userId")])
    if not me_user:
        raise UnauthorizedError("登录状态已失效，请重新登录", "USER_NOT_FOUND")
    return {"success": True, "data": me_user, "message": "ok"}


@router.put("/password")
def change_password(data: PasswordChangeIn, user: dict = Depends(require_auth)):
    """修改本人密码：校验旧密码，Argon2id 重算落库。"""
    uid = user.get("userId")
    stored = row("SELECT password FROM users WHERE id = %s", [uid])
    hashed = (stored or {}).get("password")
    if not hashed or not verify_password(data.old_password, hashed):
        raise BadRequestError("原密码错误", "WRONG_OLD_PASSWORD")
    if data.old_password == data.new_password:
        raise BadRequestError("新密码不能与原密码相同")
    execute("UPDATE users SET password = %s WHERE id = %s", [hash_password(data.new_password), uid])
    return {"success": True, "message": "密码已修改"}


@router.post("/register")
def register(data: RegisterIn):
    # 安全修复：管理员账号禁止公开注册（即使绕过 Pydantic 校验也在此兜底）
    if data.role == "admin":
        raise BadRequestError("管理员账号不允许公开注册", "ADMIN_REGISTER_FORBIDDEN")

    existing = row("SELECT id FROM users WHERE username = %s", [data.username])
    if existing:
        raise ConflictError("用户名已存在", "USERNAME_EXISTS")

    uid = f"{_ID_PREFIX[data.role]}{int(time.time() * 1000)}"
    hashed = hash_password(data.password)

    if data.role == "client":
        execute(
            "INSERT INTO users (id, username, name, phone, avatar, role, password, address, total_orders, total_spent, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,0,0,NOW())",
            [uid, data.username, data.name, data.phone, "", data.role, hashed, ""],
        )
    elif data.role == "provider":
        execute(
            "INSERT INTO users (id, username, name, phone, avatar, role, password, age, gender, experience, certification_status, status, rating, completed_orders, balance, service_area, introduction, skills, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,0,'female',0,'pending','offline',5.0,0,0,'[]','','[]',NOW())",
            [uid, data.username, data.name, data.phone, "", data.role, hashed],
        )
    else:
        execute(
            "INSERT INTO users (id, username, name, phone, avatar, role, password, department, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,'运营部',NOW())",
            [uid, data.username, data.name, data.phone, "", data.role, hashed],
        )

    return {"success": True, "data": {"id": uid, "username": data.username}, "message": "注册成功"}
