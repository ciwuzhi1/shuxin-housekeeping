"""服务人员路由：列表 / 详情 / 审核 / 上下线。

修复 P0-4：上下线切换由「公开接口」改为「需登录且仅限本人（或 admin）」。
"""

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..auth import decode_token, require_auth, require_role
from ..database import execute, parse_pagination, row, rows
from ..errors import ForbiddenError, NotFoundError
from ..schemas import ProviderStatusIn

router = APIRouter()

# 基础字段（公开可见）；balance 属敏感资金字段，仅 admin 可见
PROVIDER_SELECT = (
    "SELECT id, username, name, phone, avatar, role, age, gender, experience, "
    "certification_status, status, rating, completed_orders, "
    "service_area, introduction, skills, created_at FROM users WHERE role = 'provider'"
)
PROVIDER_SELECT_ADMIN = (
    "SELECT id, username, name, phone, avatar, role, age, gender, experience, "
    "certification_status, status, rating, completed_orders, balance, "
    "service_area, introduction, skills, created_at FROM users WHERE role = 'provider'"
)

_bearer_optional = HTTPBearer(auto_error=False)


def _optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional)) -> dict | None:
    """可选鉴权：有合法 token 返回用户，否则 None（公开接口仍可访问）。"""
    if credentials is None:
        return None
    try:
        return decode_token(credentials.credentials)
    except Exception:
        return None


def _select_for(user: dict | None) -> str:
    return PROVIDER_SELECT_ADMIN if (user or {}).get("role") == "admin" else PROVIDER_SELECT


@router.get("")
def list_providers(
    _user: dict | None = Depends(_optional_user),
    status: str = Query(None),
    certificationStatus: str = Query(None),
    search: str = Query(None),
    page: int = Query(1),
    size: int = Query(None),
):
    pag = parse_pagination(page, size)
    conditions: list[str] = []
    params: list = []
    if status:
        conditions.append("status = %s")
        params.append(status)
    if certificationStatus:
        conditions.append("certification_status = %s")
        params.append(certificationStatus)
    if search:
        conditions.append("(name LIKE %s OR phone LIKE %s)")
        params += [f"%{search}%", f"%{search}%"]
    where = (" AND " + " AND ".join(conditions)) if conditions else ""

    list_rows = rows(
        f"{_select_for(_user)}{where} ORDER BY rating DESC, completed_orders DESC LIMIT %s OFFSET %s",
        params + [pag["limit"], pag["offset"]],
    )
    total_row = row(f"SELECT COUNT(*) AS c FROM users WHERE role = 'provider'{where}", params)
    total = (total_row or {}).get("c", 0)
    return {
        "success": True,
        "data": list_rows,
        "pagination": {"page": pag["page"], "size": pag["size"], "total": total, "totalPages": (total + pag["size"] - 1) // pag["size"]},
    }


@router.get("/{provider_id}")
def get_provider(provider_id: str, _user: dict | None = Depends(_optional_user)):
    # 余额敏感字段：仅 admin 或本人可见（本人需查看自己的余额）
    is_owner = bool(_user) and _user.get("userId") == provider_id
    sel = PROVIDER_SELECT_ADMIN if (_user or {}).get("role") == "admin" or is_owner else PROVIDER_SELECT
    p = row(f"{sel} AND id = %s", [provider_id])
    if not p:
        raise NotFoundError("服务人员不存在")
    return {"success": True, "data": p}


@router.put("/{provider_id}/verify", dependencies=[Depends(require_role("admin"))])
def verify_provider(provider_id: str):
    p = row("SELECT id FROM users WHERE id = %s AND role = 'provider'", [provider_id])
    if not p:
        raise NotFoundError("服务人员不存在")
    execute("UPDATE users SET certification_status = 'verified' WHERE id = %s", [provider_id])
    return {"success": True, "message": "认证已通过"}


@router.put("/{provider_id}/reject", dependencies=[Depends(require_role("admin"))])
def reject_provider(provider_id: str):
    p = row("SELECT id FROM users WHERE id = %s AND role = 'provider'", [provider_id])
    if not p:
        raise NotFoundError("服务人员不存在")
    execute("UPDATE users SET certification_status = 'rejected' WHERE id = %s", [provider_id])
    return {"success": True, "message": "认证已驳回"}


@router.put("/{provider_id}/status")
def toggle_status(provider_id: str, data: ProviderStatusIn, user=Depends(require_auth)):
    # 修复 P0-4：非 admin 只能切换自己的上下线
    if user["role"] != "admin" and user.get("userId") != provider_id:
        raise ForbiddenError("只能切换自己的上下线", "SELF_ONLY")

    p = row("SELECT id, status FROM users WHERE id = %s AND role = 'provider'", [provider_id])
    if not p:
        raise NotFoundError("服务人员不存在")

    if p["status"] == data.status:
        label = "在线" if data.status == "online" else "离线"
        return {"success": True, "data": {"status": data.status}, "message": f"状态已经是{label}"}

    execute("UPDATE users SET status = %s WHERE id = %s", [data.status, provider_id])
    return {"success": True, "data": {"status": data.status}, "message": "状态已更新"}
