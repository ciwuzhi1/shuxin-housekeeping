-- V4.0 · 查询性能索引（对应 docs/测试与优化/舒心家政_V4.0_优化设计文档.md 第 13 节可行子集）
-- 说明：流水表无 provider_id 列（按 JOIN orders 过滤），文档建议的
-- idx_transactions_provider_created 不可行，此处以实际查询路径为准补复合索引。

CREATE INDEX idx_orders_provider_status ON orders(provider_id, status);

CREATE INDEX idx_orders_client_status ON orders(client_id, status);

CREATE INDEX idx_transactions_created ON transactions(created_at);
