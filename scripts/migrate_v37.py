"""增量迁移：v3.7 新增 settings / withdrawals / certification_files 三张表 + 种子。

用途：已有数据的老库就地升级（不删库）。新库直接执行 schema.sql 即可，无需本脚本。
执行：cd 家政 && backend/.venv/Scripts/python.exe scripts/migrate_v37.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pymysql.err import OperationalError  # noqa: E402

from backend.app.database import execute, get_conn, init_db, row, rows  # noqa: E402
from backend.app.seed import CERT_FILES, SETTINGS, WITHDRAWALS  # noqa: E402

DDL = [
    """CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  account_name VARCHAR(50),
  account_no VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  CONSTRAINT fk_wd_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS certification_files (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  filename VARCHAR(255),
  file_path VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(50) PRIMARY KEY,
  value VARCHAR(255),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
]

INDEXES = [
    "CREATE INDEX idx_wd_user ON withdrawals(user_id)",
    "CREATE INDEX idx_cert_user ON certification_files(user_id)",
]


def main() -> None:
    init_db()
    for ddl in DDL:
        get_conn().cursor().execute(ddl)
    for idx in INDEXES:
        try:
            get_conn().cursor().execute(idx)
        except OperationalError as e:
            if e.args and e.args[0] == 1061:  # duplicate key name
                pass
            else:
                raise

    # 种子（幂等：仅在对应表为空时写入）
    if (row("SELECT COUNT(*) AS c FROM settings") or {}).get("c", 0) == 0:
        for kv in SETTINGS:
            execute("INSERT INTO settings (`key`, value) VALUES (%s, %s)", list(kv))
        print(f"settings: 写入 {len(SETTINGS)} 条")
    if (row("SELECT COUNT(*) AS c FROM withdrawals") or {}).get("c", 0) == 0:
        for w in WITHDRAWALS:
            execute(
                "INSERT INTO withdrawals (id, user_id, amount, account_name, account_no, status, created_at, processed_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                list(w),
            )
        print(f"withdrawals: 写入 {len(WITHDRAWALS)} 条")
    if (row("SELECT COUNT(*) AS c FROM certification_files") or {}).get("c", 0) == 0:
        for cf in CERT_FILES:
            execute(
                "INSERT INTO certification_files (id, user_id, doc_type, filename, file_path) VALUES (%s,%s,%s,%s,%s)",
                list(cf),
            )
        print(f"certification_files: 写入 {len(CERT_FILES)} 条")

    for t in ["settings", "withdrawals", "certification_files"]:
        c = (row(f"SELECT COUNT(*) AS c FROM {t}") or {}).get("c", 0)
        print(f"{t}: {c} 行")
    _ = rows  # 保持 import 一致性
    print("迁移完成")


if __name__ == "__main__":
    main()
