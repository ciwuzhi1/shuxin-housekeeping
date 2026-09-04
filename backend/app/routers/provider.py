"""家政人员端数据路由。

修复 P0-2：providerId 强制等于当前登录用户。
提现申请校验余额并写 pending 流水；收入趋势按周/月/年真实聚合。
"""

import datetime
import time

from fastapi import APIRouter, Depends

from ..auth import require_role
from ..database import row, rows
from ..errors import BadRequestError
from ..schemas import WithdrawCreateIn
from ..services import finance_service

router = APIRouter()


def _assert_self(rid: str, user: dict) -> None:
    if user["role"] != "admin" and rid != user["userId"]:
        raise BadRequestError("只能访问自己的数据", "SELF_ONLY")


def _new_id(prefix: str) -> str:
    return f"{prefix}{int(time.time() * 1000)}{int(time.time() * 1000) % 10000}"


def _income_trend(provider_id: str, days: int = 0, months: int = 0) -> list[dict]:
    """按日(days)或按月(months)聚合本人 income 流水，补齐空档。

    聚合在 SQL 完成（GROUP BY），Python 只负责补齐无收入的日期/月份空档。
    """
    grain = "%Y-%m-%d" if days else "%Y-%m"
    grouped = rows(
        "SELECT DATE_FORMAT(t.created_at, %s) AS dkey, SUM(t.amount) AS amount "
        "FROM transactions t JOIN orders o ON t.order_id = o.id "
        "WHERE o.provider_id = %s AND t.type = 'income' "
        "GROUP BY dkey",
        [grain, provider_id],
    )
    by_key = {g["dkey"]: float(g["amount"] or 0) for g in grouped}

    out = []
    if days:
        today = datetime.date.today()
        for i in range(days - 1, -1, -1):
            d = today - datetime.timedelta(days=i)
            out.append({"label": d.strftime("%m-%d"), "amount": round(by_key.get(d.isoformat(), 0), 2)})
    else:
        today = datetime.date.today().replace(day=1)
        for i in range(months - 1, -1, -1):
            y, m = today.year, today.month - i
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y:04d}-{m:02d}"
            out.append({"label": key[5:] + "月", "amount": round(by_key.get(key, 0), 2)})
    return out


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
    # V4.4a 聚合下推：本人 completed 订单改单行聚合；最近订单直接 DESC LIMIT 10
    # （别名用 camelCase：database.row 返回前会做 to_camel 转换）
    agg = row(
        "SELECT COUNT(*) AS `completedOrders`, COALESCE(SUM(total_amount), 0) AS `totalEarnings` "
        "FROM orders WHERE provider_id = %s AND status = 'completed'",
        [provider_id],
    )
    completed_orders = int(agg["completedOrders"])
    total_earnings = float(agg["totalEarnings"])
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

    # 最近订单：等价于原「completed 升序全量 → 末尾 10 条反转」
    recent_orders = rows(
        "SELECT total_amount, created_at FROM orders "
        "WHERE provider_id = %s AND status = 'completed' ORDER BY created_at DESC LIMIT 10",
        [provider_id],
    )

    return {
        "success": True,
        "data": {
            "totalEarnings": total_earnings,
            "thisMonthEarnings": this_month_earnings,
            "completedOrders": completed_orders,
            "balance": balance,
            "averageOrderValue": round(total_earnings / completed_orders, 2) if completed_orders else 0,
            "recentOrders": recent_orders,
            "transactions": transactions,
            # 真实趋势：周=近7天每日，月=近30天每日，年=近12月每月
            "trends": {
                "week": _income_trend(provider_id, days=7),
                "month": _income_trend(provider_id, days=30),
                "year": _income_trend(provider_id, months=12),
            },
        },
    }


@router.get("/{provider_id}/stats")
def provider_stats(provider_id: str, user=Depends(require_role("provider"))):
    _assert_self(provider_id, user)
    agg = row(
        "SELECT COUNT(*) AS `totalOrders`, "
        "COALESCE(SUM(status = 'completed'), 0) AS `completedOrders`, "
        "COALESCE(SUM(status = 'pending'), 0) AS `pendingOrders`, "
        "COALESCE(SUM(status = 'in_progress'), 0) AS `inProgressOrders`, "
        "COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS `totalEarnings` "
        "FROM orders WHERE provider_id = %s",
        [provider_id],
    )
    return {
        "success": True,
        "data": {
            "totalOrders": int(agg["totalOrders"]),
            "completedOrders": int(agg["completedOrders"]),
            "pendingOrders": int(agg["pendingOrders"]),
            "inProgressOrders": int(agg["inProgressOrders"]),
            "totalEarnings": float(agg["totalEarnings"]),
        },
    }


@router.post("/{provider_id}/withdrawals")
def request_withdrawal(provider_id: str, data: WithdrawCreateIn, user=Depends(require_role("provider"))):
    """提现申请（业务在 services/finance_service.py，FOR UPDATE 锁余额行）。"""
    _assert_self(provider_id, user)
    return finance_service.request_withdrawal(provider_id, data.amount, data.account_name, data.account_no)
