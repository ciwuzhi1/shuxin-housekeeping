"""家政人员端数据路由。

修复 P0-2：providerId 强制等于当前登录用户。
提现申请校验余额并写 pending 流水；收入趋势按周/月/年真实聚合。
"""

import datetime
import time

from fastapi import APIRouter, Depends

from ..auth import require_role
from ..database import execute, row, rows, transaction
from ..errors import BadRequestError
from ..schemas import WithdrawCreateIn

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


@router.post("/{provider_id}/withdrawals")
def request_withdrawal(provider_id: str, data: WithdrawCreateIn, user=Depends(require_role("provider"))):
    """提现申请：校验余额，写 pending 申请 + pending 流水，并通知管理员。"""
    _assert_self(provider_id, user)
    bal = row("SELECT balance, name FROM users WHERE id = %s", [provider_id])
    if not bal:
        raise BadRequestError("用户不存在")
    if float(bal["balance"]) < data.amount:
        raise BadRequestError(f"余额不足（当前 ¥{bal['balance']}）")

    def _do(conn):
        wid = _new_id("w")
        execute(
            "INSERT INTO withdrawals (id, user_id, amount, account_name, account_no, status) VALUES (%s,%s,%s,%s,%s,'pending')",
            [wid, provider_id, data.amount, data.account_name, data.account_no],
            conn=conn,
        )
        execute(
            "INSERT INTO transactions (id, order_id, order_no, type, amount, status, description) "
            "VALUES (%s,NULL,NULL,'withdraw',%s,'pending',%s)",
            [_new_id("t"), -data.amount, f"提现申请-{bal['name']}"],
            conn=conn,
        )
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,'a1',%s,%s,'system',0)",
            [_new_id("n"), "提现申请待处理", f"{bal['name']} 申请提现 ¥{data.amount}，请及时处理"],
            conn=conn,
        )
        return {"success": True, "data": {"id": wid}, "message": "提现申请已提交"}

    return transaction(_do)
