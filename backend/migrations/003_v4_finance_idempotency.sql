-- V4.0 · 财务幂等唯一键（对应 docs/测试与优化/舒心家政_V4.0_优化设计文档.md 第 12 节）
-- 每个订单每种流水类型最多一条（order_id 为 NULL 的提现/佣金等行不受唯一约束）。
-- 注意：若存量库中已有重复数据，本迁移会失败，需先人工去重。

ALTER TABLE transactions ADD UNIQUE KEY uk_tx_order_type (order_id, type);

ALTER TABLE reviews ADD UNIQUE KEY uk_review_order (order_id);
