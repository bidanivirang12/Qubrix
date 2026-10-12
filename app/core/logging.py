from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, cast

SENSITIVE_KEY = re.compile(
    r"(?i)(password|passwd|secret|token|authorization|cookie|plaintext|pan|"
    r"private[_-]?key|database_url|runtime_database_url|test_database_url)"
)
BEARER_TOKEN = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
URL_CREDENTIALS = re.compile(r"(://[^:/\s]+:)[^@/\s]+(@)")


def redact(value: Any) -> Any:
    if isinstance(value, Mapping):
        mapping = cast(Mapping[object, object], value)
        result: dict[str, object] = {}
        for raw_key, item in mapping.items():
            key = str(raw_key)
            result[key] = "[REDACTED]" if SENSITIVE_KEY.search(key) else redact(item)
        return result
    if isinstance(value, (list, tuple)):
        items = cast(list[object] | tuple[object, ...], value)
        return [redact(item) for item in items]
    if isinstance(value, str):
        return URL_CREDENTIALS.sub(r"\1[REDACTED]\2", BEARER_TOKEN.sub("Bearer [REDACTED]", value))
    return value


class RedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        record.msg = redact(message)
        record.args = ()
        for key, value in tuple(record.__dict__.items()):
            if SENSITIVE_KEY.search(key):
                record.__dict__[key] = "[REDACTED]"
            elif isinstance(value, (dict, list, tuple, str)):
                record.__dict__[key] = redact(value)
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact(record.getMessage()),
        }
        for key in ("request_id", "correlation_id", "event"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = redact(value)
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def configure_logging() -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RedactionFilter())
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
