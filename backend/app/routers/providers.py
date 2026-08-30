"""服务人员路由：列表 / 详情 / 审核 / 上下线 / 资质材料。

修复 P0-4：上下线切换由「公开接口」改为「需登录且仅限本人（或 admin）」。
审核通过/驳回后自动向家政员发送通知（真实落库）。
资质材料上传落盘 backend/uploads/ 并写 certification_files 表。
"""

import base64
import os
import re
import time
import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..auth import decode_token, require_auth, require_role
from ..database import execute, parse_pagination, row, rows
from ..errors import BadRequestError, ForbiddenError, NotFoundError
from ..schemas import CertUploadIn, ProviderStatusIn

router = APIRouter()

# 上传目录：backend/uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_DOC_TYPES = {"idcard_front", "idcard_back", "health_cert", "skill_cert"}

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
    p = row("SELECT id, name FROM users WHERE id = %s AND role = 'provider'", [provider_id])
    if not p:
        raise NotFoundError("服务人员不存在")
    execute("UPDATE users SET certification_status = 'verified' WHERE id = %s", [provider_id])
    # 审核结果自动通知本人（真实落库）
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'system',0)",
        [f"n{int(time.time() * 1000)}v{provider_id}", provider_id, "资质审核通过", f"{p['name']}您好，您的资质认证已通过审核"],
    )
    return {"success": True, "message": "认证已通过"}


@router.put("/{provider_id}/reject", dependencies=[Depends(require_role("admin"))])
def reject_provider(provider_id: str):
    p = row("SELECT id, name FROM users WHERE id = %s AND role = 'provider'", [provider_id])
    if not p:
        raise NotFoundError("服务人员不存在")
    execute("UPDATE users SET certification_status = 'rejected' WHERE id = %s", [provider_id])
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,%s,%s,%s,'system',0)",
        [f"n{int(time.time() * 1000)}r{provider_id}", provider_id, "资质审核未通过", f"{p['name']}您好，您的资质认证未通过审核，请补充材料后重新提交"],
    )
    return {"success": True, "message": "认证已驳回"}


def _assert_self_or_admin(provider_id: str, user: dict) -> None:
    if user["role"] != "admin" and user.get("userId") != provider_id:
        raise ForbiddenError("只能操作自己的资质材料", "SELF_ONLY")


@router.get("/{provider_id}/certifications")
def list_certifications(provider_id: str, user=Depends(require_auth)):
    _assert_self_or_admin(provider_id, user)
    files = rows(
        "SELECT id, doc_type, filename, file_path, created_at FROM certification_files WHERE user_id = %s ORDER BY created_at DESC",
        [provider_id],
    )
    return {"success": True, "data": files}


@router.post("/{provider_id}/certifications")
def upload_certification(provider_id: str, data: CertUploadIn, user=Depends(require_auth)):
    """资质材料上传：base64 落盘 + 元数据落库（仅本人或 admin）。"""
    _assert_self_or_admin(provider_id, user)
    if data.doc_type not in ALLOWED_DOC_TYPES:
        raise BadRequestError("不支持的材料类型")
    if not row("SELECT id FROM users WHERE id = %s AND role = 'provider'", [provider_id]):
        raise NotFoundError("服务人员不存在")

    raw_name = os.path.basename(data.filename)
    ext = os.path.splitext(raw_name)[1][:10]
    if not re.match(r"^\.[A-Za-z0-9]+$", ext):
        ext = ".bin"
    try:
        content = base64.b64decode(data.data_base64, validate=True)
    except Exception:
        raise BadRequestError("文件内容 base64 解码失败")
    if len(content) > MAX_UPLOAD_BYTES:
        raise BadRequestError("文件超过 5MB 上限")

    subdir = os.path.join(UPLOAD_DIR, provider_id)
    os.makedirs(subdir, exist_ok=True)
    saved_name = f"{uuid.uuid4().hex[:12]}{ext}"
    with open(os.path.join(subdir, saved_name), "wb") as f:
        f.write(content)

    fid = f"cf{int(time.time() * 1000)}{provider_id}"
    file_path = f"/uploads/{provider_id}/{saved_name}"
    execute(
        "INSERT INTO certification_files (id, user_id, doc_type, filename, file_path) VALUES (%s,%s,%s,%s,%s)",
        [fid, provider_id, data.doc_type, raw_name, file_path],
    )
    # 新材料提交后重置为待审核并通知管理员
    execute("UPDATE users SET certification_status = 'pending' WHERE id = %s", [provider_id])
    execute(
        "INSERT INTO notifications (id, user_id, title, content, type, `read`) VALUES (%s,'a1',%s,%s,'system',0)",
        [f"n{int(time.time() * 1000)}c{provider_id}", "资质审核待处理", f"{raw_name} 已上传，等待审核"],
    )
    return {"success": True, "data": {"id": fid, "filePath": file_path}, "message": "上传成功，等待审核"}


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
