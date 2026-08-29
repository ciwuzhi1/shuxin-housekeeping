"""服务分类路由：分类列表（含子分类）。"""

from fastapi import APIRouter

from ..database import row, rows
from ..errors import NotFoundError

router = APIRouter()


@router.get("")
def list_categories():
    categories = rows("SELECT id, name, icon, description, sort_order FROM service_categories ORDER BY sort_order")
    subs = rows("SELECT id, category_id, name, description, price, estimated_duration FROM service_subcategories")
    result = []
    for c in categories:
        c["subcategories"] = [s for s in subs if s["categoryId"] == c["id"]]
        result.append(c)
    return {"success": True, "data": result}


@router.get("/{category_id}")
def get_category(category_id: str):
    cat = row("SELECT id, name, icon, description, sort_order FROM service_categories WHERE id = %s", [category_id])
    if not cat:
        raise NotFoundError("服务分类不存在")
    subs = rows(
        "SELECT id, name, description, price, estimated_duration FROM service_subcategories WHERE category_id = %s",
        [category_id],
    )
    return {"success": True, "data": {**cat, "subcategories": subs}}
