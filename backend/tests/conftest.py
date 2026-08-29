"""backend/tests 公共夹具：独立测试库 + TestClient（机制与 backend/e2e_test.py 一致）。

- 环境变量在导入应用模块前设置：测试库 housekeeping_test、关闭限流、测试专用 JWT/盐
- 会话级夹具 DROP+重建测试库并执行 schema.sql，不污染开发库 housekeeping
- 与 e2e_test.py 同会话运行时：本夹具在 e2e 用例之后重建数据库并重置连接池，
  保证 tests/ 下用例拿到干净的种子数据
"""

import os
import pathlib
import sys

# 测试库名可用环境变量覆盖（并行测试隔离用）；默认与 e2e_test.py 相同
TEST_DB = os.environ.get("HOUSEKEEPING_TEST_DB", "housekeeping_test")
os.environ["DB_NAME"] = TEST_DB
os.environ["RATE_LIMIT_MAX"] = "100000"          # 关闭限流
os.environ["JWT_SECRET"] = "e2e-test-secret-key-2026-must-be-long-enough"
os.environ["PASSWORD_SALT"] = "e2e-test-salt-2026"

_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import pymysql  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.app import database  # noqa: E402
from backend.app.main import app  # noqa: E402

# MySQL 连接信息（本机开发环境，见 backend/app/config.py）
_DB_HOST = "127.0.0.1"
_DB_PORT = 3306
_DB_USER = "root"
_DB_PASSWORD = "root"


def _split_sql(script: str) -> list[str]:
    """按 ';' 拆分 schema.sql，跳过注释行与空行（与 e2e_test.py 同逻辑）。"""
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


def _rebuild_test_db() -> None:
    """DROP+重建测试库并执行 schema.sql（含 DROP，安全幂等）。"""
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


@pytest.fixture(scope="session")
def client():
    """重建测试库 → 重置连接池 → 启动 TestClient（lifespan 自动写入种子数据）。"""
    _rebuild_test_db()
    database.close_pool()
    with TestClient(app) as c:
        yield c

    conn = pymysql.connect(host=_DB_HOST, port=_DB_PORT, user=_DB_USER, password=_DB_PASSWORD, charset="utf8mb4")
    with conn.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    conn.commit()
    conn.close()
