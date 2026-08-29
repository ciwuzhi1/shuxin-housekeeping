"""用户端数据路由。

修复 P0-2：clientId 强制等于当前登录用户，杜绝越权读取他人订单。
"""

from fastapi import APIRouter, Depends

from ..auth import require_role
from ..database import rows
from ..errors import ForbiddenError

router = APIRouter()


def _assert_self(rid: str, user: dict) -> None:
    if user["role"] != "admin" and rid != user["userId"]:
        raise ForbiddenError("只能访问自己的数据", "SELF_ONLY")


@router.get("/{client_id}/orders")
def client_orders(client_id: str, user=Depends(require_role("client"))):
    _assert_self(client_id, user)
    orders = rows(
        "SELECT id, order_no, client_name, service_category, service_name, total_amount, status, "
        "scheduled_date, scheduled_time, provider_name FROM orders WHERE client_id = %s ORDER BY created_at DESC",
        [client_id],
    )
    return {"success": True, "data": orders}


@router.get("/{client_id}/stats")
def client_stats(client_id: str, user=Depends(require_role("client"))):
    _assert_self(client_id, user)
    all_rows = rows("SELECT status, total_amount FROM orders WHERE client_id = %s", [client_id])
    completed = [o for o in all_rows if o["status"] == "completed"]
    return {
        "success": True,
        "data": {
            "totalOrders": len(all_rows),
            "completedOrders": len(completed),
            "totalSpent": sum(float(o["totalAmount"] or 0) for o in completed),
        },
    }
