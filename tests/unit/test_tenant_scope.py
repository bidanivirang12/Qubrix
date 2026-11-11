from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import Integer, Uuid, column, select

from app.db.tenant_scope import TenantScope, TenantScopeRequired


def test_tenant_scope_fails_closed_without_organization_id() -> None:
    query = select(column("id", Integer))
    with pytest.raises(TenantScopeRequired, match="organization_id is required"):
        query.where(TenantScope(None).predicate(column("organization_id", Uuid)))


def test_tenant_scope_builds_organization_predicate() -> None:
    organization_id = UUID("6a79d6d8-23d3-4c14-bca7-6621be7d1701")
    query = select(column("id", Integer)).where(
        TenantScope(organization_id).predicate(column("organization_id", Uuid))
    )
    compiled = query.compile()
    assert "organization_id = :organization_id_1" in str(compiled)
    assert compiled.params["organization_id_1"] == organization_id
