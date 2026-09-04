"""e2e：V4.4a 聚合下推后的响应契约与 limit 上限保护。

行为契约：admin.stats / finance.summary / provider.stats / client.stats 的
响应字段与取值必须与种子数据直算一致（聚合下推零行为变化的固化断言）。
"""

import pymysql

from backend.tests.conftest import TEST_DB


def _login(client, username, role, password="123456") -> dict:
    r = client.post("/api/auth/login", json={"username": username, "role": role, "password": password})
    assert r.status_code == 200, f"登录失败 {username}: {r.json()}"
    return r.json()["data"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _sum_completed() -> tuple[int, float]:
    """直连测试库直算 completed 订单数与金额合计（契约基准）。"""
    conn = pymysql.connect(host="127.0.0.1", port=3306, user="root", password="root", database=TEST_DB, charset="utf8mb4")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*), COALESCE(SUM(total_amount),0) FROM orders WHERE status='completed'")
            n, s = cur.fetchone()
            return int(n), float(s)
    finally:
        conn.close()


def test_admin_stats_contract(client):
    admin = _login(client, "admin", "admin", "admin123")
    data = client.get("/api/admin/stats", headers=_auth(admin["token"])).json()["data"]

    # 字段齐全性（下推后响应结构不变）
    for key in ("totalUsers", "totalProviders", "totalOrders", "totalRevenue", "monthlyActiveUsers",
                "averageRating", "newUsersToday", "pendingCertifications", "pendingRefunds",
                "orderTrend", "userGrowth", "serviceDistribution"):
        assert key in data, f"admin.stats 缺少字段 {key}"

    # 取值与种子直算一致
    n, s = _sum_completed()
    assert data["totalOrders"] >= n
    assert abs(data["totalRevenue"] - s) < 0.01, f"totalRevenue 应等于 completed 金额合计 {s}: {data['totalRevenue']}"
    assert data["totalUsers"] == 3 and data["totalProviders"] == 4  # 种子 c1-c3 / p1-p4
    assert data["pendingCertifications"] == 1  # p3 待认证
    assert isinstance(data["monthlyActiveUsers"], int) and data["monthlyActiveUsers"] >= 1


def test_finance_summary_contract(client):
    admin = _login(client, "admin", "admin", "admin123")
    data = client.get("/api/finance/summary", headers=_auth(admin["token"])).json()["data"]

    for key in ("totalRevenue", "monthlyRevenue", "pendingPayout", "completedOrders",
                "averageOrderValue", "commissionRate", "revenueByMonth", "revenueByCategory"):
        assert key in data, f"finance.summary 缺少字段 {key}"

    n, s = _sum_completed()
    assert data["completedOrders"] == n
    assert abs(data["totalRevenue"] - s) < 0.01
    # 空态安全：pendingPayout 为非负数
    assert data["pendingPayout"] >= 0


def test_provider_client_stats_contract(client):
    p1 = _login(client, "liujie", "provider")
    stats = client.get("/api/provider/p1/stats", headers=_auth(p1["token"])).json()["data"]
    for key in ("totalOrders", "completedOrders", "pendingOrders", "inProgressOrders", "totalEarnings"):
        assert key in stats
    assert stats["totalOrders"] == stats["completedOrders"] + stats["pendingOrders"] + stats["inProgressOrders"] + 1  # +1: o9 cancelled

    c1 = _login(client, "zhangsan", "client")
    cstats = client.get("/api/client/c1/stats", headers=_auth(c1["token"])).json()["data"]
    for key in ("totalOrders", "completedOrders", "totalSpent"):
        assert key in cstats
    assert cstats["totalSpent"] >= 0


def test_list_limit_capped(client):
    """reviews / finance transactions 的 limit 参数有上限保护（MAX_PAGE_SIZE=100）。"""
    c1 = _login(client, "zhangsan", "client")
    r = client.get("/api/reviews?limit=1000000", headers=_auth(c1["token"]))
    assert r.status_code == 200
    assert len(r.json()["data"]) <= 100, "reviews limit 应被钳制到 MAX_PAGE_SIZE"

    p1 = _login(client, "liujie", "provider")
    r = client.get("/api/finance/transactions?limit=1000000", headers=_auth(p1["token"]))
    assert r.status_code == 200
    assert len(r.json()["data"]) <= 100, "transactions limit 应被钳制到 MAX_PAGE_SIZE"
