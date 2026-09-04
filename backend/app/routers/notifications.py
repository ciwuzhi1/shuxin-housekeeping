"""通知路由：列表 / 标记已读 / 全部已读 / 管理员发送。

修复 P0-2/P2-2：列表与已读操作均校验归属；read-all 必须指定本人 userId。
注意：`read` 是 MySQL 保留字，SQL 中需用反引号。
"""

import time

from fastapi import APIRouter, Depends, Query

from ..auth import require_auth, require_role
from ..database import execute, row, rows
from ..errors import BadRequestError, ForbiddenError, NotFoundError
from ..schemas import NotifSendIn
from ..services import audit_service

router = APIRouter()


@router.post("")
def send_notification(data: NotifSendIn, user=Depends(require_role("admin"))):
    """管理员向指定用户发送通知（真实落库）。"""
    target = row("SELECT id FROM users WHERE id = %s", [data.user_id])
    if not target:
        raise NotFoundError("目标用户不存在")
    nid = f"n{int(time.time() * 1000)}{data.user_id}"
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,%s,0)",
        [nid, data.user_id, data.title, data.content, data.type or "system"],
    )
    audit_service.record(user, "notification_send", "user", data.user_id, f"发送通知「{data.title}」")
    return {"success": True, "data": {"id": nid}, "message": "通知已发送"}


@router.get("")
def list_notifications(
    _user=Depends(require_auth),
    userId: str = Query(None),
    unreadOnly: str = Query(None),
):
    # 归属校验：传了 userId 必须是自己（admin 除外）
    if userId and userId != _user["userId"] and _user["role"] != "admin":
        raise ForbiddenError("只能查看自己的通知", "NOTIF_FORBIDDEN")
    uid = userId if (_user["role"] == "admin" and userId) else _user["userId"]

    conditions = ["user_id = %s"]
    params: list = [uid]
    if unreadOnly == "true":
        conditions.append("`read` = 0")
    sql = "SELECT id, user_id, title, content, type, `read`, created_at FROM notifications WHERE " + " AND ".join(conditions)
    sql += " ORDER BY created_at DESC LIMIT 50"
    return {"success": True, "data": rows(sql, params)}


@router.put("/read-all")
def read_all(user=Depends(require_auth), userId: str = Query(None)):
    uid = userId if user["role"] == "admin" else user["userId"]
    if not uid:
        raise BadRequestError("缺少 userId", "MISSING_USER_ID")
    execute("UPDATE notifications SET `read` = 1 WHERE user_id = %s", [uid])
    return {"success": True, "message": "全部已标记已读"}


@router.put("/{notif_id}/read")
def mark_read(notif_id: str, user=Depends(require_auth)):
    n = row("SELECT id, user_id FROM notifications WHERE id = %s", [notif_id])
    if not n:
        raise NotFoundError("通知不存在")
    if n["userId"] != user["userId"] and user["role"] != "admin":
        raise ForbiddenError("只能操作自己的通知", "NOTIF_FORBIDDEN")
    execute("UPDATE notifications SET `read` = 1 WHERE id = %s", [notif_id])
    return {"success": True, "message": "已标记已读"}
