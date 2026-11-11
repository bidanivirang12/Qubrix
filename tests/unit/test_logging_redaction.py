from __future__ import annotations

import json
import logging

from app.core.logging import JsonFormatter, RedactionFilter


def _render(message: str, **extra: object) -> dict[str, object]:
    record = logging.LogRecord("t", logging.WARNING, __file__, 1, message, (), None)
    for key, value in extra.items():
        setattr(record, key, value)
    RedactionFilter().filter(record)
    return json.loads(JsonFormatter().format(record))


def test_plain_word_token_is_not_redacted() -> None:
    assert _render("Bearer token rejected")["message"] == "Bearer token rejected"


def test_jwt_shaped_value_is_redacted() -> None:
    jwt_like = "aaaaaaaaaa.bbbbbbbbbb.cccccccccc"
    assert jwt_like not in str(_render(f"failed for {jwt_like}"))


def test_auth_reason_is_emitted() -> None:
    assert _render("rejected", auth_reason="unknown_role")["auth_reason"] == "unknown_role"


def test_unlisted_extra_field_is_not_emitted() -> None:
    assert "password" not in _render("x", password="hunter2")
