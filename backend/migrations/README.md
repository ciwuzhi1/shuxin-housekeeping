# 数据库迁移（migrations/）

双轨约定，两者必须同步修改：

- **`backend/schema.sql`**：全量最新结构。全新部署（或 e2e 测试重建测试库）直接执行它，再跑一遍本目录迁移（幂等，只会补记版本）。
- **`backend/migrations/NNN_描述.sql`**：增量变更，只增不改。存量库（如开发库 `housekeeping`、生产库）升级时由迁移脚本按文件名顺序执行：

```bash
backend/.venv/Scripts/python.exe backend/scripts/migrate.py
```

规则：

1. 每次数据库结构修改必须新增一个 `NNN_*.sql`，编号递增、不重号、不改动历史迁移。
2. `schema.sql` 同步更新到最新结构，保证全新部署与存量升级结果一致。
3. 迁移脚本把已应用版本记录在目标库的 `schema_migrations` 表，重复执行自动跳过。
4. MySQL 的 DDL 是隐式提交，无法事务回滚：脚本逐条执行、全部成功才记版本；失败即停止并打印失败语句，修复后重跑（重跑前请人工确认半完成状态）。
