"""后台管理路由：统计 / 用户列表 / 平台设置 / 账号封禁 / 审计日志。

修复 P1-3：orderTrend / userGrowth / averageRating 由静态数据改为真实聚合。
v4.5：封禁/解封（封禁即时生效并通知本人）+ 高危操作审计留痕与查询。
"""

import time

from fastapi import APIRouter, Depends, Query

from ..auth import require_role
from ..database import execute, parse_pagination, row, rows
from ..errors import BadRequestError, ForbiddenError, NotFoundError
from ..schemas import SupportReplyIn
from ..services import audit_service

router = APIRouter()


@router.get("/stats")
def stats(_user=Depends(require_role("admin"))):
    # V4.4a 聚合下推：原先全表拉订单/用户到 Python 统计，改为条件聚合单行返回
    # （别名用 camelCase：database.row 返回前会做 to_camel 转换）
    order_agg = row(
        "SELECT COUNT(*) AS `totalOrders`, "
        "COALESCE(SUM(status = 'completed'), 0) AS `completedOrders`, "
        "COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS `totalRevenue` "
        "FROM orders"
    )
    total_orders = int(order_agg["totalOrders"])
    total_revenue = float(order_agg["totalRevenue"])

    month_start = time.strftime("%Y-%m-01")
    today_str = time.strftime("%Y-%m-%d")
    user_agg = row(
        "SELECT COALESCE(SUM(role = 'client'), 0) AS `totalUsers`, "
        "COALESCE(SUM(role = 'provider'), 0) AS `totalProviders`, "
        "COALESCE(SUM(role = 'provider' AND certification_status = 'pending'), 0) AS `pendingCerts`, "
        "COALESCE(SUM(created_at >= %s), 0) AS `newUsersToday` "
        "FROM users",
        [today_str + " 00:00:00"],
    )
    total_users = int(user_agg["totalUsers"])

    mau_row = row("SELECT COUNT(DISTINCT client_id) AS c FROM orders WHERE created_at >= %s", [month_start])
    monthly_active_users = int((mau_row or {}).get("c", 0)) or max(1, int(total_users * 0.3))

    # 修复：orders.status 无 'refunding' 取值，退款待处理应按支付状态统计
    refund_count = row("SELECT COUNT(*) AS c FROM orders WHERE payment_status = 'refunding'")
    pending_refunds = (refund_count or {}).get("c", 0)

    # 服务分布（一次 GROUP BY 聚合，替代按分类 Python 循环计数）
    dist_map = {
        r["category"]: r["count"]
        for r in rows(
            "SELECT service_category AS category, COUNT(*) AS count FROM orders GROUP BY service_category"
        )
    }
    service_distribution = []
    for c in rows("SELECT name FROM service_categories"):
        count = dist_map.get(c["name"], 0)
        service_distribution.append({
            "name": c["name"],
            "count": count,
            "percentage": round(count / total_orders * 100, 1) if total_orders else 0,
        })

    # 真实趋势（按月聚合）
    order_trend = rows(
        "SELECT DATE_FORMAT(created_at, '%Y-%m') AS date, COUNT(*) AS count, SUM(total_amount) AS revenue "
        "FROM orders GROUP BY date ORDER BY date"
    )
    user_growth = rows(
        "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(role = 'client') AS users, SUM(role = 'provider') AS providers "
        "FROM users GROUP BY month ORDER BY month"
    )
    avg_rating = row("SELECT AVG(rating) AS avg FROM reviews WHERE rating > 0")

    return {
        "success": True,
        "data": {
            "totalUsers": total_users,
            "totalProviders": int(user_agg["totalProviders"]),
            "totalOrders": total_orders,
            "totalRevenue": total_revenue,
            "monthlyActiveUsers": monthly_active_users,
            "averageRating": round(float((avg_rating or {}).get("avg") or 0), 1),
            "newUsersToday": int(user_agg["newUsersToday"]),
            "pendingCertifications": int(user_agg["pendingCerts"]),
            "pendingRefunds": pending_refunds,
            "orderTrend": [{"date": m["date"], "count": m["count"], "revenue": float(m["revenue"] or 0)} for m in order_trend],
            "userGrowth": [{"month": m["month"], "users": m["users"], "providers": m["providers"]} for m in user_growth],
            "serviceDistribution": service_distribution,
        },
    }


@router.get("/users")
def list_users(
    _user=Depends(require_role("admin")),
    search: str = Query(None),
    role: str = Query(None),
):
    sql = "SELECT id, username, name, phone, avatar, role, address, total_orders, total_spent, created_at FROM users WHERE 1=1"
    params: list = []
    if role:
        sql += " AND role = %s"
        params.append(role)
    if search:
        sql += " AND (name LIKE %s OR phone LIKE %s OR username LIKE %s)"
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
    sql += " ORDER BY created_at DESC"
    return {"success": True, "data": rows(sql, params)}


@router.get("/settings")
def get_settings(_user=Depends(require_role("admin"))):
    """平台设置（key-value），系统设置页真实读写。"""
    kv = rows("SELECT `key`, value FROM settings")
    return {"success": True, "data": {k["key"]: k["value"] for k in kv}}


@router.put("/settings")
def save_settings(data: dict, _user=Depends(require_role("admin"))):
    """全量保存平台设置；key 必须已存在（防止写入任意键）。"""
    if not isinstance(data, dict) or not data:
        raise BadRequestError("设置内容不能为空")
    existing = {k["key"] for k in rows("SELECT `key` FROM settings")}
    unknown = [k for k in data if k not in existing]
    if unknown:
        raise BadRequestError(f"不支持的设置项: {', '.join(unknown)}")
    for k, v in data.items():
        execute("UPDATE settings SET value = %s WHERE `key` = %s", [str(v).lower() if isinstance(v, bool) else str(v), k])
    kv = rows("SELECT `key`, value FROM settings")
    audit_service.record(_user, "settings_save", "settings", ",".join(data.keys()), f"保存 {len(data)} 项设置")
    return {"success": True, "data": {k["key"]: k["value"] for k in kv}, "message": "设置已保存"}


# ======================== 账号封禁（v4.5） ========================


def _notify(user_id: str, title: str, content: str) -> None:
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'system',0)",
        [f"n{int(time.time() * 1000)}{user_id}", user_id, title, content],
    )


def _get_target_user(user_id: str) -> dict:
    u = row("SELECT id, username, name, role, banned, status FROM users WHERE id = %s", [user_id])
    if not u:
        raise NotFoundError("用户不存在")
    return u


@router.put("/users/{user_id}/ban")
def ban_user(user_id: str, _user=Depends(require_role("admin"))):
    """封禁账号：无法登录、存量 token 立即失效；家政员同时强制下线。admin 账号不可封禁。"""
    target = _get_target_user(user_id)
    if target["role"] == "admin":
        raise ForbiddenError("不能封禁管理员账号", "ADMIN_BAN_FORBIDDEN")
    if target.get("banned"):
        raise BadRequestError("该账号已被封禁", "ALREADY_BANNED")

    execute("UPDATE users SET banned = 1 WHERE id = %s", [user_id])
    if target["role"] == "provider" and target["status"] == "online":
        execute("UPDATE users SET status = 'offline' WHERE id = %s", [user_id])
    _notify(user_id, "账号已被封禁", f"{target['name']}您好，您的账号已被管理员封禁，如有疑问请联系平台客服")
    audit_service.record(_user, "user_ban", "user", user_id, f"封禁账号 {target['username']}({target['name']})")
    return {"success": True, "message": "账号已封禁"}


@router.put("/users/{user_id}/unban")
def unban_user(user_id: str, _user=Depends(require_role("admin"))):
    """解封账号：恢复登录能力（家政员需自行重新上线）。"""
    target = _get_target_user(user_id)
    if not target.get("banned"):
        raise BadRequestError("该账号未被封禁", "NOT_BANNED")

    execute("UPDATE users SET banned = 0 WHERE id = %s", [user_id])
    _notify(user_id, "账号已解封", f"{target['name']}您好，您的账号已解除封禁，欢迎继续使用平台服务")
    audit_service.record(_user, "user_unban", "user", user_id, f"解封账号 {target['username']}({target['name']})")
    return {"success": True, "message": "账号已解封"}


@router.get("/audit-logs")
def list_audit_logs(
    _user=Depends(require_role("admin")),
    page: int = Query(1),
    size: int = Query(None),
    action: str = Query(None),
    actorId: str = Query(None),
):
    """审计日志查询（admin）：高危操作留痕，按时间倒序分页。"""
    return audit_service.list_logs(page, size, action, actorId)


# ======================== 客服工单（v4.6） ========================


@router.get("/support-tickets")
def list_support_tickets(
    _user=Depends(require_role("admin")),
    status: str = Query(None),
    page: int = Query(1),
    size: int = Query(None),
):
    """客服工单列表（admin）：按状态筛选，时间倒序分页，联用户姓名。"""
    pag = parse_pagination(page, size)
    conditions: list[str] = []
    params: list = []
    if status:
        conditions.append("t.status = %s")
        params.append(status)
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    data = rows(
        "SELECT t.id, t.user_id, u.name AS user_name, u.phone AS user_phone, t.order_no, t.category, "
        "t.content, t.contact_phone, t.status, t.reply, t.replied_by, t.replied_at, t.created_at "
        f"FROM support_tickets t JOIN users u ON t.user_id = u.id{where} "
        "ORDER BY t.created_at DESC LIMIT %s OFFSET %s",
        params + [pag["limit"], pag["offset"]],
    )
    total = (row(f"SELECT COUNT(*) AS c FROM support_tickets t{where}", params) or {}).get("c", 0)
    return {
        "success": True,
        "data": data,
        "pagination": {"page": pag["page"], "size": pag["size"], "total": total,
                       "totalPages": (total + pag["size"] - 1) // pag["size"]},
    }


@router.put("/support-tickets/{ticket_id}/reply")
def reply_support_ticket(ticket_id: str, data: SupportReplyIn, user=Depends(require_role("admin"))):
    """回复工单：状态置 replied，站内通知用户，审计留痕。"""
    t = row("SELECT id, user_id, status FROM support_tickets WHERE id = %s", [ticket_id])
    if not t:
        raise NotFoundError("工单不存在")
    if t["status"] == "closed":
        raise BadRequestError("该工单已关闭")
    execute(
        "UPDATE support_tickets SET status = 'replied', reply = %s, replied_by = %s, replied_at = NOW() WHERE id = %s",
        [data.reply, user["userId"], ticket_id],
    )
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'system',0)",
        [f"n{int(time.time() * 1000)}{t['user_id']}", t["user_id"], "客服工单已回复", "您的客服工单已收到回复，请前往「联系客服」查看"],
    )
    audit_service.record(user, "support_reply", "support_ticket", ticket_id, f"回复客服工单：{data.reply[:50]}")
    return {"success": True, "message": "回复已发送"}
