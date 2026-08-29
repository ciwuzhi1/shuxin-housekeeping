"""单元测试：JWT 签发与校验。"""

import pytest

from backend.app.auth import decode_token, sign_token
from backend.app.config import settings
from backend.app.errors import UnauthorizedError


def test_sign_and_decode_roundtrip():
    token = sign_token({"userId": "c1", "username": "zhangsan", "role": "client"})
    payload = decode_token(token)
    assert payload["userId"] == "c1"
    assert payload["role"] == "client"
    assert "exp" in payload


def test_tampered_token_rejected():
    token = sign_token({"userId": "c1", "role": "client"})
    with pytest.raises(UnauthorizedError):
        decode_token(token[:-4] + "beef")


def test_expired_token_rejected(monkeypatch):
    monkeypatch.setattr(settings, "JWT_EXPIRES", -10)
    token = sign_token({"userId": "c1", "role": "client"})
    monkeypatch.setattr(settings, "JWT_EXPIRES", 86400)
    with pytest.raises(UnauthorizedError):
        decode_token(token)


def test_garbage_token_rejected():
    with pytest.raises(UnauthorizedError):
        decode_token("not-a-jwt")
