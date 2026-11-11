from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.identity import Principal
from app.core.identity_checks import IdentityChecks, IdentityStoreUnavailable, SubjectRevoked
from app.core.post_auth_limiter import cleanup_expired_windows, consume_post_auth_budget
from app.core.pre_auth_limiter import PreAuthLimiter
from app.core.security_telemetry import REASON_CATEGORIES, SecurityTelemetry
from app.core.settings import Settings

ORG_ID = UUID("6a79d6d8-23d3-4c14-bca7-6621be7d1701")


class _Result:
    def __init__(self, value: Any = None, rowcount: int = 0) -> None:
        self.value = value
        self.rowcount = rowcount

    def one_or_none(self) -> Any:
        return self.value


class _Connection:
    def __init__(self, engine: _Engine) -> None:
        self.engine = engine

    async def scalar(self, query: Any, parameters: dict[str, Any] | None = None) -> Any:
        if self.engine.unavailable:
            raise SQLAlchemyError("database unavailable")
        if "SELECT state FROM organizations" in str(query):
            return self.engine.organization_state
        if "INSERT INTO rate_limit_windows" in str(query):
            assert parameters is not None
            key = (
                parameters["organization_id"],
                parameters["subject"],
                parameters["route_class"],
                parameters["window_start"],
            )
            async with self.engine.lock:
                self.engine.counters[key] = self.engine.counters.get(key, 0) + 1
                return self.engine.counters[key]
        return None

    async def execute(self, query: Any, parameters: dict[str, Any] | None = None) -> _Result:
        if self.engine.unavailable:
            raise SQLAlchemyError("database unavailable")
        if "FROM identity_status" in str(query):
            return _Result(self.engine.subject_status)
        if "DELETE FROM rate_limit_windows" in str(query):
            self.engine.cleanup_cutoff = parameters["cutoff"] if parameters is not None else None
            return _Result(rowcount=7)
        return _Result()


class _ConnectionContext:
    def __init__(self, engine: _Engine) -> None:
        self.connection = _Connection(engine)

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, *_args: Any) -> None:
        return None


class _Engine:
    def __init__(self) -> None:
        self.organization_state: str | None = "ACTIVE"
        self.subject_status: Any = None
        self.unavailable = False
        self.counters: dict[tuple[Any, ...], int] = {}
        self.lock = asyncio.Lock()
        self.cleanup_cutoff: datetime | None = None

    def connect(self) -> _ConnectionContext:
        return _ConnectionContext(self)

    def begin(self) -> _ConnectionContext:
        return _ConnectionContext(self)


def _as_engine(engine: _Engine) -> AsyncEngine:
    return cast(AsyncEngine, engine)


def _principal(issued_at: float = 1_000.0) -> Principal:
    return Principal(
        subject="subject-1",
        organization_id=ORG_ID,
        roles=frozenset({"SERVICE"}),
        scopes=frozenset({"whoami:read"}),
        issued_at=issued_at,
    )


def test_pre_auth_limiter_blocks_burst_refills_and_stays_bounded() -> None:
    now = 0.0
    limiter = PreAuthLimiter(
        capacity=2,
        refill_per_second=1,
        max_clients=3,
        clock=lambda: now,
    )
    assert limiter.consume("client-1") is None
    assert limiter.consume("client-1") is None
    assert limiter.consume("client-1") == 1
    now += 1
    assert limiter.consume("client-1") is None
    for index in range(20):
        limiter.consume(f"client-{index + 2}")
    assert limiter.tracked_clients <= 3


def test_security_telemetry_is_enumerated_salted_and_bounded(caplog: pytest.LogCaptureFixture) -> None:
    telemetry = SecurityTelemetry(
        b"test-address-hash-salt",
        max_entries=8,
        clock=lambda: 0,
    )
    with caplog.at_level("WARNING"):
        for _ in range(1_000):
            telemetry.record("invalid_token", "203.0.113.8")
        for reason in REASON_CATEGORIES:
            telemetry.record(reason, f"address-{reason}")
    assert telemetry.tracked_entries <= 8
    assert len(caplog.records) <= 9
    assert all(
        getattr(record, "auth_reason", None) in REASON_CATEGORIES for record in caplog.records
    )
    assert all(
        0 <= getattr(record, "address_bucket", -1) < 64 for record in caplog.records
    )
    assert "203.0.113.8" not in caplog.text


@pytest.mark.asyncio
async def test_identity_checks_allow_missing_row_and_cache_revocation_until_expiry() -> None:
    now = 10.0
    engine = _Engine()
    checks = IdentityChecks(30, clock=lambda: now)
    await checks.verify(_as_engine(engine), _principal())
    engine.subject_status = SimpleNamespace(
        disabled_at=datetime.now(UTC),
        tokens_valid_after=None,
    )
    await checks.verify(_as_engine(engine), _principal())
    now += 31
    with pytest.raises(SubjectRevoked, match="subject_disabled"):
        await checks.verify(_as_engine(engine), _principal())


@pytest.mark.asyncio
async def test_tokens_before_valid_after_rejected_and_later_tokens_allowed() -> None:
    engine = _Engine()
    engine.subject_status = SimpleNamespace(
        disabled_at=None,
        tokens_valid_after=datetime.fromtimestamp(1_001, tz=UTC),
    )
    checks = IdentityChecks(30)
    with pytest.raises(SubjectRevoked, match="subject_tokens_revoked"):
        await checks.verify(_as_engine(engine), _principal(1_000))
    await checks.verify(_as_engine(engine), _principal(1_002))


@pytest.mark.asyncio
async def test_identity_database_failure_fails_closed() -> None:
    engine = _Engine()
    engine.unavailable = True
    with pytest.raises(IdentityStoreUnavailable):
        await IdentityChecks(30).verify(_as_engine(engine), _principal())


@pytest.mark.asyncio
async def test_post_auth_limiter_quota_window_reset_and_concurrency() -> None:
    engine = _Engine()
    settings = Settings(environment="test", rate_limit_window_seconds=60)
    now = 120.5

    async def consume() -> int | None:
        return await consume_post_auth_budget(
            _as_engine(engine),
            settings,
            _principal(),
            "human_reads",
            20,
            clock=lambda: now,
        )

    results = await asyncio.gather(*(consume() for _ in range(40)))
    assert sum(result is None for result in results) == 20
    assert all(result is None or result == 60 for result in results)
    next_window = await consume_post_auth_budget(
        _as_engine(engine),
        settings,
        _principal(),
        "human_reads",
        20,
        clock=lambda: 180.0,
    )
    assert next_window is None
    assert len(engine.counters) == 2


@pytest.mark.asyncio
async def test_rate_window_cleanup_uses_configured_retention() -> None:
    engine = _Engine()
    settings = Settings(
        environment="test",
        rate_limit_retention_seconds=120,
    )
    deleted = await cleanup_expired_windows(_as_engine(engine), settings, clock=lambda: 1_000)
    assert deleted == 7
    assert engine.cleanup_cutoff == datetime.fromtimestamp(880, tz=UTC)
