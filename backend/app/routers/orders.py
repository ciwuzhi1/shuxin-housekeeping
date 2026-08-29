"""订单路由：列表 / 详情 / 创建 / 状态流转 / 评价。

V4.0 P0-4：业务规则与 SQL 已迁入 services/order_service.py，
本文件只负责 HTTP 编排（解析请求 → 鉴权 → 调 Service → 返回响应）。
"""

from fastapi import APIRouter, Depends, Query

from ..auth import require_auth
from ..schemas import OrderCreate, OrderReviewIn, OrderStatusUpdate
from ..services import order_service

router = APIRouter()


@router.get("")
def list_orders(
    user=Depends(require_auth),
    page: int = Query(1),
    size: int = Query(None),
    clientId: str = Query(None),
    providerId: str = Query(None),
    status: str = Query(None),
    search: str = Query(None),
):
    return order_service.list_orders(user, page, size, clientId, providerId, status, search)


@router.get("/{order_id}")
def get_order(order_id: str, user=Depends(require_auth)):
    return order_service.get_order(order_id, user)


@router.post("", status_code=201)
def create_order(data: OrderCreate, user=Depends(require_auth)):
    return order_service.create_order(data, user)


@router.put("/{order_id}/status")
def update_status(order_id: str, data: OrderStatusUpdate, user=Depends(require_auth)):
    return order_service.update_status(order_id, data, user)


@router.post("/{order_id}/review")
def review_order(order_id: str, data: OrderReviewIn, user=Depends(require_auth)):
    return order_service.review_order(order_id, data, user)
