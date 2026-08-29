"""e2e：安全响应头（V4.0 第 10 节）。"""

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


def test_security_headers_on_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    for k, v in SECURITY_HEADERS.items():
        assert r.headers.get(k) == v, f"缺少安全头 {k}: {r.headers.get(k)!r}"


def test_security_headers_on_error_response(client):
    """4xx 错误响应同样必须带安全头。"""
    r = client.get("/api/orders")  # 未登录 → 401
    assert r.status_code == 401
    for k, v in SECURITY_HEADERS.items():
        assert r.headers.get(k) == v
