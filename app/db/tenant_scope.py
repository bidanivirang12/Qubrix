from __future__ import annotations

from uuid import UUID

from sqlalchemy.sql import ColumnElement


class TenantScopeRequired(ValueError):
    """Raised when a tenant-owned query is constructed without an organization."""


class TenantScope:
    def __init__(self, organization_id: UUID | None) -> None:
        if not isinstance(organization_id, UUID):
            raise TenantScopeRequired("organization_id is required for tenant-scoped queries")
        self.organization_id = organization_id

    def predicate(self, organization_column: ColumnElement[UUID]) -> ColumnElement[bool]:
        return organization_column == self.organization_id
