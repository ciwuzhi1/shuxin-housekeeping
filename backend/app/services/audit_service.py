"""审计日志服务（v4.5）：高危操作留痕。

约定：
- record() 在有 conn 时随业务事务写入（同事务保证原子性），无 conn 时独立写入
- 动作命名：<对象>_<动作>，如 user_ban / provider_verify / withdrawal_pay
- 只记「谁对什么做了什么」，detail 为人类可读摘要，不记密码/token 等敏感值
"""

import time

from ..database import execute, parse_pagination, row, rows


def _new_id() -> str:
    return f"al{int(time.time() * 1000)}{int(time.time() * 1000) % 10000}"


def record(actor: dict | None, action: str, target_type: str = "", target_id: str = "",
           detail: str = "", conn=None) -> None:
    """写一条审计日志；失败不抛出（审计不应阻断业务，但记录错误日志）。"""
    actor = actor or {}
    try:
        execute(
            "INSERT INTO audit_logs (id, actor_id, actor_name, action, target_type, target_id, detail) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            [
                _new_id(),
                actor.get("userId") or actor.get("id") or "system",
                actor.get("username") or actor.get("name") or "system",
                action,
                target_type,
                target_id,
                detail,
            ],
            conn=conn,
        )
    except Exception:
        # 延迟导入避免循环依赖
        import logging
        logging.getLogger(__name__).exception("AUDIT_WRITE_FAILED action=%s target=%s", action, target_id)


def list_logs(page=None, size=None, action: str | None = None, actor_id: str | None = None) -> dict:
    """审计日志查询（admin），按时间倒序分页。"""
    pag = parse_pagination(page, size)
    conditions: list[str] = []
    params: list = []
    if action:
        conditions.append("action = %s")
        params.append(action)
    if actor_id:
        conditions.append("actor_id = %s")
        params.append(actor_id)
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    data = rows(
        f"SELECT id, actor_id, actor_name, action, target_type, target_id, detail, created_at "
        f"FROM audit_logs{where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        params + [pag["limit"], pag["offset"]],
    )
    total = (row(f"SELECT COUNT(*) AS c FROM audit_logs{where}", params) or {}).get("c", 0)
    return {
        "success": True,
        "data": data,
        "pagination": {"page": pag["page"], "size": pag["size"], "total": total,
                       "totalPages": (total + pag["size"] - 1) // pag["size"]},
    }


def user_is_banned(user_id: str) -> bool:
    r = row("SELECT banned FROM users WHERE id = %s", [user_id])
    return bool(r and r.get("banned"))
