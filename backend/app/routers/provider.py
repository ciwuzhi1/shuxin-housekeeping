"""家政人员端数据路由。

修复 P0-2：providerId 强制等于当前登录用户。
"""

import time

from fastapi import APIRouter, Depends

from ..auth import require_role
from ..database import row, rows
from ..errors import ForbiddenError

router = APIRouter()


def _assert_self(rid: str, user: dict) -> None:
    if user["role"] != "admin" and rid != user["userId"]:
        raise ForbiddenError("只能访问自己的数据", "SELF_ONLY")


@router.get("/{provider_id}/orders")
def provider_orders(provider_id: str, user=Depends(require_role("provider"))):
    _assert_self(provider_id, user)
    orders = rows(
        "SELECT id, order_no, client_name, client_address, service_category, service_name, total_amount, status, "
        "scheduled_date, scheduled_time, deadline_time, created_at FROM orders WHERE provider_id = %s ORDER BY created_at DESC",
        [provider_id],
    )
    return {"success": True, "data": orders}


@router.get("/{provider_id}/earnings")
def provider_earnings(provider_id: str, user=Depends(require_role("provider"))):
    _assert_self(provider_id, user)
    completed = rows(
        "SELECT total_amount, created_at FROM orders WHERE provider_id = %s AND status = 'completed' ORDER BY created_at ASC",
        [provider_id],
    )
    total_earnings = sum(float(o["totalAmount"] or 0) for o in completed)
    balance_row = row("SELECT balance FROM users WHERE id = %s", [provider_id])
    balance = float((balance_row or {}).get("balance") or 0) if balance_row else 0

    # P0 修复：本月收入（按订单创建时间聚合）
    # 注意：pymysql 用 % 格式化，SQL 中字面 % 需转义为 %%
    month_row = row(
        "SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders "
        "WHERE provider_id = %s AND status = 'completed' AND DATE_FORMAT(created_at, '%%Y-%%m') = %s",
        [provider_id, time.strftime("%Y-%m")],
    )
    this_month_earnings = float((month_row or {}).get("s") or 0)

    # P0 修复：本人流水（income/refund 关联本人订单），不再返回全平台流水
    transactions = rows(
        "SELECT t.id, t.order_id, t.order_no, t.type, t.amount, t.status, t.description, t.created_at "
        "FROM transactions t JOIN orders o ON t.order_id = o.id "
        "WHERE o.provider_id = %s AND t.type IN ('income', 'refund') "
        "ORDER BY t.created_at DESC LIMIT 50",
        [provider_id],
    )

    return {
        "success": True,
        "data": {
            "totalEarnings": total_earnings,
            "thisMonthEarnings": this_month_earnings,
            "completedOrders": len(completed),
            "balance": balance,
            "averageOrderValue": round(total_earnings / len(completed), 2) if completed else 0,
            # 修复：最近订单应为最新在前（completed 升序，取末尾并反转）
            "recentOrders": completed[-10:][::-1],
            "transactions": transactions,
        },
    }


@router.get("/{provider_id}/stats")
def provider_stats(provider_id: str, user=Depends(require_role("provider"))):
    _assert_self(provider_id, user)
    orders = rows("SELECT status, total_amount FROM orders WHERE provider_id = %s", [provider_id])
    completed = [o for o in orders if o["status"] == "completed"]
    return {
        "success": True,
        "data": {
            "totalOrders": len(orders),
            "completedOrders": len(completed),
            "pendingOrders": sum(1 for o in orders if o["status"] == "pending"),
            "inProgressOrders": sum(1 for o in orders if o["status"] == "in_progress"),
            "totalEarnings": sum(float(o["totalAmount"] or 0) for o in completed),
        },
    }
