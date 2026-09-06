"""pydantic 请求校验模型（对应 Node 版 validators.ts）。

字段名使用 snake_case，但通过 alias_generator 接收 camelCase 输入（与前端契约一致）。
"""

import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["client", "provider", "admin"]


def _to_camel(s: str) -> str:
    return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), s)


class APIModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True)


# ======================== 认证 ========================
class LoginIn(APIModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=100)  # 新增：必须携带密码
    role: Role


class RegisterIn(APIModel):
    username: str = Field(min_length=2, max_length=20)
    password: str = Field(min_length=6, max_length=100)
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")
    # 安全修复：禁止公开注册 admin（管理员只能由系统预置/内部创建）
    role: Literal["client", "provider"] = "client"


# ======================== 服务人员 ========================
class ProviderStatusIn(APIModel):
    status: Literal["online", "offline"]


# ======================== 订单 ========================
class OrderCreate(APIModel):
    client_id: str = Field(min_length=1)
    client_name: str = Field(min_length=1, max_length=50)
    client_phone: str = Field(pattern=r"^1[3-9]\d{9}$")
    client_address: str = Field(min_length=1, max_length=200)
    service_category: str = Field(min_length=1, max_length=50)
    service_name: str = Field(min_length=1, max_length=100)
    service_price: float = Field(gt=0)
    total_hours: float = Field(gt=0)
    total_amount: float = Field(gt=0)
    scheduled_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    scheduled_time: str = Field(min_length=1)
    special_requirements: Optional[str] = Field(default=None, max_length=500)
    # P0 修复：预约可指定家政员；不指定则走"智能匹配/抢单"
    provider_id: Optional[str] = Field(default=None, min_length=1, max_length=32)
    provider_name: Optional[str] = Field(default=None, max_length=50)


class OrderStatusUpdate(APIModel):
    status: Literal["pending", "accepted", "in_progress", "completed", "cancelled"]
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None


class OrderReviewIn(APIModel):
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=500)


# ======================== 通知 ========================
class NotifReadAll(APIModel):
    user_id: Optional[str] = None


class NotifSendIn(APIModel):
    user_id: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=500)
    type: Optional[Literal["system", "order", "income", "promo", "review"]] = "system"


# ======================== 提现 ========================
class WithdrawCreateIn(APIModel):
    amount: float = Field(gt=0)
    account_name: str = Field(min_length=1, max_length=50)
    account_no: str = Field(min_length=1, max_length=50)


# ======================== 资质材料 ========================
class CertUploadIn(APIModel):
    doc_type: Literal["idcard_front", "idcard_back", "health_cert", "skill_cert"]
    filename: str = Field(min_length=1, max_length=200)
    data_base64: str = Field(min_length=1, max_length=8_000_000)  # 约 6MB 原始文件


# ======================== 系统设置 ========================
class PasswordChangeIn(APIModel):
    old_password: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=6, max_length=100)


# ======================== 客服工单（v4.6） ========================
class SupportTicketIn(APIModel):
    content: str = Field(min_length=5, max_length=500)
    order_no: str = Field(default="", max_length=32)
    category: Literal["consult", "complaint", "refund", "other"] = "consult"
    contact_phone: str = Field(default="", max_length=20)


class SupportReplyIn(APIModel):
    reply: str = Field(min_length=1, max_length=1000)
