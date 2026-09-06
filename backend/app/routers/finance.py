"""财务路由：交易流水 / 财务汇总 / 提现管理。

修复 P1-3：revenueByMonth 由静态假数据改为按月真实聚合。
提现业务逻辑在 services/finance_service.py（Service 层第二步），路由只做鉴权与编排。
"""

import time

from fastapi import APIRouter, Depends, Query

from ..auth import require_auth, require_role
from ..config import settings
from ..database import row, rows
from ..errors import BadRequestError, ForbiddenError
from ..services import finance_service

router = APIRouter()


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
        # V4.4a：limit 上限保护，防止拉取全表
        sql += " LIMIT %s"
        params.append(min(int(limit), settings.MAX_PAGE_SIZE))
    return {"success": True, "data": rows(sql, params)}


@router.get("/summary")
def summary(_user=Depends(require_role("admin")), range: str = Query("month")):
    # V4.6：range 支持 week(近8周)/month(近12月)/year(近4年) 趋势粒度，月度收入恒为自然月
    if range not in ("week", "month", "year"):
        raise BadRequestError("range 仅支持 week/month/year")
    # V4.4a 聚合下推：completed 订单/待退款/待打款均改单行聚合，Python 只拼响应
    # （别名用 camelCase：database.row 返回前会做 to_camel 转换）
    completed_agg = row(
        "SELECT COUNT(*) AS `completedOrders`, COALESCE(SUM(total_amount), 0) AS `totalRevenue` "
        "FROM orders WHERE status = 'completed'"
    )
    total_revenue = float(completed_agg["totalRevenue"])
    completed_orders = int(completed_agg["completedOrders"])

    pending_refund_row = row("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE payment_status = 'refunding'")
    pending_withdrawal_row = row(
        "SELECT COALESCE(SUM(ABS(amount)), 0) AS s FROM transactions WHERE type = 'withdraw' AND status = 'pending'"
    )
    pending_payout = float((pending_refund_row or {}).get("s", 0)) + float((pending_withdrawal_row or {}).get("s", 0))

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

    # 趋势（V4.6：week=近8周 / month=近12月 / year=近4年，SQL 聚合 + Python 补零空档）
    revenue_by_month = _revenue_trend(range)

    # 月度收入恒为自然月（不随趋势粒度变化）
    cur = time.strftime("%Y-%m")
    monthly_row = row(
        "SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders "
        "WHERE status = 'completed' AND DATE_FORMAT(created_at, '%%Y-%%m') = %s",
        [cur],
    )

    return {
        "success": True,
        "data": {
            "totalRevenue": total_revenue,
            "monthlyRevenue": float((monthly_row or {}).get("s", 0)),
            "pendingPayout": pending_payout,
            "completedOrders": completed_orders,
            "averageOrderValue": round(total_revenue / completed_orders, 2) if completed_orders else 0,
            "commissionRate": 15,
            "range": range,
            "revenueByMonth": revenue_by_month,
            "revenueByCategory": revenue_by_category,
        },
    }


def _revenue_trend(range: str) -> list[dict]:
    """按粒度生成趋势桶：SQL 按 dkey 聚合一次，Python 补齐零收入空档。

    - week：近 8 周（桶 = 周一日期）
    - month：近 12 个月（桶 = YYYY-MM）
    - year：近 4 年（桶 = YYYY）
    """
    import datetime

    today = datetime.date.today()
    if range == "week":
        monday = today - datetime.timedelta(days=today.weekday())
        starts = [monday - datetime.timedelta(weeks=i) for i in range(7, -1, -1)]
        keys = [d.isoformat() for d in starts]
        labels = [f"{d.month}/{d.day}" for d in starts]
        grain, start = "%Y-%m-%d", keys[0]
    elif range == "year":
        keys = [str(today.year - i) for i in range(3, -1, -1)]
        labels = keys
        grain, start = "%Y", f"{keys[0]}-01-01"
    else:
        keys, y, m = [], today.year, today.month
        for i in range(11, -1, -1):
            mm, yy = m - i, y
            while mm <= 0:
                mm, yy = mm + 12, yy - 1
            keys.append(f"{yy:04d}-{mm:02d}")
        labels = keys
        grain, start = "%Y-%m", f"{keys[0]}-01"

    grouped = rows(
        "SELECT DATE_FORMAT(created_at, %s) AS dkey, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS rev "
        "FROM orders WHERE status = 'completed' AND created_at >= %s GROUP BY dkey",
        [grain, start],
    )
    by_key = {g["dkey"]: g for g in grouped}
    return [
        {
            "label": label,
            "revenue": float((by_key.get(k) or {}).get("rev") or 0),
            "orders": int((by_key.get(k) or {}).get("cnt") or 0),
        }
        for k, label in zip(keys, labels)
    ]


# ======================== 提现管理（业务在 services/finance_service.py） ========================


@router.get("/withdrawals")
def list_withdrawals(user=Depends(require_auth), userId: str = Query(None)):
    """admin 看全部；provider 仅本人；client 403。"""
    if user["role"] == "admin":
        target = userId
    elif user["role"] == "provider":
        target = user["userId"]
    else:
        raise ForbiddenError("客户无权查看提现记录", "FINANCE_FORBIDDEN")
    return {"success": True, "data": finance_service.list_withdrawals(target)}


@router.post("/withdrawals/{withdrawal_id}/pay")
def pay_withdrawal(withdrawal_id: str, user=Depends(require_role("admin"))):
    """打款（事务：FOR UPDATE 锁余额行 → 扣款 + 关联流水完成 + 通知本人 + 审计留痕）。"""
    return finance_service.pay_withdrawal(withdrawal_id, actor=user)


@router.post("/withdrawals/{withdrawal_id}/reject")
def reject_withdrawal(withdrawal_id: str, user=Depends(require_role("admin"))):
    """驳回：标记 rejected，关联 pending 流水作废 + 通知本人 + 审计留痕。"""
    return finance_service.reject_withdrawal(withdrawal_id, actor=user)
