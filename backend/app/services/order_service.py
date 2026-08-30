"""订单业务服务层（V4.0 P0-4 第一步：从 routers/orders.py 迁入，路由只留 HTTP 编排）。

业务规则：
- 列表/详情按角色强制归属（client 仅本人、provider 本人或抢单池、admin 任意）
- 下单金额由服务端按服务目录价校验并重算，不信任客户端提交金额
- 状态流转走状态机 + 乐观并发控制（影响 0 行 → 409）；完成/取消联动结算与退款
- 评价双写 reviews 表并重算家政员评分；rating=0 条件更新 + 唯一键防并发重复评价
"""

import random
import time

import pymysql

from ..database import execute, parse_pagination, row, rows, transaction
from ..errors import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from ..schemas import OrderCreate, OrderReviewIn, OrderStatusUpdate
from ..state_machine import can_transition

ORDER_SELECT = """
SELECT id, order_no, client_id, provider_id, client_name, client_phone,
       client_address, service_category, service_name, service_price,
       total_hours, total_amount, status, payment_status, scheduled_date,
       scheduled_time, deadline_time, special_requirements, rating, review,
       review_images, provider_name, created_at, updated_at FROM orders
"""


def _now() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def _new_id(prefix: str) -> str:
    return f"{prefix}{int(time.time() * 1000)}{random.randint(1000, 9999)}"


def _notify(conn, user_id: str, title: str, content: str, ntype: str = "order") -> None:
    """联动：订单/资金事件 → 写入一条通知（`read` 为 MySQL 保留字，需反引号）。"""
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`, created_at) "
        "VALUES (%s,%s,%s,%s,%s,0,%s)",
        [_new_id("n"), user_id, title, content, ntype, _now()],
        conn=conn,
    )


def list_orders(user: dict, page, size, clientId, providerId, status, search) -> dict:
    pag = parse_pagination(page, size)

    # 修复 P0-2：按角色强制归属，忽略他人参数
    if user["role"] == "client":
        clientId = user["userId"]
        providerId = None
    elif user["role"] == "provider":
        providerId = user["userId"]
        clientId = None

    conditions: list[str] = []
    params: list = []
    if clientId:
        conditions.append("client_id = %s")
        params.append(clientId)
    if user["role"] == "provider":
        # 家政端：看到「指派给自己的订单」+「可抢的待接单（未分配）」
        conditions.append("(provider_id = %s OR (status = 'pending' AND provider_id IS NULL))")
        params.append(user["userId"])
    elif providerId:
        conditions.append("provider_id = %s")
        params.append(providerId)
    if status:
        conditions.append("status = %s")
        params.append(status)
    if search:
        conditions.append("(order_no LIKE %s OR client_name LIKE %s OR service_name LIKE %s)")
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

    list_rows = rows(
        f"{ORDER_SELECT}{where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        params + [pag["limit"], pag["offset"]],
    )
    total_row = row(f"SELECT COUNT(*) AS c FROM orders{where}", params)
    total = (total_row or {}).get("c", 0)
    return {
        "success": True,
        "data": list_rows,
        "pagination": {"page": pag["page"], "size": pag["size"], "total": total, "totalPages": (total + pag["size"] - 1) // pag["size"]},
    }


def _assert_visible(order: dict, user: dict) -> None:
    """详情可见性：admin 任意；client/provider 仅限本人相关。"""
    if user["role"] == "admin":
        return
    if user["role"] == "client" and order.get("clientId") == user["userId"]:
        return
    if user["role"] == "provider":
        # 本人订单，或「抢单池」中未分配且待接的订单（列表可见，详情也应可看）
        if order.get("providerId") == user["userId"]:
            return
        if order.get("status") == "pending" and not order.get("providerId"):
            return
    raise ForbiddenError("无权查看该订单", "ORDER_FORBIDDEN")


def get_order(order_id: str, user: dict) -> dict:
    order = row(f"{ORDER_SELECT} WHERE id = %s", [order_id])
    if not order:
        raise NotFoundError("订单不存在")
    _assert_visible(order, user)
    return {"success": True, "data": order}


def create_order(data: OrderCreate, user: dict) -> dict:
    # 归属校验：客户只能为自己下单
    if user["role"] == "client" and data.client_id != user["userId"]:
        raise ForbiddenError("不能替其他客户创建订单", "ORDER_FORBIDDEN")
    if user["role"] not in ("client", "admin"):
        raise ForbiddenError("无权创建订单", "ORDER_FORBIDDEN")

    client_id = data.client_id if user["role"] == "admin" else user["userId"]
    client = row("SELECT id FROM users WHERE id = %s AND role = 'client'", [client_id])
    if not client:
        raise BadRequestError("客户不存在", "INVALID_CLIENT")

    # 安全修复：金额由服务端依据服务目录价计算，不信任客户端提交的金额
    sub = row(
        "SELECT id, name, price FROM service_subcategories WHERE name = %s AND category_id = "
        "(SELECT id FROM service_categories WHERE name = %s) LIMIT 1",
        [data.service_name, data.service_category],
    )
    if sub:
        catalog_price = float(sub["price"])
        if abs(float(data.service_price) - catalog_price) > 0.001:
            raise BadRequestError("服务单价与平台目录价不一致，请刷新后重试", "PRICE_MISMATCH")
        amount = round(catalog_price * float(data.total_hours), 2)
    else:
        # 组合服务名等无法匹配目录的情况：强制金额 = 单价 × 时长，防止篡改
        amount = round(float(data.service_price) * float(data.total_hours), 2)

    # P0 修复：预约时指定家政员 → 校验其存在、已认证、在线
    assigned_provider_id = None
    assigned_provider_name = ""
    if data.provider_id:
        provider = row(
            "SELECT id, name, status, certification_status FROM users WHERE id = %s AND role = 'provider'",
            [data.provider_id],
        )
        if not provider:
            raise BadRequestError("家政人员不存在", "INVALID_PROVIDER")
        if provider["certificationStatus"] != "verified":
            raise BadRequestError("该家政人员未完成资质认证，无法指定", "PROVIDER_NOT_VERIFIED")
        if provider["status"] != "online":
            raise BadRequestError("该家政人员当前不在线，请选择其他人或智能匹配", "PROVIDER_OFFLINE")
        assigned_provider_id = data.provider_id
        assigned_provider_name = data.provider_name or provider["name"]

    oid = _new_id("o")
    # 6 位随机数：同日期订单较多时 3 位随机会碰撞（order_no 唯一键），曾致测试偶发失败
    order_no = f"HK{data.scheduled_date.replace('-', '')}{random.randint(0, 999999):06d}"
    now = _now()

    def _do(conn):
        execute(
            "INSERT INTO orders (id, order_no, client_id, provider_id, client_name, client_phone, client_address, service_category, service_name, service_price, total_hours, total_amount, status, payment_status, scheduled_date, scheduled_time, special_requirements, rating, review, review_images, provider_name, created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,'','[]',%s,%s,%s)",
            [
                oid, order_no, client_id, assigned_provider_id, data.client_name, data.client_phone, data.client_address,
                data.service_category, data.service_name, data.service_price, data.total_hours, amount,
                "pending", "unpaid", data.scheduled_date, data.scheduled_time, data.special_requirements or "",
                assigned_provider_name, now, now,
            ],
            conn=conn,
        )
        execute("UPDATE users SET total_orders = total_orders + 1 WHERE id = %s", [client_id], conn=conn)
        # 联动：通知客户预约已提交
        _notify(conn, client_id, "预约提交成功", f"您的订单 {order_no} 已提交，等待家政人员接单")
        # 联动：指定家政员 → 通知其接单
        if assigned_provider_id:
            _notify(conn, assigned_provider_id, "新订单提醒",
                    f"客户指定了您，订单 {order_no}（{data.service_name}）待您接单")

    transaction(_do)
    return {"success": True, "data": {"id": oid, "orderNo": order_no}, "message": "预约成功"}


def update_status(order_id: str, data: OrderStatusUpdate, user: dict) -> dict:
    order = row(
        "SELECT id, status, client_id, provider_id, total_amount, payment_status, order_no FROM orders WHERE id = %s",
        [order_id],
    )
    if not order:
        raise NotFoundError("订单不存在")

    # 修复 P0-3：按角色 + 归属授权
    role = user["role"]
    if role == "admin":
        pass
    elif role == "client":
        if order["clientId"] != user["userId"]:
            raise ForbiddenError("只能操作自己的订单", "ORDER_FORBIDDEN")
        if data.status != "cancelled":
            raise ForbiddenError("客户只能取消订单", "ORDER_FORBIDDEN")
    elif role == "provider":
        is_owner = order["providerId"] == user["userId"]
        # P0：只能接「未指派」或「指派给自己」的待接订单，防止抢占已指定的订单
        is_accept = (
            order["status"] == "pending"
            and data.status == "accepted"
            and (not order["providerId"] or order["providerId"] == user["userId"])
        )
        if not (is_owner or is_accept):
            raise ForbiddenError("只能操作指派给自己的订单", "ORDER_FORBIDDEN")
    else:
        raise ForbiddenError("无权操作订单", "ORDER_FORBIDDEN")

    # 状态机校验
    if not can_transition(order["status"], data.status):
        raise BadRequestError(f"订单状态 {order['status']} 不能转为 {data.status}", "INVALID_TRANSITION")

    now = _now()
    sets = ["updated_at = %s", "status = %s"]
    params: list = [now, data.status]
    if data.status == "accepted" and role == "provider":
        sets.append("provider_id = %s")
        params.append(user["userId"])
        sets.append("provider_name = %s")
        params.append(data.provider_name or "")

    def _do(conn):
        # P0：乐观并发控制 —— 以"原状态"为条件更新；抢单/重复操作影响 0 行 → 409
        result = execute(
            f"UPDATE orders SET {', '.join(sets)} WHERE id = %s AND status = %s",
            params + [order_id, order["status"]],
            conn=conn,
        )
        if result["changes"] == 0:
            raise ConflictError("订单状态已变化，请刷新后重试", "STALE_ORDER")

        # 联动：接单 → 通知客户
        if data.status == "accepted":
            _notify(conn, order.get("clientId"), "家政人员已接单",
                    f"{data.provider_name or '家政人员'} 已接受您的订单 {order.get('orderNo')}，请按时等候服务")

        # 联动：完成 → 结算家政员 + 生成收入流水 + 通知双方
        if data.status == "completed":
            settled = row("SELECT provider_id, total_amount FROM orders WHERE id = %s", [order_id], conn=conn)
            if settled and settled.get("providerId"):
                amount = float(settled.get("totalAmount") or 0)
                execute(
                    "UPDATE users SET completed_orders = completed_orders + 1, balance = balance + %s WHERE id = %s",
                    [amount, settled["providerId"]],
                    conn=conn,
                )
                execute(
                    "INSERT INTO transactions (id, order_id, order_no, type, amount, status, description, created_at) "
                    "VALUES (%s,%s,%s,'income',%s,'completed',%s,%s)",
                    [_new_id("t"), order_id, order.get("orderNo") or "", amount, "订单收入", now],
                    conn=conn,
                )
                # 资金转入 → 通知家政员
                _notify(conn, settled["providerId"], "收入到账",
                        f"订单 {order.get('orderNo')} 完成，收入 ¥{amount:.2f} 已到账", "income")
            _notify(conn, order.get("clientId"), "订单已完成",
                    f"您的订单 {order.get('orderNo')} 已完成，欢迎评价")

        # 联动：取消 → 通知客户（已支付则生成退款流水 + 退款通知）
        if data.status == "cancelled":
            _notify(conn, order.get("clientId"), "订单已取消",
                    f"您的订单 {order.get('orderNo')} 已取消")
            if order.get("paymentStatus") in ("paid", "refunding"):
                execute("UPDATE orders SET payment_status = 'refunded' WHERE id = %s", [order_id], conn=conn)
                execute(
                    "INSERT INTO transactions (id, order_id, order_no, type, amount, status, description, created_at) "
                    "VALUES (%s,%s,%s,'refund',%s,'completed',%s,%s)",
                    [_new_id("t"), order_id, order.get("orderNo") or "", -(float(order.get("totalAmount") or 0)), "订单退款-取消", now],
                    conn=conn,
                )
                _notify(conn, order.get("clientId"), "退款到账",
                        f"订单 {order.get('orderNo')} 已退款 ¥{float(order.get('totalAmount') or 0):.2f}", "income")

    transaction(_do)
    return {"success": True, "message": "订单状态已更新"}


def review_order(order_id: str, data: OrderReviewIn, user: dict) -> dict:
    if user["role"] not in ("client", "admin"):
        raise ForbiddenError("只有客户可以评价", "REVIEW_FORBIDDEN")

    order = row(
        "SELECT id, client_id, provider_id, status, rating, order_no, service_name FROM orders WHERE id = %s",
        [order_id],
    )
    if not order:
        raise NotFoundError("订单不存在")
    if user["role"] == "client" and order["clientId"] != user["userId"]:
        raise ForbiddenError("只能评价自己的订单", "REVIEW_FORBIDDEN")
    if order["status"] != "completed":
        raise BadRequestError("只能评价已完成的订单", "INVALID_STATUS")
    if order["rating"] > 0:
        raise BadRequestError("订单已评价过", "ALREADY_REVIEWED")

    now = _now()

    def _do(conn):
        # 并发防护：以 rating=0 为条件更新，两个请求同时评价只可能成功一个
        result = execute("UPDATE orders SET rating = %s, review = %s, updated_at = %s WHERE id = %s AND rating = 0",
                [data.rating, data.content, now, order_id], conn=conn)
        if result["changes"] == 0:
            raise ConflictError("订单已评价过", "ALREADY_REVIEWED")

        # 修复 P1-1：评价写入 reviews 表
        client = row("SELECT name, avatar FROM users WHERE id = %s", [order["clientId"]], conn=conn)
        provider = None
        if order.get("providerId"):
            provider = row("SELECT name FROM users WHERE id = %s", [order["providerId"]], conn=conn)
        try:
            execute(
                "INSERT INTO reviews (id, order_id, client_id, client_name, client_avatar, provider_id, provider_name, rating, content, images, service_name, created_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'[]',%s,%s)",
                [
                    _new_id("r"), order_id, order["clientId"],
                    (client or {}).get("name") or "", (client or {}).get("avatar") or "",
                    order.get("providerId"), (provider or {}).get("name") if provider else "",
                    data.rating, data.content, order.get("serviceName") or "", now,
                ],
                conn=conn,
            )
        except pymysql.err.IntegrityError:
            # uk_review_order(order_id) 兜底：并发双写只允许一条评价
            raise ConflictError("订单已评价过", "ALREADY_REVIEWED")

        # 重算家政员平均评分
        if order.get("providerId"):
            avg = row("SELECT AVG(rating) AS avg FROM orders WHERE provider_id = %s AND rating > 0",
                      [order["providerId"]], conn=conn)
            if avg and avg.get("avg") is not None:
                execute("UPDATE users SET rating = %s WHERE id = %s",
                        [round(float(avg["avg"]) * 10) / 10, order["providerId"]], conn=conn)
            # 联动：评价 → 通知家政员
            _notify(conn, order["providerId"], "收到新评价",
                    f"客户对订单 {order.get('orderNo')} 给出了 {data.rating} 星评价")

    transaction(_do)
    return {"success": True, "message": "评价成功"}
