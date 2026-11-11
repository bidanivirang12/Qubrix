from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass


@dataclass(slots=True)
class _Bucket:
    tokens: float
    updated_at: float


class PreAuthLimiter:
    def __init__(
        self,
        *,
        capacity: int,
        refill_per_second: float,
        max_clients: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._capacity = float(capacity)
        self._refill_per_second = refill_per_second
        self._max_clients = max_clients
        self._clock = clock
        self._buckets: OrderedDict[str, _Bucket] = OrderedDict()
        self._lock = threading.Lock()

    @property
    def tracked_clients(self) -> int:
        with self._lock:
            return len(self._buckets)

    def consume(self, client_address: str) -> float | None:
        now = self._clock()
        with self._lock:
            lifetime = self._capacity / self._refill_per_second
            while self._buckets:
                oldest_address, oldest_bucket = next(iter(self._buckets.items()))
                if now - oldest_bucket.updated_at < lifetime:
                    break
                del self._buckets[oldest_address]
            bucket = self._buckets.get(client_address)
            if bucket is None:
                if len(self._buckets) >= self._max_clients:
                    self._buckets.popitem(last=False)
                self._buckets[client_address] = _Bucket(self._capacity - 1, now)
                return None

            elapsed = max(0.0, now - bucket.updated_at)
            bucket.tokens = min(
                self._capacity,
                bucket.tokens + elapsed * self._refill_per_second,
            )
            bucket.updated_at = now
            self._buckets.move_to_end(client_address)
            if bucket.tokens >= 1:
                bucket.tokens -= 1
                return None
            return (1 - bucket.tokens) / self._refill_per_second
