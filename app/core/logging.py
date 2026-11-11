from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, cast

SENSITIVE_KEY = re.compile(
    r"(?i)(password|passwd|secret|authorization|cookie|plaintext|"
    r"(?:^|[_.\-])(?:access|refresh|session|auth|bearer|jwt)[_.-]?token(?:$|[_.\-])|"
    r"(?:^|[_.\-])token(?:[_.-](?:value|id|secret|key|hash))(?=$|[_.\-])|"
    r"(?:^|[_.\-])pan(?:$|[_.\-])|private[_-]?key|database_url|"
    r"runtime_database_url|test_database_url)"
)
JWT_LIKE = re.compile(r"\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
BEARER_CREDENTIAL = re.compile(
    r"(?i)\bBearer\s+(?:[A-Za-z0-9_-]+\.[A-Za-z0-9._~+/=-]+|[A-Za-z0-9._~+/=-]{20,})"
)
URL_CREDENTIALS = re.compile(r"(://[^:/\s]+:)[^@/\s]+(?=@|/|$)")

# Only these structured fields are ever written to the log output.
SAFE_EXTRA_FIELDS = (
    "request_id",
    "correlation_id",
    "event",
    "auth_reason",
    "route",
    "status_code",
    "operation",
    "error_category",
    "duration_ms",
    "security_event",
    "address_bucket",
    "count",
)


def _redact_text(value: str) -> str:
    value = JWT_LIKE.sub("[REDACTED]", value)
    value = BEARER_CREDENTIAL.sub("Bearer [REDACTED]", value)
    return URL_CREDENTIALS.sub(r"\1[REDACTED]", value)


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
        return _redact_text(value)
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
        for key in SAFE_EXTRA_FIELDS:
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
