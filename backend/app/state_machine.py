"""订单状态机（对应 Node 版 orders.ts 的 validTransitions）。

   pending     → accepted / cancelled
   accepted    → in_progress / cancelled
   in_progress → completed
   completed / cancelled 为终态。
"""

VALID_TRANSITIONS: dict[str, list[str]] = {
    "pending": ["accepted", "cancelled"],
    "accepted": ["in_progress", "cancelled"],
    "in_progress": ["completed"],
    "completed": [],
    "cancelled": [],
}


def can_transition(current: str, target: str) -> bool:
    return target in VALID_TRANSITIONS.get(current, [])
