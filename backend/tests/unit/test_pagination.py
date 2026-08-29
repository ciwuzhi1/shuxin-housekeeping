"""单元测试：分页参数解析与边界。"""

import pytest

from backend.app.database import parse_pagination
from backend.app.config import settings


def test_defaults():
    p = parse_pagination(None, None)
    assert p["page"] == 1
    assert p["size"] == settings.PAGE_SIZE
    assert p["limit"] == p["size"]
    assert p["offset"] == 0


def test_invalid_values_fall_back():
    p = parse_pagination("abc", "abc")
    assert p["page"] == 1
    assert p["size"] == settings.PAGE_SIZE


def test_page_lower_bound():
    assert parse_pagination("0", "10")["page"] == 1
    assert parse_pagination("-5", "10")["page"] == 1


def test_size_upper_bound():
    p = parse_pagination("1", str(settings.MAX_PAGE_SIZE * 10))
    assert p["size"] == settings.MAX_PAGE_SIZE
    assert p["limit"] == settings.MAX_PAGE_SIZE


def test_size_lower_bound():
    assert parse_pagination("1", "0")["size"] == 1
    assert parse_pagination("1", "-9")["size"] == 1


def test_offset_calculation():
    p = parse_pagination("3", "10")
    assert p["page"] == 3
    assert p["offset"] == 20
