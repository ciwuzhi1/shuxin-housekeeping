-- V4.3b · 数据一致性强化
-- 1) transactions 增加 withdrawal_id：提现流水与提现申请精确关联，
--    替代打款时"按金额匹配"的脆弱更新，杜绝同金额误伤
-- 2) orders.provider_id 补外键（与 client 侧 fk_order_client 对齐）

ALTER TABLE transactions ADD COLUMN withdrawal_id VARCHAR(32) NULL;

-- 存量数据回填：按 金额+状态 匹配提现申请（种子数据 w1↔t7 pending、w2↔t6 completed）
UPDATE transactions t JOIN withdrawals w
  ON ABS(t.amount) = w.amount
 AND t.type = 'withdraw'
 AND t.status = IF(w.status = 'pending', 'pending', 'completed')
SET t.withdrawal_id = w.id
WHERE t.withdrawal_id IS NULL;

CREATE INDEX idx_tx_withdrawal ON transactions(withdrawal_id);

-- 家政员外键（存量为空或合法 p1..p4，可直接添加）
ALTER TABLE orders ADD CONSTRAINT fk_order_provider FOREIGN KEY (provider_id) REFERENCES users(id);
