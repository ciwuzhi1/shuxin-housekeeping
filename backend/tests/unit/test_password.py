"""单元测试：密码哈希（Argon2id 新格式 + 旧格式 SHA-256 兼容）。"""

import hashlib
import os

from backend.app.auth import hash_password, is_legacy_hash, verify_password
from backend.app.config import settings


def _legacy_hash(password: str) -> str:
    salt = os.environ["PASSWORD_SALT"]
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def test_argon2_hash_roundtrip():
    hashed = hash_password("s3cret-123")
    assert hashed.startswith("$argon2id$")
    assert verify_password("s3cret-123", hashed)


def test_argon2_wrong_password_rejected():
    hashed = hash_password("s3cret-123")
    assert not verify_password("wrong", hashed)


def test_argon2_hash_has_random_salt():
    assert hash_password("same") != hash_password("same")


def test_is_legacy_hash_detection():
    assert is_legacy_hash(_legacy_hash("123456")) is True
    assert is_legacy_hash(hash_password("123456")) is False
    assert is_legacy_hash("") is True
    assert is_legacy_hash(None) is True


def test_verify_legacy_hash_accepted():
    assert verify_password("123456", _legacy_hash("123456"))


def test_verify_legacy_hash_wrong_password_rejected():
    assert not verify_password("bad", _legacy_hash("123456"))


def test_verify_empty_hash_rejected():
    assert not verify_password("123456", "")
    assert not verify_password("123456", None)  # type: ignore[arg-type]


def test_legacy_hash_depends_on_salt():
    """旧格式校验必须受 PASSWORD_SALT 影响（盐不同则哈希不同）。"""
    h = hashlib.sha256(("other-salt" + "123456").encode("utf-8")).hexdigest()
    assert settings.PASSWORD_SALT != "other-salt"
    assert not verify_password("123456", h)
