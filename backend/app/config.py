"""应用配置中心（读取环境变量，与 Node 版 config.ts 对应）。"""

import os

from dotenv import load_dotenv

# 可选加载项目根目录 .env（存在才生效，且不覆盖已设置的环境变量）
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"))


class Settings:
    # 服务端
    PORT: int = int(os.getenv("PORT", "3001"))

    # 数据库（MySQL）
    DB_HOST: str = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "root")
    DB_NAME: str = os.getenv("DB_NAME", "housekeeping")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "housekeeping-platform-dev-secret-2026")
    JWT_EXPIRES: int = int(os.getenv("JWT_EXPIRES", "86400"))  # 24h，秒

    # 密码哈希：固定盐 + SHA-256（简单方案，见文档）
    PASSWORD_SALT: str = os.getenv("PASSWORD_SALT", "housekeeping-salt-2026")

    # 分页
    PAGE_SIZE: int = int(os.getenv("PAGE_SIZE", "20"))
    MAX_PAGE_SIZE: int = int(os.getenv("MAX_PAGE_SIZE", "100"))

    # 限流（次/分钟）
    RATE_LIMIT_MAX: int = int(os.getenv("RATE_LIMIT_MAX", "200"))

    # 登录防爆破（v4.5）：同 IP+用户名在 LOGIN_LOCK_SECONDS 窗口内
    # 连续失败 LOGIN_MAX_FAILS 次即锁定
    LOGIN_MAX_FAILS: int = int(os.getenv("LOGIN_MAX_FAILS", "5"))
    LOGIN_LOCK_SECONDS: int = int(os.getenv("LOGIN_LOCK_SECONDS", "600"))

    # CORS
    CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "http://localhost:3000")

    # 接口文档（/docs /redoc /openapi.json）：默认关闭，生产不建议开启
    ENABLE_DOCS: bool = os.getenv("ENABLE_DOCS", "false").lower() in ("1", "true", "yes")


settings = Settings()
