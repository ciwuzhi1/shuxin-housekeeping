"""评价查询路由。"""

from fastapi import APIRouter, Depends, Query

from ..auth import require_auth
from ..config import settings
from ..database import rows

router = APIRouter()


@router.get("")
def list_reviews(providerId: str = Query(None), limit: int = Query(None), _user=Depends(require_auth)):
    sql = (
        "SELECT id, order_id, client_id, client_name, client_avatar, provider_id, provider_name, "
        "rating, content, images, service_name, created_at FROM reviews"
    )
    params: list = []
    if providerId:
        sql += " WHERE provider_id = %s"
        params.append(providerId)
    sql += " ORDER BY created_at DESC"
    if limit:
        # V4.4a：limit 上限保护，防止拉取全表
        sql += " LIMIT %s"
        params.append(min(int(limit), settings.MAX_PAGE_SIZE))
    return {"success": True, "data": rows(sql, params)}
