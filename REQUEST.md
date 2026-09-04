# REQUEST · 项目需求与配置要求

> 一页看懂:这是什么项目、跑起来需要什么、怎么配。
> 详细配置逐项说明见 **[docs/手册/配置说明.md](docs/手册/配置说明.md)**。

---

## 1. 项目简介

**舒心家政服务平台** —— 覆盖用户端、家政人员端、后台管理端的家政服务平台,前后端分离:

- **前端**:React 18 + TypeScript + Vite 5 + Tailwind CSS 3,React Router v6 角色路由守卫;生产构建关闭 Mock 自动降级
- **后端**:FastAPI (Python 3.12) + MySQL 8.0,JWT 认证,Argon2id 密码哈希,角色 + 资源归属双重校验,订单状态机,财务流水(唯一键幂等),连接池,Service 分层,数据库迁移脚本,安全响应头
- **测试**:pytest 73 项(基线 e2e 36 + 单元测试 + 幂等/安全头/聚合契约用例;独立测试库,覆盖率 87.5%);`npm run build` 0 错误

### 三大角色

| 角色 | 核心功能 | 演示账号 / 密码 |
|------|----------|-----------------|
| 用户端 | 服务浏览、在线预约、订单管理、评价反馈 | zhangsan / 123456 |
| 家政人员端 | 接单服务、排期管理、资质认证、收入中心 | liujie / 123456 |
| 后台管理端 | 数据概览、用户管理、订单管控、财务管理 | admin / admin123 |

### 六大核心模块

服务分类浏览(6 分类 × 21 子服务)、智能匹配预约(三步向导)、订单全流程(创建→确认→服务→完成→评价)、资质认证审核、评价反馈体系(五星评分)、财务管理(收入/流水/提现/佣金)。

---

## 2. 运行环境要求

| 组件 | 版本 | 必需 |
|------|------|------|
| Node.js | >= 18 | ✅ |
| Python | 3.12 | ✅ |
| MySQL | 8.0(本机 3306) | ✅ |

无需 Redis、Docker 等额外组件,一台普通电脑即可完整运行。

---

## 3. 必需配置清单

| 配置项 | 方式 | 说明 |
|--------|------|------|
| 环境变量 | 复制 `.env.example` 为 `.env` | 数据库连接、JWT 密钥、CORS 等 13 项,均有开发默认值 |
| 数据库 | 建 `housekeeping` 库,导入 `backend/schema.sql` | 首次启动后端自动写入种子数据 |
| 依赖 | `npm install` + `pip install -r backend/requirements.txt` | 版本已固定 |

> ⚠️ 真实密钥只放在 `.env`(已被 `.gitignore` 排除)。**生产环境必须更换** `JWT_SECRET`、`PASSWORD_SALT`、`DB_PASSWORD`、`CORS_ORIGIN`。

---

## 4. 快速启动(5 步)

```bash
# 1. 安装前端依赖
npm install

# 2. 创建后端虚拟环境并安装依赖
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 3. 配置环境变量(可先用默认值)
cp .env.example .env

# 4. 初始化数据库(需 MySQL 已运行)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS housekeeping DEFAULT CHARACTER SET utf8mb4;"
mysql -u root -p housekeeping < backend/schema.sql

# 5. 启动(两个终端)
backend/.venv/Scripts/python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 3001
npm run dev
```

验证:`curl http://localhost:3001/api/health`;前端访问 http://localhost:3000,用上方演示账号登录。

---

## 5. 目录结构

```
家政/
├── REQUEST.md            # 本文件:需求与配置要求
├── README.md             # 项目总览与修改记录
├── .env.example          # 环境变量模板(复制为 .env 使用)
├── .gitignore
├── pytest.ini            # pytest 配置(testpaths=backend)
├── package.json          # 前端依赖与脚本
├── src/                  # 前端 (React)
├── backend/
│   ├── requirements.txt  # 后端依赖(版本固定)
│   ├── schema.sql        # 建表脚本(全量最新结构,全新部署用)
│   ├── migrations/       # 增量迁移脚本(存量库升级用)
│   ├── scripts/migrate.py    # 迁移执行器(幂等)
│   ├── e2e_test.py       # 36 项基线 e2e(独立测试库)
│   ├── tests/            # 单元测试 + v4.0 安全/幂等用例
│   └── app/              # FastAPI 应用(routers / services / auth / database …)
└── docs/
    ├── 手册/              # 启动说明、配置说明、测试文档、测试账号
    ├── 架构/              # 后端架构详解
    └── 测试与优化/        # V4.0 优化设计与测试设计文档
```

---

## 6. 文档索引

| 文档 | 内容 |
|------|------|
| [README.md](README.md) | 项目总览、当前状态、修改记录 |
| [docs/手册/配置说明.md](docs/手册/配置说明.md) | **环境变量逐项说明、数据库初始化、常见问题、生产安全清单** |
| [docs/手册/启动说明.md](docs/手册/启动说明.md) | 启动 / 重置 / 测试运行 |
| [docs/手册/测试账号与密码.md](docs/手册/测试账号与密码.md) | 全部种子账号 |
| [docs/手册/测试文档.md](docs/手册/测试文档.md) | 自动化测试与手工回归清单 |
| [docs/架构/后端架构详解.md](docs/架构/后端架构详解.md) | 后端模块与数据链路 |
| [docs/测试与优化/](docs/测试与优化/) | V4.0 优化设计与测试体系规划 |
