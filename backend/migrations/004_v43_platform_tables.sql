-- V4.3 · 平台功能表（settings / withdrawals / certification_files）+ 查询索引
-- 双轨约定：schema.sql = 全量最新结构（全新部署已含本迁移全部表与索引）；
-- 本迁移供存量库就地升级（与 scripts/migrate_v43.py 等效，表为 IF NOT EXISTS 幂等）。
-- 注意：idx_wd_user / idx_cert_user 在 schema.sql 与 migrate_v43.py 中创建，
-- 本迁移不重复创建（MySQL 无 CREATE INDEX IF NOT EXISTS，重跑会报重复）。

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(50) PRIMARY KEY,
  value VARCHAR(255),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  account_name VARCHAR(50),
  account_no VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  CONSTRAINT fk_wd_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certification_files (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  filename VARCHAR(255),
  file_path VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 通知列表高频查询：按用户 + 未读过滤
CREATE INDEX idx_notifications_user_read ON notifications(user_id, `read`);

-- 提现管理：管理员按状态筛待处理
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
