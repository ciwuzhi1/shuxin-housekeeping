"""e2e：v4.5 平台管控——账号封禁闭环、审计日志、登录防爆破。"""

import random

import pymysql

from backend.tests.conftest import TEST_DB

REGISTER_PASSWORD = "123456"


def _login(client, username, role, password="123456"):
    r = client.post("/api/auth/login", json={"username": username, "role": role, "password": password})
    return r


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _admin(client):
    r = _login(client, "admin", "admin", "admin123")
    assert r.status_code == 200
    return r.json()["data"]


def _register(client, role="client"):
    username = f"v45{role[:2]}{random.randint(100000, 999999)}"
    r = client.post("/api/auth/register", json={
        "username": username, "password": REGISTER_PASSWORD, "name": "管控测试", "phone": "13977770000", "role": role,
    })
    assert r.status_code == 200, r.json()
    return username, r.json()["data"]["id"]


def _sql(query, params=None):
    conn = pymysql.connect(host="127.0.0.1", port=3306, user="root", password="root", database=TEST_DB, charset="utf8mb4")
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
        # conn 会随 with 关闭
    finally:
        conn.close()


# ======================== 封禁闭环 ========================


def test_ban_blocks_login_and_existing_tokens(client):
    admin = _admin(client)
    ah = _auth(admin["token"])
    username, uid = _register(client)

    # 封禁前可正常登录
    r = _login(client, username, "client")
    assert r.status_code == 200, f"封禁前登录失败: {r.json()}"

    # 封禁 → 登录 403 ACCOUNT_BANNED
    r = client.put(f"/api/admin/users/{uid}/ban", headers=ah)
    assert r.status_code == 200, r.json()
    r = _login(client, username, "client")
    assert r.status_code == 403 and r.json()["code"] == "ACCOUNT_BANNED"

    # 库内 banned 标记已置位
    assert _sql("SELECT banned FROM users WHERE id=%s", [uid])[0][0] == 1

    # 解封 → 恢复登录
    r = client.put(f"/api/admin/users/{uid}/unban", headers=ah)
    assert r.status_code == 200
    r = _login(client, username, "client")
    assert r.status_code == 200 and r.json()["data"]["token"]
    assert _sql("SELECT banned FROM users WHERE id=%s", [uid])[0][0] == 0


def test_banned_token_rejected_by_require_auth(client):
    admin = _admin(client)
    ah = _auth(admin["token"])
    username, uid = _register(client)

    # 先登录拿到有效 token
    token = _login(client, username, "client").json()["data"]["token"]
    assert client.get("/api/auth/me", headers=_auth(token)).status_code == 200

    # 封禁后同一 token 立即失效
    client.put(f"/api/admin/users/{uid}/ban", headers=ah)
    r = client.get("/api/auth/me", headers=_auth(token))
    assert r.status_code == 401 and r.json()["code"] == "ACCOUNT_BANNED"
    r = client.get("/api/orders", headers=_auth(token))
    assert r.status_code == 401, "被封禁账号的存量 token 应在所有需登录接口失效"


def test_ban_provider_forces_offline_and_notifies(client):
    admin = _admin(client)
    ah = _auth(admin["token"])
    username, uid = _register(client, role="provider")

    # 家政员自己上线
    token = _login(client, username, "provider").json()["data"]["token"]
    r = client.put(f"/api/providers/{uid}/status", headers=_auth(token), json={"status": "online"})
    assert r.status_code == 200

    # 封禁 → banned=1 且强制下线；通知本人
    assert client.put(f"/api/admin/users/{uid}/ban", headers=ah).status_code == 200
    banned, status = _sql("SELECT banned, status FROM users WHERE id=%s", [uid])[0]
    assert banned == 1 and status == "offline"
    notif = _sql("SELECT title FROM notifications WHERE user_id=%s AND title='账号已被封禁'", [uid])
    assert len(notif) == 1


def test_admin_cannot_be_banned(client):
    admin = _admin(client)
    ah = _auth(admin["token"])
    r = client.put("/api/admin/users/a1/ban", headers=ah)
    assert r.status_code == 403 and r.json()["code"] == "ADMIN_BAN_FORBIDDEN"


def test_ban_requires_admin(client):
    c1 = _login(client, "zhangsan", "client").json()["data"]
    r = client.put("/api/admin/users/p1/ban", headers=_auth(c1["token"]))
    assert r.status_code == 403
    r = client.put("/api/admin/users/p1/ban")
    assert r.status_code == 401


def test_double_ban_and_double_unban_rejected(client):
    admin = _admin(client)
    ah = _auth(admin["token"])
    username, uid = _register(client)

    assert client.put(f"/api/admin/users/{uid}/ban", headers=ah).status_code == 200
    r = client.put(f"/api/admin/users/{uid}/ban", headers=ah)
    assert r.status_code == 400 and r.json()["code"] == "ALREADY_BANNED"

    assert client.put(f"/api/admin/users/{uid}/unban", headers=ah).status_code == 200
    r = client.put(f"/api/admin/users/{uid}/unban", headers=ah)
    assert r.status_code == 400 and r.json()["code"] == "NOT_BANNED"


# ======================== 审计日志 ========================


def test_audit_logs_recorded_and_queryable(client):
    admin = _admin(client)
    ah = _auth(admin["token"])
    username, uid = _register(client)

    # 触发三类高危操作
    client.put("/api/providers/p3/verify", headers=ah)                     # provider_verify
    client.put(f"/api/admin/users/{uid}/ban", headers=ah)                  # user_ban
    client.post("/api/notifications", headers=ah, json={                   # notification_send
        "user_id": "c1", "title": "审计测试通知", "content": "audit test", "type": "system"})

    r = client.get("/api/admin/audit-logs", headers=ah)
    assert r.status_code == 200
    body = r.json()
    assert {"page", "size", "total", "totalPages"} <= set(body["pagination"])
    actions = [x["action"] for x in body["data"]]
    for expect in ("provider_verify", "user_ban", "notification_send"):
        assert expect in actions, f"审计日志缺少 {expect}: {actions}"

    # action 过滤
    r = client.get("/api/admin/audit-logs?action=user_ban", headers=ah)
    assert r.json()["data"] and all(x["action"] == "user_ban" for x in r.json()["data"])

    # 越权与未登录
    c1 = _login(client, "zhangsan", "client").json()["data"]
    assert client.get("/api/admin/audit-logs", headers=_auth(c1["token"])).status_code == 403
    assert client.get("/api/admin/audit-logs").status_code == 401


# ======================== 登录防爆破 ========================


def test_login_brute_force_lock(client):
    username, uid = _register(client)

    # 连续 5 次错误密码
    for _ in range(5):
        r = _login(client, username, "client", password="wrong-password")
        assert r.status_code == 401

    # 第 6 次即使密码正确也被锁定
    r = _login(client, username, "client", password=REGISTER_PASSWORD)
    assert r.status_code == 429 and r.json()["code"] == "LOGIN_LOCKED", r.json()

    # 其他账号不受影响
    r = _login(client, "zhangsan", "client")
    assert r.status_code == 200
