-- V4.6 · 客服工单（联系客服真实化：留言工单 + 管理员回复 + 通知）

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  order_no VARCHAR(32) DEFAULT '',
  category VARCHAR(20) DEFAULT 'consult',
  content TEXT NOT NULL,
  contact_phone VARCHAR(20) DEFAULT '',
  status VARCHAR(20) DEFAULT 'open',
  reply TEXT,
  replied_by VARCHAR(32) DEFAULT '',
  replied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_st_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_st_user ON support_tickets(user_id);

CREATE INDEX idx_st_status ON support_tickets(status);
