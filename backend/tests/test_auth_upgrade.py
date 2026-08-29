"""e2e：旧格式密码哈希（SHA-256+固定盐）登录成功后自动升级为 Argon2id。"""

import hashlib
import os
import random

import pymysql
import pytest

_TEST_DB = os.environ.get("HOUSEKEEPING_TEST_DB", "housekeeping_test")
_SALT = os.environ["PASSWORD_SALT"]


def _legacy_hash(password: str) -> str:
    return hashlib.sha256((_SALT + password).encode("utf-8")).hexdigest()


def _connect():
    return pymysql.connect(
        host="127.0.0.1", port=3306, user="root", password="root", database=_TEST_DB, charset="utf8mb4"
    )


def _set_legacy_password(username: str, role: str, password: str) -> None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password = %s WHERE username = %s AND role = %s",
                [_legacy_hash(password), username, role],
            )
        conn.commit()
    finally:
        conn.close()


def _get_hash(username: str, role: str) -> str | None:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password FROM users WHERE username = %s AND role = %s", [username, role])
            r = cur.fetchone()
            return r[0] if r else None
    finally:
        conn.close()


def _register(client, username: str, password: str) -> None:
    r = client.post("/api/auth/register", json={
        "username": username, "password": password, "name": "升级测试", "phone": "13877770000", "role": "client",
    })
    assert r.status_code == 200, f"注册失败: {r.json()}"


def test_legacy_password_hash_auto_upgrade(client):
    username = f"legacy{random.randint(10000, 99999)}"
    password = "abc123456"
    _register(client, username, password)
    _set_legacy_password(username, "client", password)
    assert _get_hash(username, "client") == _legacy_hash(password)

    # 旧哈希 + 正确密码 → 登录成功
    r = client.post("/api/auth/login", json={"username": username, "role": "client", "password": password})
    assert r.status_code == 200, f"旧哈希登录失败: {r.json()}"
    assert r.json()["data"]["token"]

    # 登录成功后哈希已自动升级为 Argon2id
    upgraded = _get_hash(username, "client")
    assert upgraded is not None and upgraded.startswith("$argon2id$")

    # 升级后的 Argon2id 哈希可继续正常登录
    r = client.post("/api/auth/login", json={"username": username, "role": "client", "password": password})
    assert r.status_code == 200


def test_legacy_hash_wrong_password_rejected(client):
    username = f"legacy{random.randint(10000, 99999)}"
    password = "abc123456"
    _register(client, username, password)
    _set_legacy_password(username, "client", password)

    r = client.post("/api/auth/login", json={"username": username, "role": "client", "password": "wrong"})
    assert r.status_code == 401
    assert r.json()["code"] == "INVALID_PASSWORD"
    # 登录失败不得触发升级
    assert _get_hash(username, "client") == _legacy_hash(password)


def test_seed_passwords_use_argon2(client):
    """种子账号从一开始就应是 Argon2id 哈希。"""
    h = _get_hash("zhangsan", "client")
    assert h is not None and h.startswith("$argon2id$")


@pytest.mark.parametrize("username,role,password", [
    ("zhangsan", "client", "123456"),
    ("liujie", "provider", "123456"),
    ("admin", "admin", "admin123"),
])
def test_seed_accounts_can_login(client, username, role, password):
    r = client.post("/api/auth/login", json={"username": username, "role": role, "password": password})
    assert r.status_code == 200
