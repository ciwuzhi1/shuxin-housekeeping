"""客服路由（v4.6）：客服信息（公开）/ 工单提交 / 我的工单。

联系客服真实化：
- GET /api/support/contact 公开返回客服热线/工作时间/平台名（读 settings，管理员可改）
- POST /api/support/tickets 登录用户提交留言工单（可关联订单号）
- GET /api/support/tickets 返回本人工单及客服回复
"""

import time

from fastapi import APIRouter, Depends

from ..auth import require_auth
from ..database import execute, rows
from ..schemas import SupportTicketIn

router = APIRouter()


@router.get("/contact")
def get_contact():
    """客服联系方式（公开）：读系统设置，管理员在系统设置页修改后即时生效。"""
    kv = {k["key"]: k["value"] for k in rows("SELECT `key`, value FROM settings WHERE `key` IN ('platform_name','service_phone','work_start','work_end')")}
    return {
        "success": True,
        "data": {
            "platformName": kv.get("platform_name") or "舒心家政",
            "servicePhone": kv.get("service_phone") or "",
            "workTime": f"{kv.get('work_start') or '08:00'}-{kv.get('work_end') or '20:00'}",
        },
    }


@router.post("/tickets")
def create_ticket(data: SupportTicketIn, user=Depends(require_auth)):
    tid = f"st{int(time.time() * 1000)}{user['userId']}"
    execute(
        "INSERT INTO support_tickets (id, user_id, order_no, category, content, contact_phone) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        [tid, user["userId"], data.order_no or "", data.category, data.content, data.contact_phone or ""],
    )
    return {"success": True, "data": {"id": tid}, "message": "工单已提交，客服将尽快处理"}


@router.get("/tickets")
def my_tickets(user=Depends(require_auth)):
    data = rows(
        "SELECT id, order_no, category, content, contact_phone, status, reply, replied_at, created_at "
        "FROM support_tickets WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
        [user["userId"]],
    )
    return {"success": True, "data": data}
