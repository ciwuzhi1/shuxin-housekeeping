"""MySQL 种子数据（从 Node 版 seed-data.ts 移植）。

密码使用 Argon2id 哈希（经 auth.hash_password，v4.0 起替代 SHA-256+固定盐）。
JSON 列（service_area/skills/review_images/images）以 json.dumps 写入。
"""

import json

from .auth import hash_password
from .database import execute, row

PWD = hash_password("123456")
ADMIN_PWD = hash_password("admin123")


def _j(value) -> str:
    return json.dumps(value, ensure_ascii=False)


USERS = [
    ("c1", "zhangsan", "张三", "13800138001", "", "client", PWD, None, None, None, None, None, None, None, None, None, None, None, None, None, 13, 5680, "北京市朝阳区建国路88号", "2025-01-15"),
    ("c2", "lisi", "李四", "13800138002", "", "client", PWD, None, None, None, None, None, None, None, None, None, None, None, None, None, 8, 3120, "北京市海淀区中关村大街5号", "2025-02-20"),
    ("c3", "wangwu", "王五", "13800138003", "", "client", PWD, None, None, None, None, None, None, None, None, None, None, None, None, None, 3, 1280, "北京市西城区金融街1号", "2025-03-10"),
    ("p1", "liujie", "刘姐", "13900139001", "", "provider", PWD, 42, "female", "110101198201011234", 8, "verified", "online", 4.8, 356, 5800, _j(["海淀区", "朝阳区", "西城区"]), "从事家政服务8年，经验丰富。擅长深度清洁、家电清洗等专业服务。", _j([
        {"id": "sk1", "name": "深度保洁", "level": "senior"},
        {"id": "sk2", "name": "家电清洗", "level": "intermediate"},
        {"id": "sk3", "name": "油烟机清洗", "level": "senior"},
    ]), None, None, None, "", "2024-06-01"),
    ("p2", "wangyi", "王姨", "13900139002", "", "provider", PWD, 48, "female", "110101197601012345", 12, "verified", "online", 4.9, 589, 9200, _j(["东城区", "西城区", "朝阳区"]), "12年家政工作经验，持有高级家政服务员、养老护理员双证。", _j([
        {"id": "sk4", "name": "日常保洁", "level": "senior"},
        {"id": "sk5", "name": "老人陪护", "level": "senior"},
        {"id": "sk6", "name": "做饭", "level": "intermediate"},
    ]), None, None, None, "", "2024-08-15"),
    ("p3", "xiaoli", "小李", "13900139003", "", "provider", PWD, 28, "male", "110101199601013456", 3, "pending", "offline", 4.5, 89, 2200, _j(["朝阳区", "通州区", "大兴区"]), "年轻力壮，手脚麻利。擅长家电维修和家具组装。", _j([
        {"id": "sk7", "name": "家电维修", "level": "intermediate"},
        {"id": "sk8", "name": "水管维修", "level": "junior"},
        {"id": "sk9", "name": "家具组装", "level": "intermediate"},
    ]), None, None, None, "", "2025-01-10"),
    ("p4", "chenjie", "陈姐", "13900139004", "", "provider", PWD, 38, "female", "110101198501014567", 6, "verified", "online", 4.7, 234, 4100, _j(["海淀区", "朝阳区", "丰台区"]), "专业收纳整理师，持有日本收纳协会认证。", _j([
        {"id": "sk10", "name": "深度保洁", "level": "intermediate"},
        {"id": "sk11", "name": "除螨服务", "level": "senior"},
        {"id": "sk12", "name": "收纳整理", "level": "senior"},
    ]), None, None, None, "", "2024-11-20"),
    ("a1", "admin", "系统管理员", "13700137000", "", "admin", ADMIN_PWD, None, None, None, None, None, None, None, None, None, None, None, None, "运营部", None, None, "", "2024-01-01"),
]

USER_SQL = (
    "INSERT INTO users (id, username, name, phone, avatar, role, password, age, gender, id_card, experience, "
    "certification_status, status, rating, completed_orders, balance, service_area, introduction, skills, department, "
    "total_orders, total_spent, address, created_at) "
    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
)

CATEGORIES = [
    ("c-cat1", "日常保洁", "home", "家庭日常清洁服务", 1),
    ("c-cat2", "深度清洁", "sparkles", "全屋深度清洁、装修后清洁", 2),
    ("c-cat3", "家电清洗", "wrench", "空调、油烟机、洗衣机等家电清洗", 3),
    ("c-cat4", "家居保养", "shield", "地板打蜡、皮具保养等", 4),
    ("c-cat5", "收纳整理", "package", "专业收纳、搬家整理", 5),
    ("c-cat6", "专项服务", "star", "月嫂、养老护理等", 6),
]

SUBCATEGORIES = [
    ("sc1", "c-cat1", "普通日常保洁", "100平米以内基础清洁", 180, 3),
    ("sc2", "c-cat1", "厨房专项清洁", "厨房油污深度处理", 120, 2),
    ("sc3", "c-cat1", "卫生间专项清洁", "卫生间除垢消毒", 100, 2),
    ("sc4", "c-cat2", "全屋深度清洁", "100平米以内深度清洁", 480, 6),
    ("sc5", "c-cat2", "装修后开荒", "新房装修后精细清洁", 1200, 12),
    ("sc6", "c-cat2", "租房退租清洁", "退租前精细还原", 600, 8),
    ("sc7", "c-cat3", "空调清洗", "挂机/柜机深度清洗", 80, 1),
    ("sc8", "c-cat3", "油烟机清洗", "免拆洗深度处理", 150, 2),
    ("sc9", "c-cat3", "洗衣机清洗", "滚筒/波轮拆洗", 120, 1.5),
    ("sc10", "c-cat3", "冰箱清洗", "断电除霜深度清洁", 80, 1),
    ("sc11", "c-cat4", "地板打蜡", "实木地板养护", 200, 3),
    ("sc12", "c-cat4", "皮具保养", "沙发皮具护理", 150, 2),
    ("sc13", "c-cat4", "地毯清洗", "专业设备清洗", 180, 2),
    ("sc14", "c-cat5", "衣柜整理", "换季衣物分类收纳", 200, 3),
    ("sc15", "c-cat5", "厨房整理", "厨房用品分区摆放", 180, 2),
    ("sc16", "c-cat5", "搬家整理", "打包还原一站式", 800, 10),
    ("sc17", "c-cat6", "月嫂服务", "新生儿专业护理", 12000, 1),
    ("sc18", "c-cat6", "养老护理", "老人专业陪护", 300, 1),
    ("sc19", "c-cat6", "医院陪诊", "就医陪同服务", 200, 4),
    ("sc20", "c-cat6", "宠物照护", "上门喂食遛狗", 80, 1),
    ("sc21", "c-cat6", "家庭厨师", "上门做菜服务", 300, 4),
]

# id, order_no, client_id, provider_id, client_name, client_phone, client_address, service_category,
# service_name, service_price, total_hours, total_amount, status, payment_status, scheduled_date,
# scheduled_time, special_requirements, rating, review, provider_name, created_at
ORDERS = [
    ("o1", "HK20250721001", "c1", "p1", "张三", "13800138001", "北京市朝阳区建国路88号", "日常保洁", "普通日常保洁", 180, 3, 180, "completed", "paid", "2025-07-21", "09:00-12:00", "", 5, "非常专业，态度认真。", "刘姐", "2025-07-21 09:00"),
    ("o2", "HK20250722002", "c1", "p2", "张三", "13800138001", "北京市朝阳区建国路88号", "深度清洁", "全屋深度清洁", 480, 6, 480, "completed", "paid", "2025-07-22", "09:00-15:00", "", 5, "王姨很用心，每个角落都打扫到了。", "王姨", "2025-07-22 09:00"),
    ("o3", "HK20250723003", "c2", "p1", "李四", "13800138002", "北京市海淀区中关村大街5号", "家电清洗", "空调清洗+油烟机清洗", 230, 3, 230, "completed", "paid", "2025-07-23", "10:00-13:00", "", 4, "准时到达，手艺不错。", "刘姐", "2025-07-23 10:00"),
    ("o4", "HK20250724004", "c1", "p4", "张三", "13800138001", "北京市朝阳区建国路88号", "收纳整理", "衣柜整理", 200, 3, 200, "accepted", "paid", "2025-07-25", "14:00-17:00", "", 0, "", "陈姐", "2025-07-24 11:00"),
    ("o5", "HK20250725005", "c3", "p1", "王五", "13800138003", "北京市西城区金融街1号", "专项服务", "家庭厨师", 300, 4, 300, "completed", "paid", "2025-07-26", "18:00-22:00", "想做川菜，4个人", 0, "", "刘姐", "2025-07-25 16:00"),
    ("o6", "HK20250720006", "c2", "p4", "李四", "13800138002", "北京市海淀区中关村大街5号", "家居保养", "地板打蜡", 200, 3, 200, "completed", "paid", "2025-07-20", "09:00-12:00", "", 5, "地板打蜡后光亮如新。", "陈姐", "2025-07-20 09:00"),
    ("o7", "HK20250719007", "c3", "p2", "王五", "13800138003", "北京市西城区金融街1号", "专项服务", "老人陪护", 300, 1, 300, "completed", "paid", "2025-07-19", "08:00-09:00", "", 5, "王姨很专业，老人很喜欢。", "王姨", "2025-07-19 08:00"),
    ("o8", "HK20250718008", "c1", "p3", "张三", "13800138001", "北京市朝阳区建国路88号", "家电清洗", "洗衣机清洗", 120, 1.5, 120, "in_progress", "paid", "2025-07-25", "15:00-16:30", "", 0, "", "小李", "2025-07-25 14:00"),
    ("o9", "HK20250715009", "c2", "p1", "李四", "13800138002", "北京市海淀区中关村大街5号", "日常保洁", "厨房专项清洁", 120, 2, 120, "cancelled", "refunded", "2025-07-16", "10:00-12:00", "临时有事取消", 0, "", "刘姐", "2025-07-15 10:00"),
]

REVIEWS = [
    ("r1", "o1", "c1", "张三", "", "p1", "刘姐", 5, "非常专业，态度认真。家里焕然一新！", "普通日常保洁", "2025-07-21 12:30"),
    ("r2", "o2", "c1", "张三", "", "p2", "王姨", 5, "王姨很用心，每个角落都打扫到了。", "全屋深度清洁", "2025-07-22 15:30"),
    ("r3", "o3", "c2", "李四", "", "p1", "刘姐", 4, "准时到达，手艺不错。", "空调清洗+油烟机清洗", "2025-07-23 13:30"),
    ("r4", "o6", "c2", "李四", "", "p4", "陈姐", 5, "地板打蜡后光亮如新。", "地板打蜡", "2025-07-20 12:30"),
]

TRANSACTIONS = [
    ("t1", "o1", "HK20250721001", "income", 180, "completed", "订单收入-普通日常保洁", "2025-07-21 12:00"),
    ("t2", "o2", "HK20250722002", "income", 480, "completed", "订单收入-全屋深度清洁", "2025-07-22 15:00"),
    ("t3", "o3", "HK20250723003", "income", 230, "completed", "订单收入-空调清洗+油烟机清洗", "2025-07-23 13:00"),
    ("t4", "o6", "HK20250720006", "income", 200, "completed", "订单收入-地板打蜡", "2025-07-20 12:00"),
    ("t5", "o7", "HK20250719007", "income", 300, "completed", "订单收入-老人陪护", "2025-07-19 09:00"),
    ("t6", None, None, "withdraw", -2000, "completed", "月度提现", "2025-07-15 10:00"),
    ("t7", None, None, "withdraw", -1500, "pending", "提现申请处理中", "2025-07-25 14:00"),
    ("t8", "o9", "HK20250715009", "refund", -120, "completed", "订单退款-取消", "2025-07-15 18:00"),
    ("t9", None, None, "commission", -25, "completed", "平台佣金", "2025-07-21 12:00"),
    ("t10", "o5", "HK20250725005", "income", 300, "completed", "订单收入-家庭厨师", "2025-07-26 20:00"),
]

NOTIFICATIONS = [
    ("n1", "c1", "订单完成通知", "您的订单 HK20250721001 已完成，欢迎评价", "order", 0, "2025-07-21 12:30"),
    ("n2", "c1", "家政人员已接单", "刘姐已接受您的订单 HK20250722002", "order", 0, "2025-07-22 08:30"),
    ("n3", "p1", "新订单提醒", "您有一个新的订单待处理", "order", 0, "2025-07-24 11:00"),
    ("n4", "p2", "收入到账通知", "您有一笔收入 480元 已到账", "income", 0, "2025-07-22 15:00"),
    ("n5", "a1", "新用户注册", "今日新增 28 位用户", "system", 0, "2025-07-25 09:00"),
    ("n6", "a1", "资质审核待处理", "小李提交的资质认证待审核", "system", 0, "2025-07-24 16:00"),
    ("n7", "c2", "优惠活动通知", "夏季深度清洁8折优惠，限时7天", "promo", 1, "2025-07-20 10:00"),
]


def ensure_seed() -> None:
    """当 users 表为空时写入种子数据。"""
    if (row("SELECT COUNT(*) AS c FROM users") or {}).get("c", 0) > 0:
        return

    for u in USERS:
        execute(USER_SQL, list(u))
    for c in CATEGORIES:
        execute("INSERT INTO service_categories (id, name, icon, description, sort_order) VALUES (%s,%s,%s,%s,%s)", list(c))
    for s in SUBCATEGORIES:
        execute(
            "INSERT INTO service_subcategories (id, category_id, name, description, price, estimated_duration) VALUES (%s,%s,%s,%s,%s,%s)",
            list(s),
        )
    for o in ORDERS:
        execute(
            "INSERT INTO orders (id, order_no, client_id, provider_id, client_name, client_phone, client_address, service_category, service_name, service_price, total_hours, total_amount, status, payment_status, scheduled_date, scheduled_time, special_requirements, rating, review, review_images, provider_name, created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'[]',%s,%s,%s)",
            [o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8], o[9], o[10], o[11], o[12], o[13], o[14], o[15], o[16], o[17], o[18], o[19], o[20], o[20]],
        )
    for r in REVIEWS:
        execute(
            "INSERT INTO reviews (id, order_id, client_id, client_name, client_avatar, provider_id, provider_name, rating, content, images, service_name, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'[]',%s,%s)",
            list(r),
        )
    for t in TRANSACTIONS:
        execute(
            "INSERT INTO transactions (id, order_id, order_no, type, amount, status, description, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            list(t),
        )
    for n in NOTIFICATIONS:
        execute(
            "INSERT INTO notifications (id, user_id, title, content, type, `read`, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            list(n),
        )
