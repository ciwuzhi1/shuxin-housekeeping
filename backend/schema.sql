-- 舒心家政 · MySQL 建表脚本
-- 执行: mysql -u root -p housekeeping < schema.sql
-- 注意: 会 DROP 已有同名表(用于全新初始化, 有真实数据时勿执行)

SET NAMES utf8mb4;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS withdrawals;
DROP TABLE IF EXISTS certification_files;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS service_subcategories;
DROP TABLE IF EXISTS service_categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS coupons;

CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  avatar TEXT,
  role VARCHAR(10) NOT NULL,
  password VARCHAR(255),
  age INT,
  gender VARCHAR(10),
  id_card VARCHAR(32),
  experience INT,
  certification_status VARCHAR(20) DEFAULT 'pending',
  status VARCHAR(20) DEFAULT 'offline',
  rating DECIMAL(3,1) DEFAULT 5.0,
  completed_orders INT DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  service_area JSON,
  introduction TEXT,
  skills JSON,
  department VARCHAR(50),
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  address VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_categories (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  description TEXT,
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_subcategories (
  id VARCHAR(32) PRIMARY KEY,
  category_id VARCHAR(32) NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  estimated_duration DECIMAL(5,1),
  CONSTRAINT fk_sub_cat FOREIGN KEY (category_id) REFERENCES service_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id VARCHAR(32) PRIMARY KEY,
  order_no VARCHAR(32) UNIQUE NOT NULL,
  client_id VARCHAR(32) NOT NULL,
  provider_id VARCHAR(32),
  client_name VARCHAR(50) NOT NULL,
  client_phone VARCHAR(20),
  client_address TEXT,
  service_category VARCHAR(50),
  service_name VARCHAR(100),
  service_price DECIMAL(10,2),
  total_hours DECIMAL(5,1),
  total_amount DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  scheduled_date VARCHAR(20),
  scheduled_time VARCHAR(50),
  deadline_time VARCHAR(50),
  special_requirements TEXT,
  rating INT DEFAULT 0,
  review TEXT,
  review_images JSON,
  provider_name VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_client FOREIGN KEY (client_id) REFERENCES users(id),
  CONSTRAINT fk_order_provider FOREIGN KEY (provider_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id VARCHAR(32) PRIMARY KEY,
  order_id VARCHAR(32),
  client_id VARCHAR(32),
  client_name VARCHAR(50),
  client_avatar TEXT,
  provider_id VARCHAR(32),
  provider_name VARCHAR(50),
  rating INT,
  content TEXT,
  images JSON,
  service_name VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders(id),
  UNIQUE KEY uk_review_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
  id VARCHAR(32) PRIMARY KEY,
  order_id VARCHAR(32),
  order_no VARCHAR(32),
  type VARCHAR(20),
  amount DECIMAL(12,2),
  status VARCHAR(20),
  description TEXT,
  withdrawal_id VARCHAR(32),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_order FOREIGN KEY (order_id) REFERENCES orders(id),
  UNIQUE KEY uk_tx_order_type (order_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32),
  title VARCHAR(100),
  content TEXT,
  type VARCHAR(20),
  `read` INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE coupons (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32),
  title VARCHAR(100),
  description TEXT,
  discount DECIMAL(10,2),
  min_amount DECIMAL(12,2),
  status VARCHAR(20) DEFAULT 'unused',
  expire_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 提现申请（pending → paid/rejected；打款时扣余额并写 withdraw 流水）
CREATE TABLE withdrawals (
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

-- 资质认证材料（文件落盘 backend/uploads/，此处存元数据）
CREATE TABLE certification_files (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  doc_type VARCHAR(30) NOT NULL,
  filename VARCHAR(255),
  file_path VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 平台设置（key-value，管理员可改）
CREATE TABLE settings (
  `key` VARCHAR(50) PRIMARY KEY,
  value VARCHAR(255),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_provider ON orders(provider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
-- 复合索引（迁移 002，与 migrations/002_v4_security_indexes.sql 同步维护；
-- migrate.py 对 1061 重复索引幂等，schema.sql 建过后迁移自动跳过）
CREATE INDEX idx_orders_provider_status ON orders(provider_id, status);
CREATE INDEX idx_orders_client_status ON orders(client_id, status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_reviews_provider ON reviews(provider_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_subcategories_category ON service_subcategories(category_id);
CREATE INDEX idx_transactions_order ON transactions(order_id);
CREATE INDEX idx_tx_withdrawal ON transactions(withdrawal_id);
CREATE INDEX idx_wd_user ON withdrawals(user_id);
CREATE INDEX idx_cert_user ON certification_files(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, `read`);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
