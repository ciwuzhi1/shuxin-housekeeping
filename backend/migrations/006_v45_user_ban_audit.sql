-- V4.5 · 平台管控：账号封禁 + 审计日志
-- 1) users.banned：管理员封禁标记（封禁后无法登录、存量 token 立即失效）
-- 2) audit_logs：高危操作留痕（封禁/解封、审核、提现打款/驳回、发通知、设置保存）

ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(32) PRIMARY KEY,
  actor_id VARCHAR(32) NOT NULL,
  actor_name VARCHAR(50) DEFAULT '',
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(30) DEFAULT '',
  target_id VARCHAR(32) DEFAULT '',
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_audit_actor ON audit_logs(actor_id);

CREATE INDEX idx_audit_action ON audit_logs(action);

CREATE INDEX idx_audit_created ON audit_logs(created_at);
