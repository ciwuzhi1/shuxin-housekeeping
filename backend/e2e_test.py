"""FastAPI 后端 E2E 测试（pytest + httpx + TestClient）。

覆盖：原 Node 版 e2e-test.mjs 的 24 项 happy path + 新增安全断言
（密码校验 / 越权读改 / 公开接口鉴权 / 评价与流水落库）。

设计：
- 使用独立测试库 housekeeping_test（启动时 DROP+重建），不污染开发库 housekeeping
- 关闭限流（RATE_LIMIT_MAX=100000），避免测试被 429 干扰
- TestClient 同进程触发 lifespan（init_db + ensure_seed），与 Node 版同进程模式一致

运行：cd 家政 && backend/.venv/Scripts/python.exe -m pytest backend/e2e_test.py -v
"""

import os
import pathlib
import sys

# ========== 必须在导入应用模块之前设置环境变量 ==========
TEST_DB = "housekeeping_test"
os.environ["DB_NAME"] = TEST_DB
os.environ["RATE_LIMIT_MAX"] = "100000"          # 关闭限流
os.environ["JWT_SECRET"] = "e2e-test-secret-key-2026-must-be-long-enough"
os.environ["PASSWORD_SALT"] = "e2e-test-salt-2026"

import pymysql
import pytest
from fastapi.testclient import TestClient

# 保证 from backend.app.main import app 可用（无论 cwd 在何处）
_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_PROJECT_ROOT))

from backend.app.main import app  # noqa: E402

# MySQL 连接信息（本机开发环境 root/root，见 backend/app/config.py）
_DB_HOST = "127.0.0.1"
_DB_PORT = 3306
_DB_USER = "root"
_DB_PASSWORD = "root"


def _split_sql(script: str) -> list[str]:
    """按 ';' 拆分 schema.sql，跳过注释行与空行。"""
    stmts: list[str] = []
    cur: list[str] = []
    for line in script.splitlines():
        line = line.strip()
        if not line or line.startswith("--"):
            continue
        cur.append(line)
        if cur and cur[-1].endswith(";"):
            stmts.append("\n".join(cur).rstrip().rstrip(";"))
            cur = []
    if cur:
        stmts.append("\n".join(cur))
    return stmts


def _setup_test_db() -> None:
    """重建测试库并执行 schema.sql（含 DROP，安全幂等）。"""
    conn = pymysql.connect(host=_DB_HOST, port=_DB_PORT, user=_DB_USER, password=_DB_PASSWORD, charset="utf8mb4")
    with conn.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
        cur.execute(f"CREATE DATABASE {TEST_DB} DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci")
    conn.commit()
    conn.close()

    conn = pymysql.connect(
        host=_DB_HOST, port=_DB_PORT, user=_DB_USER, password=_DB_PASSWORD, charset="utf8mb4", database=TEST_DB
    )
    schema = (_PROJECT_ROOT / "backend" / "schema.sql").read_text(encoding="utf-8")
    with conn.cursor() as cur:
        for stmt in _split_sql(schema):
            if stmt:
                cur.execute(stmt)
    conn.commit()
    conn.close()


def _teardown_test_db() -> None:
    conn = pymysql.connect(host=_DB_HOST, port=_DB_PORT, user=_DB_USER, password=_DB_PASSWORD, charset="utf8mb4")
    with conn.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    conn.commit()
    conn.close()


@pytest.fixture(scope="session")
def client():
    _setup_test_db()
    with TestClient(app) as c:
        yield c
    _teardown_test_db()


# ======================== 工具函数 ========================

def login(client, username: str, role: str, password: str = "123456") -> dict:
    r = client.post("/api/auth/login", json={"username": username, "role": role, "password": password})
    assert r.status_code == 200, f"登录失败 {username}/{role}: {r.json()}"
    return r.json()["data"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_order(client, token: str, client_id: str = "c1", amount: float = 180.0) -> dict:
    # 金额一致性：服务端按 目录价 × totalHours 重算，这里用 1 小时使 amount 与单价一致
    r = client.post(
        "/api/orders",
        headers=auth(token),
        json={
            "clientId": client_id, "clientName": "张三", "clientPhone": "13800138001",
            "clientAddress": "北京市朝阳区建国路88号", "serviceCategory": "日常保洁",
            "serviceName": "普通日常保洁", "servicePrice": amount, "totalHours": 1,
            "totalAmount": amount, "scheduledDate": "2026-08-10", "scheduledTime": "09:00-11:00",
        },
    )
    assert r.status_code == 201, f"下单失败: {r.json()}"
    return r.json()["data"]


# ======================== A. 密码校验（核心安全修复） ========================

def test_login_without_password_rejected(client):
    """不带密码登录必须被拒绝（Node 版漏洞：任意密码/无密码可登录）。"""
    r = client.post("/api/auth/login", json={"username": "zhangsan", "role": "client"})
    assert r.status_code in (401, 422)
    assert r.json()["success"] is False


def test_login_wrong_password_rejected(client):
    r = client.post("/api/auth/login", json={"username": "zhangsan", "role": "client", "password": "wrongpass"})
    assert r.status_code == 401
    assert r.json()["code"] == "INVALID_PASSWORD"


def test_login_correct_password_succeeds(client):
    data = login(client, "zhangsan", "client")
    assert data["token"]
    assert data["id"] == "c1"


def test_login_admin_succeeds(client):
    data = login(client, "admin", "admin", password="admin123")
    assert data["token"]
    assert data["id"] == "a1"


# ======================== B. 订单 happy path（镜像 Node 24 项核心） ========================

def test_order_flow_happy_path(client):
    c1 = login(client, "zhangsan", "client")
    p1 = login(client, "liujie", "provider")

    # 下单
    order = _create_order(client, c1["token"])
    order_id = order["id"]

    # 归属校验：不能替他人下单
    r = client.post(
        "/api/orders",
        headers=auth(c1["token"]),
        json={
            "clientId": "c2", "clientName": "李四", "clientPhone": "13800138002",
            "clientAddress": "地址", "serviceCategory": "日常保洁", "serviceName": "普通日常保洁",
            "servicePrice": 180, "totalHours": 2, "totalAmount": 180,
            "scheduledDate": "2026-08-10", "scheduledTime": "09:00-11:00",
        },
    )
    assert r.status_code == 403, f"替他人下单应被拒: {r.status_code}"

    # 家政员接单 pending→accepted
    r = client.put(f"/api/orders/{order_id}/status", headers=auth(p1["token"]),
                   json={"status": "accepted", "providerName": "刘姐"})
    assert r.status_code == 200

    # 非法流转 in_progress→accepted 被拒
    client.put(f"/api/orders/{order_id}/status", headers=auth(p1["token"]), json={"status": "in_progress"})
    r = client.put(f"/api/orders/{order_id}/status", headers=auth(p1["token"]), json={"status": "accepted"})
    assert r.status_code == 400, f"非法流转应被拒: {r.status_code}"

    # 完成订单（结算家政员）
    r = client.put(f"/api/orders/{order_id}/status", headers=auth(p1["token"]), json={"status": "completed"})
    assert r.status_code == 200

    # 评价
    r = client.post(f"/api/orders/{order_id}/review", headers=auth(c1["token"]),
                    json={"rating": 5, "content": "服务很好，非常满意！"})
    assert r.status_code == 200

    # 重复评价被拒
    r = client.post(f"/api/orders/{order_id}/review", headers=auth(c1["token"]),
                    json={"rating": 4, "content": "再次评价"})
    assert r.status_code == 400

    # 他人不能评价
    lisi = login(client, "lisi", "client")
    r = client.post(f"/api/orders/{order_id}/review", headers=auth(lisi["token"]),
                    json={"rating": 1, "content": "恶意评价"})
    assert r.status_code in (403, 400), f"他人评价应被拒: {r.status_code}"


def test_order_with_assigned_provider(client):
    """P0：预约指定家政员 → 订单归属该家政员；他人不能抢占。"""
    c1 = login(client, "zhangsan", "client")
    p1 = login(client, "liujie", "provider")
    p2 = login(client, "wangyi", "provider")

    # 指定 p1 下单
    r = client.post(
        "/api/orders",
        headers=auth(c1["token"]),
        json={
            "clientId": "c1", "clientName": "张三", "clientPhone": "13800138001",
            "clientAddress": "北京市朝阳区建国路88号", "serviceCategory": "日常保洁",
            "serviceName": "普通日常保洁", "servicePrice": 180, "totalHours": 2,
            "totalAmount": 360, "scheduledDate": "2026-08-11", "scheduledTime": "09:00-11:00",
            "providerId": "p1",
        },
    )
    assert r.status_code == 201, f"指定家政员下单失败: {r.json()}"
    oid = r.json()["data"]["id"]

    detail = client.get(f"/api/orders/{oid}", headers=auth(c1["token"])).json()["data"]
    assert detail["providerId"] == "p1", f"订单未归属指定家政员: {detail}"

    # 其他家政员不能抢占该订单
    r = client.put(f"/api/orders/{oid}/status", headers=auth(p2["token"]),
                   json={"status": "accepted", "providerName": "王姨"})
    assert r.status_code == 403, f"他人应不能抢占已指定订单: {r.status_code}"

    # 被指定的家政员可正常接单
    r = client.put(f"/api/orders/{oid}/status", headers=auth(p1["token"]),
                   json={"status": "accepted", "providerName": "刘姐"})
    assert r.status_code == 200, f"指定家政员接单应成功: {r.json()}"


def test_order_with_invalid_provider_rejected(client):
    """P0：指定不在线/未认证的家政员应被拒绝。"""
    c1 = login(client, "zhangsan", "client")
    payload = {
        "clientId": "c1", "clientName": "张三", "clientPhone": "13800138001",
        "clientAddress": "地址", "serviceCategory": "日常保洁", "serviceName": "普通日常保洁",
        "servicePrice": 180, "totalHours": 2, "totalAmount": 360,
        "scheduledDate": "2026-08-11", "scheduledTime": "09:00-11:00",
        "providerId": "p3",  # 小李：离线 + 待认证
    }
    r = client.post("/api/orders", headers=auth(c1["token"]), json=payload)
    assert r.status_code == 400, f"指定未认证/不在线家政员应被拒: {r.status_code}"


def test_complete_settles_provider(client):
    """完成订单后：家政员余额 + 金额、完成数 +1、income 流水落库。"""
    c1 = login(client, "zhangsan", "client")
    p1 = login(client, "liujie", "provider")

    # 余额为敏感字段，现仅登录用户/管理员可见，读取时携带本人 token
    before = client.get("/api/providers/p1", headers=auth(p1["token"])).json()["data"]
    balance_before = float(before["balance"])
    completed_before = int(before["completedOrders"])

    order = _create_order(client, c1["token"], amount=180.0)
    oid, ono = order["id"], order["orderNo"]
    for st in ("accepted", "in_progress", "completed"):
        client.put(f"/api/orders/{oid}/status", headers=auth(p1["token"]), json={"status": st})

    after = client.get("/api/providers/p1", headers=auth(p1["token"])).json()["data"]
    assert float(after["balance"]) == balance_before + 180.0, "家政员余额未 +180"
    assert int(after["completedOrders"]) == completed_before + 1, "家政员完成数未 +1"

    # income 流水落库（按 orderNo 精确定位）
    tx = client.get("/api/finance/transactions", headers=auth(p1["token"])).json()["data"]
    mine = [t for t in tx if t.get("orderNo") == ono]
    assert len(mine) == 1 and float(mine[0]["amount"]) == 180.0, f"income 流水未生成: {mine}"


def test_review_persists_to_reviews_table(client):
    """评价必须双写 reviews 表（Node 版缺陷：评价不落 reviews 表）。"""
    c1 = login(client, "zhangsan", "client")
    p1 = login(client, "liujie", "provider")
    order = _create_order(client, c1["token"])
    oid = order["id"]
    for st in ("accepted", "in_progress", "completed"):
        client.put(f"/api/orders/{oid}/status", headers=auth(p1["token"]), json={"status": st})
    client.post(f"/api/orders/{oid}/review", headers=auth(c1["token"]),
                json={"rating": 5, "content": "落库验证评价"})

    revs = client.get("/api/reviews", headers=auth(c1["token"])).json()["data"]
    mine = [x for x in revs if x.get("orderId") == oid]
    assert len(mine) == 1, "评价未写入 reviews 表"
    assert mine[0]["rating"] == 5 and "落库验证评价" in mine[0]["content"]


# ======================== C. 越权防护 ========================

def test_idor_client_read_other_client_orders(client):
    login(client, "zhangsan", "client")
    c2 = login(client, "lisi", "client")
    r = client.get("/api/client/c1/orders", headers=auth(c2["token"]))
    assert r.status_code == 403, f"越权读取应被拒: {r.status_code}"


def test_idor_client_cancel_other_order(client):
    c1 = login(client, "zhangsan", "client")
    c2 = login(client, "lisi", "client")
    order = _create_order(client, c1["token"])
    r = client.put(f"/api/orders/{order['id']}/status", headers=auth(c2["token"]), json={"status": "cancelled"})
    assert r.status_code == 403, f"越权取消应被拒: {r.status_code}"


def test_protected_endpoints_require_auth(client):
    r = client.get("/api/orders")
    assert r.status_code == 401

    r = client.get("/api/client/c1/orders")
    assert r.status_code == 401

    r = client.put("/api/providers/p1/status", json={"status": "offline"})
    assert r.status_code == 401, "未登录切换家政员上下线应被拒（Node 版公开漏洞）"


def test_client_cannot_toggle_provider_status(client):
    c1 = login(client, "zhangsan", "client")
    r = client.put("/api/providers/p1/status", headers=auth(c1["token"]), json={"status": "offline"})
    assert r.status_code == 403


def test_client_cannot_access_admin_api(client):
    c1 = login(client, "zhangsan", "client")
    r = client.get("/api/admin/stats", headers=auth(c1["token"]))
    assert r.status_code == 403


def test_non_admin_cannot_verify_provider(client):
    p1 = login(client, "liujie", "provider")
    r = client.put("/api/providers/p3/verify", headers=auth(p1["token"]))
    assert r.status_code == 403


# ======================== D. 管理员与统计 ========================

def test_admin_flow(client):
    admin = login(client, "admin", "admin", password="admin123")

    stats = client.get("/api/admin/stats", headers=auth(admin["token"]))
    assert stats.status_code == 200
    assert stats.json()["data"]["totalRevenue"] > 0

    users = client.get("/api/admin/users", headers=auth(admin["token"]))
    assert users.status_code == 200
    assert len(users.json()["data"]) == 8

    # 审核家政员
    r = client.put("/api/providers/p3/verify", headers=auth(admin["token"]))
    assert r.status_code == 200
    p3 = client.get("/api/providers/p3").json()["data"]
    assert p3["certificationStatus"] == "verified"

    # 收入统计
    p1 = login(client, "liujie", "provider")
    earnings = client.get("/api/provider/p1/earnings", headers=auth(p1["token"]))
    assert earnings.status_code == 200
    assert isinstance(earnings.json()["data"]["totalEarnings"], (int, float))


# ======================== E. 查询接口 ========================

def test_public_endpoints(client):
    r = client.get("/api/categories")
    assert r.status_code == 200 and len(r.json()["data"]) == 6

    r = client.get("/api/providers")
    assert r.status_code == 200 and len(r.json()["data"]) == 4


def test_order_list_pagination(client):
    admin = login(client, "admin", "admin", password="admin123")
    r = client.get("/api/orders?page=1&size=5", headers=auth(admin["token"]))
    assert r.status_code == 200
    assert r.json()["pagination"]["page"] == 1
    assert r.json()["pagination"]["total"] >= 9


def test_register_new_client(client):
    import random
    r = client.post("/api/auth/register", json={
        "username": f"newuser{random.randint(1000, 9999)}",
        "password": "abc123456",
        "name": "测试用户",
        "phone": "13800138099",
        "role": "client",
    })
    assert r.status_code == 200, f"注册失败: {r.json()}"
    assert r.json()["success"] is True


def test_register_duplicate_username_rejected(client):
    r = client.post("/api/auth/register", json={
        "username": "zhangsan", "password": "abc123456", "name": "重复", "phone": "13800138111", "role": "client",
    })
    assert r.status_code == 409


# ======================== F. v3.5 缺陷修复回归（2026-08-14） ========================

def test_register_admin_rejected(client):
    """v3.5：任何人可注册管理员账号的漏洞——公开注册 admin 必须被拒。"""
    r = client.post("/api/auth/register", json={
        "username": "eviladmin", "password": "hack123", "name": "恶意", "phone": "13800000001", "role": "admin",
    })
    assert r.status_code in (400, 422), f"公开注册 admin 应被拒: {r.status_code} {r.json()}"


def test_order_amount_tampering_rejected(client):
    """v3.5：订单金额由服务端按目录价校验/重算，客户端篡改被拒。"""
    c1 = login(client, "zhangsan", "client")
    ah = auth(c1["token"])
    base = {
        "clientId": "c1", "clientName": "张三", "clientPhone": "13800138001",
        "clientAddress": "地址", "serviceCategory": "日常保洁", "serviceName": "普通日常保洁",
        "scheduledDate": "2026-08-30", "scheduledTime": "09:00",
    }
    # 篡改单价
    r = client.post("/api/orders", headers=ah, json={**base, "servicePrice": 0.01, "totalHours": 2, "totalAmount": 0.01})
    assert r.status_code == 400, f"篡改单价应被拒: {r.status_code}"
    # 单价与目录价不一致
    r = client.post("/api/orders", headers=ah, json={**base, "servicePrice": 999, "totalHours": 1, "totalAmount": 999})
    assert r.status_code == 400, f"目录价不一致应被拒: {r.status_code}"
    # 正常下单：totalAmount 由服务端重算为 180×2=360
    r = client.post("/api/orders", headers=ah, json={**base, "servicePrice": 180, "totalHours": 2, "totalAmount": 1})
    assert r.status_code == 201, f"正常下单失败: {r.json()}"
    oid = r.json()["data"]["id"]
    det = client.get(f"/api/orders/{oid}", headers=ah).json()["data"]
    assert float(det["totalAmount"]) == 360.0, f"金额应由服务端重算为 360: {det['totalAmount']}"


def test_finance_role_filtering(client):
    """v3.5：财务接口按角色过滤——客户 403；家政员仅本人流水；汇总仅 admin。"""
    c1 = login(client, "zhangsan", "client")
    p1 = login(client, "liujie", "provider")
    r = client.get("/api/finance/transactions", headers=auth(c1["token"]))
    assert r.status_code == 403, f"客户看全平台流水应被拒: {r.status_code}"
    r = client.get("/api/finance/summary", headers=auth(c1["token"]))
    assert r.status_code == 403, f"客户看财务汇总应被拒: {r.status_code}"

    r = client.get("/api/finance/transactions", headers=auth(p1["token"]))
    assert r.status_code == 200
    txs = r.json()["data"]
    assert all(t["type"] in ("income", "refund") for t in txs), f"家政员流水应仅本人 income/refund: {[t['type'] for t in txs]}"
    r = client.get("/api/finance/summary", headers=auth(p1["token"]))
    assert r.status_code == 403, f"家政员看平台汇总应被拒: {r.status_code}"

    admin = login(client, "admin", "admin", password="admin123")
    r = client.get("/api/finance/summary", headers=auth(admin["token"]))
    assert r.status_code == 200, "admin 应可见财务汇总"


def test_provider_balance_visibility(client):
    """v3.5：余额为敏感字段——未登录/他人不可见，本人与 admin 可见。"""
    r = client.get("/api/providers")
    assert all(p.get("balance") is None for p in r.json()["data"]), "公开列表不应包含余额"
    r = client.get("/api/providers/p1")
    assert r.json()["data"].get("balance") is None, "未登录详情不应包含余额"

    p1 = login(client, "liujie", "provider")
    r = client.get("/api/providers/p1", headers=auth(p1["token"]))
    assert r.json()["data"].get("balance") is not None, "本人应可见自己的余额"

    admin = login(client, "admin", "admin", password="admin123")
    r = client.get("/api/providers", headers=auth(admin["token"]))
    assert all(p.get("balance") is not None for p in r.json()["data"]), "admin 列表应可见余额"


def test_auth_me_endpoint(client):
    """v3.5：/api/auth/me 凭 token 恢复会话；无 token 401。"""
    r = client.get("/api/auth/me")
    assert r.status_code == 401, "无 token 应 401"
    c1 = login(client, "zhangsan", "client")
    r = client.get("/api/auth/me", headers=auth(c1["token"]))
    assert r.status_code == 200
    assert r.json()["data"]["id"] == "c1", f"me 应返回当前用户: {r.json()}"


def test_grab_pool_order_detail_visible(client):
    """v3.5：抢单池（未分配 pending）订单列表可见，详情也应可看（此前 403）。"""
    c1 = login(client, "zhangsan", "client")
    order = _create_order(client, c1["token"])
    oid = order["id"]
    p1 = login(client, "liujie", "provider")
    r = client.get(f"/api/orders/{oid}", headers=auth(p1["token"]))
    assert r.status_code == 200, f"抢单池订单详情应可看: {r.status_code} {r.text[:120]}"


# ======================== G. v4.3 新能力回归（设置/通知/提现/资质/趋势/改密） ========================

def test_admin_settings_roundtrip(client):
    """系统设置：admin 可读写；未知键被拒；client 403。"""
    admin = login(client, "admin", "admin", password="admin123")
    r = client.get("/api/admin/settings", headers=auth(admin["token"]))
    assert r.status_code == 200
    assert r.json()["data"]["platform_name"], "应包含默认平台名称"

    r = client.put("/api/admin/settings", headers=auth(admin["token"]), json={"platform_name": "舒心家政", "service_radius": "12"})
    assert r.status_code == 200 and r.json()["data"]["service_radius"] == "12"

    r = client.put("/api/admin/settings", headers=auth(admin["token"]), json={"evil_key": "x"})
    assert r.status_code == 400, "未知设置键应被拒绝"

    c1 = login(client, "zhangsan", "client")
    r = client.get("/api/admin/settings", headers=auth(c1["token"]))
    assert r.status_code == 403, "非 admin 不可读写设置"


def test_admin_send_notification(client):
    """管理员发送通知真实落库，接收方可读；provider 发送被拒。"""
    admin = login(client, "admin", "admin", password="admin123")
    c1 = login(client, "zhangsan", "client")
    p1 = login(client, "liujie", "provider")

    r = client.post("/api/notifications", headers=auth(admin["token"]),
                    json={"userId": "c1", "title": "测试通知", "content": "e2e 发送", "type": "system"})
    assert r.status_code == 200

    r = client.get("/api/notifications", headers=auth(c1["token"]))
    assert any(n["title"] == "测试通知" for n in r.json()["data"]), "接收方应看到通知"

    r = client.post("/api/notifications", headers=auth(p1["token"]),
                    json={"userId": "c1", "title": "x", "content": "y"})
    assert r.status_code == 403, "非 admin 不可发送通知"

    r = client.post("/api/notifications", headers=auth(admin["token"]),
                    json={"userId": "nope", "title": "x", "content": "y"})
    assert r.status_code == 404, "目标用户不存在应 404"


def test_withdrawal_full_flow(client):
    """提现闭环：申请(余额校验) → admin 打款(扣余额+流水) → 驳回分支。"""
    p1 = login(client, "liujie", "provider")
    admin = login(client, "admin", "admin", password="admin123")

    bal_before = client.get("/api/providers/p1", headers=auth(p1["token"])).json()["data"]["balance"]

    # 超额申请被拒
    r = client.post("/api/provider/p1/withdrawals", headers=auth(p1["token"]),
                    json={"amount": 999999, "accountName": "测试", "accountNo": "y"})
    assert r.status_code == 400

    # 正常申请
    r = client.post("/api/provider/p1/withdrawals", headers=auth(p1["token"]),
                    json={"amount": 100, "accountName": "建设银行 ****1234", "accountNo": "6227"})
    assert r.status_code == 200
    wid = r.json()["data"]["id"]

    # client 不可见提现列表
    c1 = login(client, "zhangsan", "client")
    r = client.get("/api/finance/withdrawals", headers=auth(c1["token"]))
    assert r.status_code == 403

    # 打款：余额扣减 + withdraw 流水 completed
    r = client.post(f"/api/finance/withdrawals/{wid}/pay", headers=auth(admin["token"]))
    assert r.status_code == 200
    bal_after = client.get("/api/providers/p1", headers=auth(p1["token"])).json()["data"]["balance"]
    assert float(bal_after) == float(bal_before) - 100, f"余额应扣减 100: {bal_before} -> {bal_after}"
    txs = client.get("/api/finance/transactions?type=withdraw", headers=auth(admin["token"])).json()["data"]
    assert any(t["status"] == "completed" and float(t["amount"]) == -100 for t in txs), "应产生 completed 提现流水"

    # 已处理的申请不可重复打款
    r = client.post(f"/api/finance/withdrawals/{wid}/pay", headers=auth(admin["token"]))
    assert r.status_code == 400


def test_withdrawal_reject_flow(client):
    """驳回：状态 rejected + 对应 pending 流水作废 + 通知本人。"""
    p2 = login(client, "wangyi", "provider")
    admin = login(client, "admin", "admin", password="admin123")
    r = client.post("/api/provider/p2/withdrawals", headers=auth(p2["token"]),
                    json={"amount": 50, "accountName": "工商银行 ****5678", "accountNo": "6222"})
    assert r.status_code == 200
    wid = r.json()["data"]["id"]
    r = client.post(f"/api/finance/withdrawals/{wid}/reject", headers=auth(admin["token"]))
    assert r.status_code == 200
    lst = client.get("/api/finance/withdrawals", headers=auth(admin["token"])).json()["data"]
    mine = [w for w in lst if w["id"] == wid]
    assert mine and mine[0]["status"] == "rejected"
    # 未登录不可见
    r = client.get("/api/finance/withdrawals")
    assert r.status_code == 401


def test_certification_upload_and_permission(client):
    """资质上传：本人可传（落盘+落库），他人不可传，非法类型被拒。"""
    import base64

    p3 = login(client, "xiaoli", "provider")
    b64 = base64.b64encode(b"e2e-cert-file").decode()
    r = client.post("/api/providers/p3/certifications", headers=auth(p3["token"]),
                    json={"docType": "skill_cert", "filename": "cert.txt", "dataBase64": b64})
    assert r.status_code == 200
    file_path = r.json()["data"]["filePath"]
    assert file_path.startswith("/uploads/p3/")
    assert os.path.exists(os.path.join(_PROJECT_ROOT, "backend", "uploads", file_path[len("/uploads/"):].replace("/", os.sep))), "文件应落盘"

    r = client.get("/api/providers/p3/certifications", headers=auth(p3["token"]))
    assert r.status_code == 200 and any(f["docType"] == "skill_cert" for f in r.json()["data"])

    c1 = login(client, "zhangsan", "client")
    r = client.post("/api/providers/p3/certifications", headers=auth(c1["token"]),
                    json={"docType": "skill_cert", "filename": "x.txt", "dataBase64": b64})
    assert r.status_code == 403, "非本人不可上传他人材料"

    r = client.post("/api/providers/p3/certifications", headers=auth(p3["token"]),
                    json={"docType": "hacker", "filename": "x.txt", "dataBase64": b64})
    assert r.status_code in (400, 422), "非法材料类型应被拒"

    # 提交新材料后认证状态重置为 pending，且管理员收到通知
    status = client.get("/api/providers/p3", headers=auth(p3["token"])).json()["data"]["certificationStatus"]
    assert status == "pending"
    admin = login(client, "admin", "admin", password="admin123")
    notifs = client.get("/api/notifications", headers=auth(admin["token"])).json()["data"]
    assert any("资质审核待处理" in n["title"] for n in notifs)


def test_verify_provider_notifies(client):
    """审核通过后应向家政员本人发送通知。"""
    admin = login(client, "admin", "admin", password="admin123")
    r = client.put("/api/providers/p3/verify", headers=auth(admin["token"]))
    assert r.status_code == 200
    p3 = login(client, "xiaoli", "provider")
    notifs = client.get("/api/notifications", headers=auth(p3["token"])).json()["data"]
    assert any("资质审核通过" in n["title"] for n in notifs), "审核结果应通知本人"


def test_provider_earnings_trends(client):
    """收入趋势：week/month/year 三组真实聚合数据。"""
    p1 = login(client, "liujie", "provider")
    r = client.get("/api/provider/p1/earnings", headers=auth(p1["token"]))
    assert r.status_code == 200
    trends = r.json()["data"]["trends"]
    assert set(trends.keys()) == {"week", "month", "year"}
    assert len(trends["week"]) == 7 and len(trends["year"]) == 12
    assert all("label" in d and "amount" in d for d in trends["week"])
    # 周合计应等于年合计中本月以后无收入时的真实收入（宽松断言：年合计 >= 周合计）
    assert sum(d["amount"] for d in trends["year"]) >= sum(d["amount"] for d in trends["week"]) - 0.01

    # 他人不可见
    p2 = login(client, "wangyi", "provider")
    r = client.get("/api/provider/p1/earnings", headers=auth(p2["token"]))
    assert r.status_code == 400


def test_change_password_flow(client):
    """修改密码：旧密码错误被拒；改密后新密码可登录（测试内改回）。"""
    p2 = login(client, "wangyi", "provider")
    token = p2["token"]

    r = client.put("/api/auth/password", headers=auth(token), json={"oldPassword": "wrong", "newPassword": "newpass66"})
    assert r.status_code == 400, "旧密码错误应 400"

    r = client.put("/api/auth/password", headers=auth(token), json={"oldPassword": "123456", "newPassword": "123456"})
    assert r.status_code == 400, "新密码不能与原密码相同"

    r = client.put("/api/auth/password", headers=auth(token), json={"oldPassword": "123456", "newPassword": "newpass66"})
    assert r.status_code == 200
    r = client.post("/api/auth/login", json={"username": "wangyi", "role": "provider", "password": "newpass66"})
    assert r.status_code == 200, "新密码应可登录"
    # 改回，避免影响其他用例
    r = client.put("/api/auth/password", headers=auth(r.json()["data"]["token"]),
                   json={"oldPassword": "newpass66", "newPassword": "123456"})
    assert r.status_code == 200
    r = client.post("/api/auth/login", json={"username": "wangyi", "role": "provider", "password": "123456"})
    assert r.status_code == 200


def test_withdrawal_transaction_linkage(client):
    """v4.3b：提现流水通过 withdrawal_id 精确关联（不再按金额模糊匹配）。"""
    import pymysql

    p1 = login(client, "liujie", "provider")
    admin = login(client, "admin", "admin", password="admin123")

    r = client.post("/api/provider/p1/withdrawals", headers=auth(p1["token"]),
                    json={"amount": 66, "accountName": "建设银行 ****1234", "accountNo": "6227"})
    assert r.status_code == 200
    wid = r.json()["data"]["id"]

    r = client.post(f"/api/finance/withdrawals/{wid}/pay", headers=auth(admin["token"]))
    assert r.status_code == 200

    conn = pymysql.connect(host="127.0.0.1", port=3306, user="root", password="root", database=TEST_DB)
    cur = conn.cursor()
    cur.execute("SELECT status, withdrawal_id FROM transactions WHERE withdrawal_id = %s", [wid])
    rows_ = cur.fetchall()
    conn.close()
    assert rows_, "打款流水应通过 withdrawal_id 关联"
    assert all(r[1] == wid for r in rows_), "关联字段应等于申请 id"


def test_order_list_includes_provider_phone(client):
    """订单列表/详情返回 providerPhone（联系双方功能数据来源）。"""
    admin = login(client, "admin", "admin", password="admin123")
    r = client.get("/api/orders", headers=auth(admin["token"]))
    assert r.status_code == 200
    assigned = [o for o in r.json()["data"] if o.get("providerId")]
    assert assigned, "种子数据中应有已分配订单"
    assert any(o.get("providerPhone") for o in assigned), "已分配订单应带家政员电话"
