"""轻量数据库迁移脚本（零第三方新依赖，仅 pymysql + 项目 config）。

用法:
    backend/.venv/Scripts/python.exe backend/scripts/migrate.py

行为:
- 按文件名顺序执行 backend/migrations/NNN_*.sql
- 已应用版本记录在目标库 schema_migrations 表，重复执行自动跳过
- MySQL DDL 为隐式提交，无法事务回滚：逐条执行，一组迁移的语句全部成功
  才记录版本；任一语句失败立即停止并打印失败语句与错误，退出码 1
  （修复后重跑；重跑前请人工确认半完成状态，必要时先手工清理）
- 数据库连接读取 backend/app/config.py 的环境变量/.env（DB_HOST/DB_PORT/DB_USER/
  DB_PASSWORD/DB_NAME），数据库本身须已存在
"""

import pathlib
import sys

_PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import pymysql  # noqa: E402

from backend.app.config import settings  # noqa: E402

MIGRATIONS_DIR = _PROJECT_ROOT / "backend" / "migrations"


def _split_sql(script: str) -> list[str]:
    """按 ';' 拆分 SQL 文件，跳过注释行与空行（与 e2e_test.py 同逻辑）。"""
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


def main() -> int:
    files = sorted(p for p in MIGRATIONS_DIR.glob("*.sql"))

    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        charset="utf8mb4",
        autocommit=True,
    )
    applied: list[str] = []
    skipped: list[str] = []
    try:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version VARCHAR(64) PRIMARY KEY, "
                "applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
            )
            cur.execute("SELECT version FROM schema_migrations")
            done = {r["version"] if isinstance(r, dict) else r[0] for r in cur.fetchall()}

        for path in files:
            version = path.name
            if version in done:
                skipped.append(version)
                continue
            statements = _split_sql(path.read_text(encoding="utf-8"))
            print(f"[apply] {version} ({len(statements)} statements)")
            with conn.cursor() as cur:
                for stmt in statements:
                    try:
                        cur.execute(stmt)
                    except Exception:
                        print(f"[error] {version} 执行失败，语句如下:\n  {stmt}\n")
                        raise
                    print(f"  ok: {stmt.splitlines()[0][:72]}")
                cur.execute("INSERT INTO schema_migrations (version) VALUES (%s)", [version])
            applied.append(version)
    finally:
        conn.close()

    print()
    print(f"applied: {len(applied)}  {applied}")
    print(f"skipped: {len(skipped)}  {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
