"""e2e：财务幂等（V4.0 P0-7）——重复结算/退款/评价的唯一性保障。"""

import pymysql
import pytest

from backend.tests.conftest import TEST_DB

_TEST_DB = TEST_DB


def _connect():
    return pymysql.connect(
        host="127.0.0.1", port=3306, user="root", password="root", database=_TEST_DB, charset="utf8mb4"
    )


def _count_tx(order_id: str, tx_type: str) -> int:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM transactions WHERE order_id = %s AND type = %s", [order_id, tx_type])
            return cur.fetchone()[0]
    finally:
        conn.close()


def _set_payment_status(order_id: str, status: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE orders SET payment_status = %s WHERE id = %s", [status, order_id])
        conn.commit()
    finally:
        conn.close()


def _create_order(client, token: str) -> dict:
    r = client.post(
        "/api/orders",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "clientId": "c1", "clientName": "张三", "clientPhone": "13800138001",
            "clientAddress": "北京市朝阳区建国路88号", "serviceCategory": "日常保洁",
            "serviceName": "普通日常保洁", "servicePrice": 180, "totalHours": 1,
            "totalAmount": 180, "scheduledDate": "2026-09-01", "scheduledTime": "09:00-10:00",
        },
    )
    assert r.status_code == 201, f"下单失败: {r.json()}"
    return r.json()["data"]


def test_duplicate_complete_single_income(client):
    """重复完成订单：第二次被状态机拒绝，income 流水恰好 1 笔。"""
    c1 = client.post("/api/auth/login", json={"username": "zhangsan", "role": "client", "password": "123456"}).json()["data"]
    p1 = client.post("/api/auth/login", json={"username": "liujie", "role": "provider", "password": "123456"}).json()["data"]
    ph = {"Authorization": f"Bearer {p1['token']}"}

    order = _create_order(client, c1["token"])
    oid, ono = order["id"], order["orderNo"]
    for st in ("accepted", "in_progress"):
        client.put(f"/api/orders/{oid}/status", headers=ph, json={"status": st})

    r = client.put(f"/api/orders/{oid}/status", headers=ph, json={"status": "completed"})
    assert r.status_code == 200
    r = client.put(f"/api/orders/{oid}/status", headers=ph, json={"status": "completed"})
    assert r.status_code == 400, f"重复完成应被状态机拒绝: {r.status_code}"

    assert _count_tx(oid, "income") == 1, "income 流水应恰好 1 笔"

    txs = client.get("/api/finance/transactions", headers=ph).json()["data"]
    mine = [t for t in txs if t.get("orderNo") == ono and t.get("type") == "income"]
    assert len(mine) == 1 and float(mine[0]["amount"]) == 180.0


def test_cancel_paid_order_single_refund(client):
    """已支付订单取消：refund 流水恰好 1 笔且为负数。"""
    c1 = client.post("/api/auth/login", json={"username": "zhangsan", "role": "client", "password": "123456"}).json()["data"]
    p1 = client.post("/api/auth/login", json={"username": "liujie", "role": "provider", "password": "123456"}).json()["data"]
    ph = {"Authorization": f"Bearer {p1['token']}"}
    ch = {"Authorization": f"Bearer {c1['token']}"}

    order = _create_order(client, c1["token"])
    oid = order["id"]
    client.put(f"/api/orders/{oid}/status", headers=ph, json={"status": "accepted"})
    _set_payment_status(oid, "paid")

    r = client.put(f"/api/orders/{oid}/status", headers=ch, json={"status": "cancelled"})
    assert r.status_code == 200

    n = _count_tx(oid, "refund")
    assert n == 1, f"refund 流水应恰好 1 笔: {n}"
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT amount FROM transactions WHERE order_id = %s AND type = 'refund'", [oid])
            assert float(cur.fetchone()[0]) == -180.0, "退款金额应为负数"
    finally:
        conn.close()


def test_unique_key_blocks_duplicate_rows(client):
    """DB 兜底：同一订单重复插入同 type 流水 / 重复评价被唯一键拦截（1062）。"""
    c1 = client.post("/api/auth/login", json={"username": "zhangsan", "role": "client", "password": "123456"}).json()["data"]
    p1 = client.post("/api/auth/login", json={"username": "liujie", "role": "provider", "password": "123456"}).json()["data"]
    ph = {"Authorization": f"Bearer {p1['token']}"}

    order = _create_order(client, c1["token"])
    oid, ono = order["id"], order["orderNo"]
    for st in ("accepted", "in_progress", "completed"):
        client.put(f"/api/orders/{oid}/status", headers=ph, json={"status": st})
    client.post(f"/api/orders/{oid}/review", headers={"Authorization": f"Bearer {c1['token']}"},
                json={"rating": 5, "content": "唯一键兜底验证"})

    # 重复 income → IntegrityError 1062
    conn = _connect()
    try:
        with conn.cursor() as cur:
            with pytest.raises(pymysql.err.IntegrityError) as ei:
                cur.execute(
                    "INSERT INTO transactions (id, order_id, order_no, type, amount, status, description, created_at) "
                    "VALUES ('tx-dup-test', %s, %s, 'income', 1, 'completed', 'dup', NOW())",
                    [oid, ono],
                )
            assert ei.value.args[0] == 1062
    finally:
        conn.close()

    # 重复评价 → IntegrityError 1062
    conn = _connect()
    try:
        with conn.cursor() as cur:
            with pytest.raises(pymysql.err.IntegrityError) as ei:
                cur.execute(
                    "INSERT INTO reviews (id, order_id, client_id, client_name, provider_id, rating, content, images, service_name, created_at) "
                    "VALUES ('rv-dup-test', %s, 'c1', '张三', 'p1', 4, 'dup', '[]', 'x', NOW())",
                    [oid],
                )
            assert ei.value.args[0] == 1062
    finally:
        conn.close()
