# 舒心家政服务平台

> 自然语言驱动的 Vibe Coding 项目实践 — 覆盖用户端、家政人员端、后台管理端的家政服务平台

<!-- 推送到 GitHub 后取消注释并替换 <owner>/<repo> 即可显示 CI 徽章（Gitee 不运行 GitHub Actions）
[![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/<repo>/actions/workflows/ci.yml)
-->

## 项目概览

通过自然语言描述家政平台业务流程，AI 生成代码。平台涵盖三大角色、六大功能模块，采用前后端分离架构。

### 三大角色

| 角色 | 核心功能 | 登录账号 / 密码 |
|------|----------|----------------|
| 用户端 | 服务浏览、在线预约、订单管理、评价反馈 | zhangsan / 123456 |
| 家政人员端 | 接单服务、排期管理、资质认证、收入中心 | liujie / 123456 |
| 后台管理端 | 数据概览、用户管理、订单管控、财务管理 | admin / admin123 |

### 六大核心模块

- 服务分类浏览（6 大分类 × 21 项子服务）
- 智能匹配预约（三步向导）
- 订单全流程（创建→确认→服务→完成→评价）
- 资质认证系统（管理员审核）
- 评价反馈体系（五星评分，影响评分）
- 财务管理（收入、流水、提现、佣金）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind 3 |
| 路由 | React Router v6（角色守卫） |
| 后端 | **FastAPI + Python 3.12**（uvicorn），端口 3001，Service 分层（订单已迁入 `services/`） |
| 数据库 | **MySQL 8.0**（本机，库名 `housekeeping`），迁移脚本 `backend/scripts/migrate.py` |
| 认证 | JWT (PyJWT) + **Argon2id 密码哈希**（存量 SHA-256 哈希登录成功后自动升级） |
| 校验 | Pydantic v2 |
| 通信 | Vite Proxy /api → :3001；生产构建关闭 Mock 自动降级 |
| 测试 | pytest 59 项（26 基线 e2e + 单元测试 + v4.0 安全/幂等用例） |

> 2026-08-05 后端迁移完成：**Express + SQL.js → FastAPI + MySQL**。原 Node 后端 `server/` 已删除，前端 API 契约（`{success,data,message}` + camelCase + Bearer JWT）保持不变。

---

## 项目结构

```
家政/
├── README.md            # 本文件
├── REQUEST.md           # 项目需求与配置要求（GitHub 访客一页看懂）
├── .env.example         # 环境变量模板（复制为 .env 使用，.env 不入仓库）
├── pytest.ini           # pytest 配置（testpaths=backend）
├── docs/                # 文档（两层）
│   ├── 架构/
│   │   └── 后端架构详解.md        # 架构与模块说明
│   ├── 手册/
│   │   ├── 启动说明.md            # 启动/重置/e2e 运行
│   │   ├── 配置说明.md            # 环境变量逐项说明/数据库初始化/常见问题/生产安全清单
│   │   ├── 测试账号与密码.md
│   │   └── 测试文档.md            # 自动化测试 + 手工清单
│   └── 测试与优化/
│       └── 舒心家政_V4.0_*.md     # V4.0 优化设计与测试体系规划
├── backend/             # 后端 (FastAPI + MySQL，依赖见 requirements.txt)
│   ├── app/services/    # 业务服务层（订单业务已迁入，路由只留 HTTP 编排）
│   ├── migrations/      # 增量迁移脚本（NNN_*.sql，存量库升级用）
│   ├── scripts/migrate.py  # 迁移执行器（schema_migrations 版本表，幂等）
│   ├── e2e_test.py      # 26 项基线 e2e（独立测试库）
│   ├── tests/           # v4.0 新增：单元测试 + 安全/幂等 e2e（conftest 复用测试库机制）
│   └── schema.sql       # 全量最新建表脚本（全新部署用）
└── src/                 # 前端 (React)
```

---

## 快速开始

### 环境要求
- Node.js >= 18（前端）
- Python 3.12（后端，已有 venv `backend/.venv`）
- MySQL 8.0 本机运行（库 `housekeeping`；连接账号通过 `.env` 配置，开发默认 root/root）

### 0. 环境变量（可选，开发用默认值即可跑通）

```bash
cp .env.example .env   # 按需修改数据库账号 / JWT 密钥 / CORS 等，逐项说明见 docs/手册/配置说明.md
```

### 1. 后端启动

```bash
# 首次：创建虚拟环境并安装依赖（已配置好则跳过）
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 启动后端（MySQL 需在 3306 运行）
cd 家政
backend/.venv/Scripts/python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 3001
```

### 2. 前端启动

```bash
npm install
npm run dev
```

### 3. 验证

```bash
curl http://localhost:3001/api/health
```

访问地址：前端 http://localhost:3000 ｜ 后端 http://localhost:3001

详细启动/重置/测试说明见 `docs/手册/启动说明.md`。

---

## ✅ 当前状态（2026-08-29 v4.0 第一批后）

| 状态 | 说明 |
|------|------|
| ✅ 可运行 | 前后端可正常启动，pytest 59 项全部通过（26 基线 e2e + 33 项单测/新增用例） |
| ✅ 密码校验 | 登录必须提交正确密码；**v4.0 起新哈希为 Argon2id**，存量 SHA-256 哈希兼容校验、首次登录成功自动升级 |
| ✅ 财务幂等 | transactions 加 `(order_id, type)` 唯一键、reviews 加 `order_id` 唯一键（v4.0），配合状态机/条件更新防重复结算与重复评价 |
| ✅ 抢单并发 | 乐观并发控制（以原状态为条件更新，冲突 409）；评价更新加 `rating=0` 条件防并发双写 |
| ✅ 迁移机制 | v4.0 新增 `migrations/` + `migrate.py`（版本表 + 幂等），存量库不再需要删库重建；开发库已应用 002/003 |
| ✅ Service 分层 | 订单业务（创建/状态流转/评价）已迁入 `backend/app/services/order_service.py`，路由只留 HTTP 编排 |
| ✅ 安全加固 | 后端统一添加 X-Content-Type-Options / X-Frame-Options / Referrer-Policy；轻量访问日志（request_id/耗时，不记录敏感信息） |
| ✅ Mock 降级治理 | 生产构建关闭 Mock 自动降级（登录/下单如实报错），开发环境行为不变 |
| ✅ 越权修复 | 用户只能读/改自己的数据（IDOR 已修复，403 拦截）；财务接口按角色过滤 |
| ✅ 金额可信 | 下单金额由服务端按服务目录价校验并重算，客户端无法篡改订单金额 |
| ✅ 数据落库 | 评价写入 reviews 表、订单完成生成 income 流水 |
| ✅ 构建通过 | `npm run build` 通过（tsc 0 错误 + vite build 成功） |
| ✅ CI 门禁 | v4.2 起 push/PR 自动执行 ruff + pip-audit + pytest(覆盖率≥83%) + 前端构建；npm audit 首轮告警观察 |

**迁移前缺陷（密码不校验/越权/不落库/构建失败）已在 v3.0 修复；v3.5 完成缺陷修复批次；v4.0 第一批完成 Argon2id/迁移机制/Service 层/财务幂等（详见下文"修改记录"）。**

---

## 开发命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 前端（:3000） |
| `backend/.venv/Scripts/python.exe -m uvicorn backend.app.main:app --port 3001` | 后端（:3001） |
| `backend/.venv/Scripts/python.exe -m pytest backend -v` | 全量测试（基线 e2e 26 项 + 单测/新增 33 项，独立测试库） |
| `backend/.venv/Scripts/python.exe -m pytest backend/e2e_test.py -v` | 仅基线 e2e（26 项） |
| `backend/.venv/Scripts/python.exe -m pytest backend -q --cov=backend/app --cov-fail-under=83` | 测试 + 覆盖率门禁（当前 83%） |
| `backend/.venv/Scripts/python.exe backend/scripts/migrate.py` | 数据库增量迁移（幂等，存量库升级） |
| `backend/.venv/Scripts/python.exe -m ruff check backend` | 后端 lint（规则见 pyproject.toml） |
| `backend/.venv/Scripts/python.exe -m pip_audit` | Python 依赖漏洞审计 |
| `npm audit --audit-level=high` | 前端依赖漏洞审计（本地镜像可能不支持，CI 内有效） |
| `npm run build` | `tsc -b && vite build`（**已通过**） |

> 以上 lint/审计/测试/构建五类检查即 CI（`.github/workflows/ci.yml`）的全部内容，push / PR 自动执行；本地预演通过同一组命令。

---

## 修改记录

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.0 | - | 三端页面 + Mock 数据 |
| v1.1 | - | Express 后端 + RESTful API |
| v1.2 | - | SQLite 数据库 |
| v1.3 | - | 按钮交互修复 + 字段映射 + 智能降级 |
| v2.0 | 2026-07-29 | JWT 认证链路 + useApiData Hook + 数据修复 |
| 审计 | 2026-08-05 | 文档重构：新增 `docs/`，如实记录安全/正确性/构建现状 |
| **v3.0** | **2026-08-05** | **后端迁移 FastAPI + MySQL：修复密码校验/越权/数据落库，构建通过，删除 Node 后端** |
| **v3.1** | **2026-08-05** | **代码/文档清理：删除 11 个未调用 API 方法、4 处死代码、未用类型/依赖，移除 3 份迁移前文档** |
| **v3.2** | **2026-08-05** | **三端联动修复：家政员可看可抢待接单；客户取消/评价、后台订单/人员/用户/流水全部改为真实 API；恢复误删的 API 方法** |
| **v3.3** | **2026-08-05** | **通知系统联动：下单/接单/完成/评价/取消自动生成对应角色通知（含资金转入转出）；前端通知铃铛实时未读数 + 下拉面板 + 已读/全部已读 + 15 秒轮询** |
| **v3.4** | **2026-08-07** | **预约主流程真实化：预约页接入真实分类/在线家政员 API（Mock 降级带提示）；下单携带家政员（指定即生效）；接单归属校验 + 乐观并发防抢单；家政员收入报表修复（本月收入、仅本人流水）；新增 2 个 e2e 用例，20/20 通过** |
| **v3.5** | **2026-08-14** | **缺陷修复批次：① 封禁公开注册管理员（role 限 client/provider，前端移除管理员注册入口）；② 下单金额服务端按目录价校验/重算，杜绝篡改；③ 财务接口按角色过滤（客户 403、家政员仅本人、管理员全量）；④ 公开接口隐藏家政员余额（仅本人/管理员可见）；⑤ 新增 /api/auth/me，修复刷新页面即登出；⑥ 注册失败如实报错（不再伪装成功）；⑦ 个人中心/服务分类页/后台最新订单接入真实 API；⑧ 抢单池订单详情可见、家政员 recentOrders 最新在前、后台待退款统计改查支付状态列；⑨ 修复种子数据卡死订单 o4/o8 与 o5 状态矛盾（含正式库定向修复）；⑩ 修复退款金额双负号、本月收入误显示、排期日视图匹配、toISOString 时区错位等前端问题；新增 6 个 e2e 回归用例，26/26 通过** |
| **v3.6** | **2026-08-29** | **GitHub 开源准备：① 新增 REQUEST.md（需求与配置要求一页说明）与 docs/手册/配置说明.md（环境变量逐项说明/数据库初始化/常见问题/生产安全清单）；② 新增 .env.example 环境变量模板，config.py 经 python-dotenv 可选加载根目录 .env（不覆盖已设变量），真实密钥不入仓库；③ 新增 .gitignore（排除 node_modules/.venv/日志/pytest 缓存/.env 等）；④ requirements.txt 固定实测版本并补充用途注释** |
| **v4.0a** | **2026-08-30** | **V4.0 第一批优化（按 docs/测试与优化/ P0 清单）：① 密码安全升级 Argon2id（argon2-cffi），存量 SHA-256 哈希兼容校验、首次登录成功自动重哈希；② 财务幂等：transactions 加 (order_id,type) 唯一键、reviews 加 order_id 唯一键，评价更新加 rating=0 条件修复并发双写；③ 轻量迁移机制：migrations/ + scripts/migrate.py（schema_migrations 版本表，幂等），开发库已应用 002 索引/003 唯一键；④ Service 层第一步：订单业务迁入 services/order_service.py，orders 路由瘦身为 HTTP 编排（26 项基线 e2e 零变化通过）；⑤ 数据库复合索引（orders provider+status / client+status、transactions created_at）；⑥ 安全响应头 + [req] 访问日志中间件（不记录 token/密码/querystring）；⑦ 前端生产构建关闭 Mock 自动降级（useApiData/AuthContext/Booking 三处，开发行为不变）；⑧ 测试 26→59：新增单元测试（密码/JWT/状态机/分页）、旧哈希升级 e2e、财务幂等与安全头用例** |
| **v4.2a** | **2026-08-30** | **工程化第一批：① GitHub Actions CI（.github/workflows/ci.yml）：后端 job（MySQL 8.0 服务容器 + ruff + pip-audit + pytest 覆盖率门禁 83%）与前端 job（npm ci + build + npm audit 观察模式），push/PR 触发；② 质量工具：ruff（规则集 E4/E7/E9/F/I，pyproject.toml 配置，存量 10 处违规清零）+ pytest-cov（当前 83.2%）+ pip-audit（零漏洞）固定进 requirements.txt；③ 顺手修复 order_no 3 位随机数在同日期多订单下碰撞唯一键导致的测试偶发失败（扩为 6 位）** |

---

## 已知问题与待办

> 2026-08-05 代码清理后记录。此处为**有意保留或待确认**的事项，非缺陷审计。

| 事项 | 状态 | 说明 |
|------|------|------|
| 页面占位提示 | 有意保留 | "报表导出/地址管理/安全设置/通知面板开发中"等 `alert` 为功能占位，非死代码 |
| 提现/拒单/禁用/认证上传 | 有意保留 | v3.5 已对相关操作做诚实化提示（明确"演示占位/未实际生效"），完整流转需新增后端能力 |
| `.claude/settings.local.json` | 已忽略 | 已加入 `.gitignore`，不会进入仓库 |
| 密钥管理 | 已配置 | 环境变量经 `.env` 注入（见 `.env.example`），`.env` 不入仓库；生产须更换全部默认密钥 |
| 密码哈希 | 已升级 | v4.0 起新哈希为 Argon2id（argon2-cffi）；存量 SHA-256 哈希兼容校验并在首次登录成功后自动升级；`PASSWORD_SALT` 仅用于旧哈希校验 |
| Mock 降级 | 生产已关闭 | 生产构建 API 失败进入错误态（登录/下单如实报错）；开发环境保留 Mock 降级便于演示；页面级错误 UI 与"本地 Mock"标签清理属后续批次 |
| Repository 层 / 其他路由 Service 化 | 待办 | 订单已迁 Service；admin.stats/finance.summary 的 N+1 聚合下推、Repository 抽取、Vitest、CI 属 V4.0 后续批次 |
