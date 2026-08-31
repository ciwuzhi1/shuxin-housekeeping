"""财务路由：交易流水 / 财务汇总 / 提现管理。

修复 P1-3：revenueByMonth 由静态假数据改为按月真实聚合。
提现：provider 申请（校验余额）→ admin 打款（事务：扣余额+写流水+通知）/ 驳回。
"""

import time

from fastapi import APIRouter, Depends, Query

from ..auth import require_auth, require_role
from ..database import execute, row, rows, transaction
from ..errors import BadRequestError, ForbiddenError, NotFoundError

router = APIRouter()


def _new_id(prefix: str) -> str:
    return f"{prefix}{int(time.time() * 1000)}{int(time.time() * 1000) % 10000}"


@router.get("/transactions")
def list_transactions(
    user=Depends(require_auth),
    type: str = Query(None),
    status: str = Query(None),
    limit: int = Query(None),
):
    """安全修复：按角色过滤流水。
    - admin：全平台
    - provider：仅本人订单相关（income/refund）
    - client：无权查看（403）
    """
    if user["role"] == "client":
        raise ForbiddenError("客户无权查看平台流水", "FINANCE_FORBIDDEN")

    sql = (
        "SELECT t.id, t.order_id, t.order_no, t.type, t.amount, t.status, t.description, t.created_at "
        "FROM transactions t"
    )
    params: list = []
    conditions: list[str] = []
    if user["role"] == "provider":
        sql += " JOIN orders o ON t.order_id = o.id"
        conditions.append("o.provider_id = %s")
        params.append(user["userId"])
    if type:
        conditions.append("t.type = %s")
        params.append(type)
    if status:
        conditions.append("t.status = %s")
        params.append(status)
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY t.created_at DESC"
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    return {"success": True, "data": rows(sql, params)}


@router.get("/summary")
def summary(_user=Depends(require_role("admin"))):
    completed = rows("SELECT total_amount, created_at FROM orders WHERE status = 'completed'")
    total_revenue = sum(float(o["totalAmount"] or 0) for o in completed)

    pending_refunds = rows("SELECT total_amount FROM orders WHERE payment_status = 'refunding'")
    pending_payout_orders = sum(float(o["totalAmount"] or 0) for o in pending_refunds)
    pending_withdrawals = rows("SELECT amount FROM transactions WHERE type = 'withdraw' AND status = 'pending'")
    pending_payout_withdrawals = sum(abs(float(o["amount"] or 0)) for o in pending_withdrawals)
    pending_payout = pending_payout_orders + pending_payout_withdrawals

    # 分类收入（一次 GROUP BY 聚合，消除按分类循环查询的 N+1）
    rev_map = {
        r["category"]: float(r["revenue"] or 0)
        for r in rows(
            "SELECT service_category AS category, SUM(total_amount) AS revenue "
            "FROM orders WHERE status = 'completed' GROUP BY service_category"
        )
    }
    revenue_by_category = []
    for c in rows("SELECT name FROM service_categories"):
        revenue = rev_map.get(c["name"], 0)
        revenue_by_category.append({
            "category": c["name"],
            "revenue": revenue,
            "percentage": round(revenue / total_revenue * 100, 1) if total_revenue else 0,
        })

    # 月度趋势（真实聚合）
    month_rows = rows(
        "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS cnt, SUM(total_amount) AS rev "
        "FROM orders WHERE status = 'completed' GROUP BY month ORDER BY month"
    )
    revenue_by_month = [
        {"month": m["month"], "revenue": float(m["rev"] or 0), "orders": m["cnt"]} for m in month_rows
    ]

    return {
        "success": True,
        "data": {
            "totalRevenue": total_revenue,
            "monthlyRevenue": float(revenue_by_month[-1]["revenue"]) if revenue_by_month else 0,
            "pendingPayout": pending_payout,
            "completedOrders": len(completed),
            "averageOrderValue": round(total_revenue / len(completed), 2) if completed else 0,
            "commissionRate": 15,
            "revenueByMonth": revenue_by_month,
            "revenueByCategory": revenue_by_category,
        },
    }


# ======================== 提现管理 ========================


@router.get("/withdrawals")
def list_withdrawals(user=Depends(require_auth), userId: str = Query(None)):
    """admin 看全部；provider 仅本人。"""
    sql = (
        "SELECT w.id, w.user_id, w.amount, w.account_name, w.account_no, w.status, w.created_at, w.processed_at, "
        "u.name AS user_name FROM withdrawals w JOIN users u ON w.user_id = u.id"
    )
    params: list = []
    if user["role"] == "admin":
        if userId:
            sql += " WHERE w.user_id = %s"
            params.append(userId)
    elif user["role"] == "provider":
        sql += " WHERE w.user_id = %s"
        params.append(user["userId"])
    else:
        raise ForbiddenError("客户无权查看提现记录", "FINANCE_FORBIDDEN")
    sql += " ORDER BY w.created_at DESC"
    return {"success": True, "data": rows(sql, params)}


@router.post("/withdrawals/{withdrawal_id}/pay")
def pay_withdrawal(withdrawal_id: str, _user=Depends(require_role("admin"))):
    """打款（事务）：扣余额 + 写流水 + 标记已打款 + 通知本人。"""
    w = row("SELECT * FROM withdrawals WHERE id = %s", [withdrawal_id])
    if not w:
        raise NotFoundError("提现申请不存在")
    if w["status"] != "pending":
        raise BadRequestError("该提现申请已处理")

    def _do(conn):
        bal = row("SELECT balance FROM users WHERE id = %s", [w["userId"]], conn=conn)
        if (bal or {}).get("balance", 0) < w["amount"]:
            raise BadRequestError("该家政员余额不足，无法打款")
        execute("UPDATE withdrawals SET status = 'paid', processed_at = NOW() WHERE id = %s", [withdrawal_id], conn=conn)
        execute("UPDATE users SET balance = balance - %s WHERE id = %s", [w["amount"], w["userId"]], conn=conn)
        execute(
            "UPDATE transactions SET status = 'completed', description = %s WHERE type = 'withdraw' AND status = 'pending' AND amount = %s",
            [f"提现打款-{w['accountName']}", -w["amount"]],
            conn=conn,
        )
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'income',0)",
            [_new_id("n"), w["userId"], "提现到账", f"您的提现 ¥{w['amount']} 已打款至 {w['accountName']} {w['accountNo']}"],
            conn=conn,
        )
        return {"success": True, "message": "打款成功"}

    return transaction(_do)


@router.post("/withdrawals/{withdrawal_id}/reject")
def reject_withdrawal(withdrawal_id: str, _user=Depends(require_role("admin"))):
    """驳回：标记 rejected，并将对应 pending 流水作废。"""
    w = row("SELECT * FROM withdrawals WHERE id = %s", [withdrawal_id])
    if not w:
        raise NotFoundError("提现申请不存在")
    if w["status"] != "pending":
        raise BadRequestError("该提现申请已处理")

    def _do(conn):
        execute("UPDATE withdrawals SET status = 'rejected', processed_at = NOW() WHERE id = %s", [withdrawal_id], conn=conn)
        execute(
            "UPDATE transactions SET status = 'cancelled' WHERE type = 'withdraw' AND status = 'pending' AND amount = %s",
            [-w["amount"]],
            conn=conn,
        )
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'system',0)",
            [_new_id("n"), w["userId"], "提现申请被驳回", f"您的 ¥{w['amount']} 提现申请被驳回，资金保留在余额中"],
            conn=conn,
        )
        return {"success": True, "message": "已驳回"}

    return transaction(_do)
