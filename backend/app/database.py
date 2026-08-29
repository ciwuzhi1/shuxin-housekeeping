"""MySQL 数据层（PyMySQL 连接池）。

对应 Node 版 database.ts，保持调用约定：
- 存储层 snake_case 列名，对外统一 camelCase（to_camel 自动转换）
- 读写均使用参数化 SQL，避免注入
- transaction(fn) 包装 START TRANSACTION/COMMIT/ROLLBACK
- JSON 列（skills/service_area/review_images/images）读取时自动解析
"""

import json
import re

import pymysql
from dbutils.pooled_db import PooledDB
from pymysql.cursors import DictCursor

from .config import settings

_pool: PooledDB | None = None


def init_db() -> None:
    global _pool
    if _pool is None:
        _pool = PooledDB(
            creator=pymysql,
            maxconnections=20,
            mincached=1,
            blocking=True,
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=True,
        )


def get_conn():
    if _pool is None:
        init_db()
    return _pool.connection()


def _camel(key: str) -> str:
    return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), key)


def _maybe_json(value):
    """对形如 JSON 的字符串做解析（兜底：若驱动已解析则原样返回）。"""
    if isinstance(value, str) and value and value[0] in "[{":
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value
    return value


def to_camel(d: dict | None) -> dict | None:
    if not d:
        return d
    return {_camel(k): _maybe_json(v) for k, v in d.items()}


def rows(sql: str, params: list | tuple | None = None, conn=None) -> list:
    own = conn is None
    if own:
        conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [to_camel(r) for r in cur.fetchall()]
    finally:
        if own:
            conn.close()


def row(sql: str, params: list | tuple | None = None, conn=None) -> dict | None:
    own = conn is None
    if own:
        conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            r = cur.fetchone()
            return to_camel(r) if r else None
    finally:
        if own:
            conn.close()


def execute(sql: str, params: list | tuple | None = None, conn=None) -> dict:
    """执行写操作（INSERT/UPDATE/DELETE），返回 changes 与 lastInsertRowid。"""
    own = conn is None
    if own:
        conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return {"changes": cur.rowcount, "lastInsertRowid": cur.lastrowid}
    finally:
        if own:
            conn.close()


def transaction(fn):
    """在事务中执行写操作序列（原子性）。fn 接收 conn，内部用 rows/row/execute 时传 conn=conn。"""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("START TRANSACTION")
        result = fn(conn)
        with conn.cursor() as cur:
            cur.execute("COMMIT")
        return result
    except Exception:
        try:
            with conn.cursor() as cur:
                cur.execute("ROLLBACK")
        except Exception:
            pass
        raise
    finally:
        conn.close()


def parse_pagination(page_raw: str | int | None, size_raw: str | int | None) -> dict:
    """分页辅助：解析 page/size 并校验边界。"""
    try:
        page = max(1, int(page_raw or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        size = int(size_raw or settings.PAGE_SIZE)
    except (TypeError, ValueError):
        size = settings.PAGE_SIZE
    size = min(max(1, size), settings.MAX_PAGE_SIZE)
    return {"page": page, "size": size, "limit": size, "offset": (page - 1) * size}
