from __future__ import annotations

import hashlib
import hmac
import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass

logger = logging.getLogger(__name__)
REASON_CATEGORIES = frozenset(
    {
        "missing_authorization",
        "malformed_authorization",
        "invalid_token",
        "jwks_unavailable",
        "unprovisioned_organization",
        "authorization_denial_limit",
        "pre_auth_rate_limited",
        "security_dependency_failure",
    }
)


@dataclass(slots=True)
class _Aggregate:
    count: int
    last_emitted_at: float
    expires_at: float


class SecurityTelemetry:
    def __init__(
        self,
        salt: bytes,
        *,
        max_entries: int = 4_096,
        ttl_seconds: int = 300,
        emit_interval_seconds: int = 60,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._salt = salt
        self._max_entries = max_entries
        self._ttl_seconds = ttl_seconds
        self._emit_interval_seconds = emit_interval_seconds
        self._clock = clock
        self._entries: OrderedDict[tuple[str, int], _Aggregate] = OrderedDict()
        self._lock = threading.Lock()

    @property
    def tracked_entries(self) -> int:
        with self._lock:
            return len(self._entries)

    def address_bucket(self, address: str | None) -> int:
        digest = hmac.new(
            self._salt,
            (address or "unknown").encode("utf-8", errors="replace"),
            hashlib.sha256,
        ).digest()
        return int.from_bytes(digest[:2], "big") % 64

    def record(self, reason: str, address: str | None) -> None:
        category = reason if reason in REASON_CATEGORIES else "invalid_token"
        bucket_id = self.address_bucket(address)
        key = (category, bucket_id)
        now = self._clock()
        emit_count: int | None = None
        with self._lock:
            while self._entries:
                oldest_key, oldest_entry = next(iter(self._entries.items()))
                if oldest_entry.expires_at > now:
                    break
                del self._entries[oldest_key]
            entry = self._entries.get(key)
            if entry is None:
                if len(self._entries) >= self._max_entries:
                    self._entries.popitem(last=False)
                self._entries[key] = _Aggregate(1, now, now + self._ttl_seconds)
                emit_count = 1
            else:
                entry.count += 1
                entry.expires_at = now + self._ttl_seconds
                self._entries.move_to_end(key)
                if now - entry.last_emitted_at >= self._emit_interval_seconds:
                    emit_count = entry.count
                    entry.count = 0
                    entry.last_emitted_at = now
        if emit_count is not None:
            logger.warning(
                "Authentication security telemetry",
                extra={
                    "security_event": "authentication_failure",
                    "auth_reason": category,
                    "address_bucket": bucket_id,
                    "count": emit_count,
                },
            )
