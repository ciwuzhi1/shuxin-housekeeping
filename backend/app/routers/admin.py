"""后台管理路由：统计 / 用户列表 / 平台设置。

修复 P1-3：orderTrend / userGrowth / averageRating 由静态数据改为真实聚合。
"""

import time

from fastapi import APIRouter, Depends, Query

from ..auth import require_role
from ..database import execute, row, rows
from ..errors import BadRequestError

router = APIRouter()


@router.get("/stats")
def stats(_user=Depends(require_role("admin"))):
    all_orders = rows("SELECT status, total_amount, service_category, client_id, created_at FROM orders")
    total_orders = len(all_orders)
    completed = [o for o in all_orders if o["status"] == "completed"]
    total_revenue = sum(float(o["totalAmount"] or 0) for o in completed)

    providers = rows("SELECT id FROM users WHERE role = 'provider'")
    pending_certs = rows("SELECT id FROM users WHERE certification_status = 'pending' AND role = 'provider'")
    clients = rows("SELECT id FROM users WHERE role = 'client'")

    month_start = time.strftime("%Y-%m-01")
    monthly_clients = rows("SELECT DISTINCT client_id FROM orders WHERE created_at >= %s", [month_start])
    monthly_active_users = len(monthly_clients) or max(1, int(len(clients) * 0.3))

    today_str = time.strftime("%Y-%m-%d")
    new_today = row("SELECT COUNT(*) AS c FROM users WHERE created_at >= %s", [today_str + " 00:00:00"])
    new_users_today = (new_today or {}).get("c", 0)

    # 修复：orders.status 无 'refunding' 取值，退款待处理应按支付状态统计
    refund_count = row("SELECT COUNT(*) AS c FROM orders WHERE payment_status = 'refunding'")
    pending_refunds = (refund_count or {}).get("c", 0)

    # 服务分布
    service_distribution = []
    for c in rows("SELECT name FROM service_categories"):
        count = sum(1 for o in all_orders if o["serviceCategory"] == c["name"])
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
            "totalUsers": len(clients),
            "totalProviders": len(providers),
            "totalOrders": total_orders,
            "totalRevenue": total_revenue,
            "monthlyActiveUsers": monthly_active_users,
            "averageRating": round(float((avg_rating or {}).get("avg") or 0), 1),
            "newUsersToday": new_users_today,
            "pendingCertifications": len(pending_certs),
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
    return {"success": True, "data": {k["key"]: k["value"] for k in kv}, "message": "设置已保存"}
