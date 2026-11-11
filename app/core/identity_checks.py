from __future__ import annotations

import time
from collections import OrderedDict
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.identity import Principal

MAX_CACHE_ENTRIES = 4_096


class _CacheEntry[CacheValue]:
    def __init__(self, value: CacheValue, expires_at: float) -> None:
        self.value = value
        self.expires_at = expires_at


class IdentityStoreUnavailable(Exception):
    pass


class UnprovisionedOrganization(Exception):
    pass


class OrganizationInactive(Exception):
    reason = "organization_inactive"


class SubjectRevoked(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


class IdentityChecks:
    def __init__(
        self,
        cache_seconds: int,
        *,
        clock: Callable[[], float] = time.monotonic,
        max_entries: int = MAX_CACHE_ENTRIES,
    ) -> None:
        self._cache_seconds = cache_seconds
        self._clock = clock
        self._max_entries = max_entries
        self._organizations: OrderedDict[UUID, _CacheEntry[str | None]] = OrderedDict()
        self._subjects: OrderedDict[
            tuple[UUID, str], _CacheEntry[tuple[bool, datetime | None]]
        ] = OrderedDict()

    async def verify(self, engine: AsyncEngine, principal: Principal) -> None:
        organization_state = await self._organization_state(engine, principal.organization_id)
        if organization_state is None:
            raise UnprovisionedOrganization
        if organization_state != "ACTIVE":
            raise OrganizationInactive

        disabled_at, tokens_valid_after = await self._subject_status(
            engine, principal.organization_id, principal.subject
        )
        if disabled_at:
            raise SubjectRevoked("subject_disabled")
        if (
            tokens_valid_after is not None
            and principal.issued_at < tokens_valid_after.timestamp()
        ):
            raise SubjectRevoked("subject_tokens_revoked")

    async def _organization_state(self, engine: AsyncEngine, organization_id: UUID) -> str | None:
        now = self._clock()
        cached = self._organizations.get(organization_id)
        if cached is not None and cached.expires_at > now:
            self._organizations.move_to_end(organization_id)
            return cached.value
        try:
            async with engine.connect() as connection:
                state = await connection.scalar(
                    text("SELECT state FROM organizations WHERE id = :organization_id"),
                    {"organization_id": organization_id},
                )
        except SQLAlchemyError as error:
            raise IdentityStoreUnavailable from error
        value = str(state) if state is not None else None
        self._store(self._organizations, organization_id, value, now)
        return value

    async def _subject_status(
        self,
        engine: AsyncEngine,
        organization_id: UUID,
        subject: str,
    ) -> tuple[bool, datetime | None]:
        now = self._clock()
        key = (organization_id, subject)
        cached = self._subjects.get(key)
        if cached is not None and cached.expires_at > now:
            self._subjects.move_to_end(key)
            return cached.value
        try:
            async with engine.connect() as connection:
                result = await connection.execute(
                    text(
                        "SELECT disabled_at, tokens_valid_after FROM identity_status "
                        "WHERE organization_id = :organization_id AND subject = :subject"
                    ),
                    {"organization_id": organization_id, "subject": subject},
                )
                row = result.one_or_none()
        except SQLAlchemyError as error:
            raise IdentityStoreUnavailable from error
        status = (
            (row.disabled_at is not None, row.tokens_valid_after)
            if row is not None
            else (False, None)
        )
        self._store(self._subjects, key, status, now)
        return status

    def _store[Key, Value](
        self,
        cache: OrderedDict[Key, _CacheEntry[Value]],
        key: Key,
        value: Value,
        now: float,
    ) -> None:
        while len(cache) >= self._max_entries:
            cache.popitem(last=False)
        cache[key] = _CacheEntry(value, now + self._cache_seconds)
