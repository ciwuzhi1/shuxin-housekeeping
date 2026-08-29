"""单元测试：订单状态机。"""

from backend.app.state_machine import can_transition


def test_valid_transitions():
    assert can_transition("pending", "accepted")
    assert can_transition("pending", "cancelled")
    assert can_transition("accepted", "in_progress")
    assert can_transition("accepted", "cancelled")
    assert can_transition("in_progress", "completed")


def test_invalid_transitions():
    assert not can_transition("pending", "completed")
    assert not can_transition("pending", "in_progress")
    assert not can_transition("accepted", "completed")


def test_terminal_states():
    for target in ("accepted", "in_progress", "completed", "cancelled", "pending"):
        assert not can_transition("completed", target)
        assert not can_transition("cancelled", target)


def test_unknown_state():
    assert not can_transition("unknown", "accepted")
    assert not can_transition("pending", "unknown")
