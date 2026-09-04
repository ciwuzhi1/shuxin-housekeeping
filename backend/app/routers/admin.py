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
    return {"success": True, "data": {k["key"]: k["value"] for k in kv}, "message": "设置已保存"}
