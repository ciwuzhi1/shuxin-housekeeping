"""财务业务 Service 层（第二步）：提现申请 / 打款 / 驳回。

与 order_service 同约定：
- 业务规则集中在 Service，路由只做 HTTP 编排
- 写路径使用 transaction()，涉及余额的行用 SELECT ... FOR UPDATE 加锁，
  防止并发打款绕过余额校验造成负余额
- 提现流水通过 transactions.withdrawal_id 精确关联（迁移 005），不再按金额匹配
"""

import time

from ..database import execute, row, rows, transaction
from ..errors import BadRequestError, NotFoundError
from . import audit_service


def _new_id(prefix: str) -> str:
    return f"{prefix}{int(time.time() * 1000)}{int(time.time() * 1000) % 10000}"


def list_withdrawals(user_id: str | None = None) -> list[dict]:
    """提现列表（JOIN 用户取姓名）；user_id 为空时返回全部（admin）。"""
    sql = (
        "SELECT w.id, w.user_id, w.amount, w.account_name, w.account_no, w.status, w.created_at, w.processed_at, "
        "u.name AS user_name FROM withdrawals w JOIN users u ON w.user_id = u.id"
    )
    params: list = []
    if user_id:
        sql += " WHERE w.user_id = %s"
        params.append(user_id)
    sql += " ORDER BY w.created_at DESC"
    return rows(sql, params)


def request_withdrawal(provider_id: str, amount: float, account_name: str, account_no: str) -> dict:
    """提现申请：校验余额（行锁），写 pending 申请 + pending 流水，并通知管理员。"""
    def _do(conn):
        # FOR UPDATE 锁住余额行，防止并发申请绕过校验
        bal = row("SELECT balance, name FROM users WHERE id = %s FOR UPDATE", [provider_id], conn=conn)
        if not bal:
            raise BadRequestError("用户不存在")
        if float(bal["balance"]) < amount:
            raise BadRequestError(f"余额不足（当前 ¥{bal['balance']}）")

        wid = _new_id("w")
        execute(
            "INSERT INTO withdrawals (id, user_id, amount, account_name, account_no, status) VALUES (%s,%s,%s,%s,%s,'pending')",
            [wid, provider_id, amount, account_name, account_no],
            conn=conn,
        )
        execute(
            "INSERT INTO transactions (id, order_id, order_no, type, amount, status, description, withdrawal_id) "
            "VALUES (%s,NULL,NULL,'withdraw',%s,'pending',%s,%s)",
            [_new_id("t"), -amount, f"提现申请-{bal['name']}", wid],
            conn=conn,
        )
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,'a1',%s,%s,'system',0)",
            [_new_id("n"), "提现申请待处理", f"{bal['name']} 申请提现 ¥{amount}，请及时处理"],
            conn=conn,
        )
        return {"success": True, "data": {"id": wid}, "message": "提现申请已提交"}

    return transaction(_do)


def pay_withdrawal(withdrawal_id: str, actor: dict | None = None) -> dict:
    """打款（事务）：FOR UPDATE 锁余额行 → 校验 → 扣款 + 关联流水完成 + 通知本人。"""
    w = row("SELECT * FROM withdrawals WHERE id = %s", [withdrawal_id])
    if not w:
        raise NotFoundError("提现申请不存在")
    if w["status"] != "pending":
        raise BadRequestError("该提现申请已处理")

    def _do(conn):
        bal = row("SELECT balance FROM users WHERE id = %s FOR UPDATE", [w["userId"]], conn=conn)
        if (bal or {}).get("balance", 0) < w["amount"]:
            raise BadRequestError("该家政员余额不足，无法打款")
        execute("UPDATE withdrawals SET status = 'paid', processed_at = NOW() WHERE id = %s", [withdrawal_id], conn=conn)
        execute("UPDATE users SET balance = balance - %s WHERE id = %s", [w["amount"], w["userId"]], conn=conn)
        if w.get("id"):
            # 精确关联：仅更新本申请对应的流水（withdrawal_id 由申请/回填保证）
            execute(
                "UPDATE transactions SET status = 'completed', description = %s "
                "WHERE withdrawal_id = %s AND type = 'withdraw' AND status = 'pending'",
                [f"提现打款-{w['accountName']}", withdrawal_id],
                conn=conn,
            )
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'income',0)",
            [_new_id("n"), w["userId"], "提现到账", f"您的提现 ¥{w['amount']} 已打款至 {w['accountName']} {w['accountNo']}"],
            conn=conn,
        )
        # 审计：与打款同事务写入，保证留痕与资金变动原子
        audit_service.record(actor, "withdrawal_pay", "withdrawal", withdrawal_id,
                             f"打款提现 ¥{w['amount']} 至 {w['accountName']} {w['accountNo']}", conn=conn)
        return {"success": True, "message": "打款成功"}

    return transaction(_do)


def reject_withdrawal(withdrawal_id: str, actor: dict | None = None) -> dict:
    """驳回：标记 rejected，关联 pending 流水作废，并通知本人。"""
    w = row("SELECT * FROM withdrawals WHERE id = %s", [withdrawal_id])
    if not w:
        raise NotFoundError("提现申请不存在")
    if w["status"] != "pending":
        raise BadRequestError("该提现申请已处理")

    def _do(conn):
        execute("UPDATE withdrawals SET status = 'rejected', processed_at = NOW() WHERE id = %s", [withdrawal_id], conn=conn)
        if w.get("id"):
            execute(
                "UPDATE transactions SET status = 'cancelled' WHERE withdrawal_id = %s AND type = 'withdraw' AND status = 'pending'",
                [withdrawal_id],
                conn=conn,
            )
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'system',0)",
            [_new_id("n"), w["userId"], "提现申请被驳回", f"您的 ¥{w['amount']} 提现申请被驳回，资金保留在余额中"],
            conn=conn,
        )
        audit_service.record(actor, "withdrawal_reject", "withdrawal", withdrawal_id,
                             f"驳回提现申请 ¥{w['amount']}", conn=conn)
        return {"success": True, "message": "已驳回"}

    return transaction(_do)
