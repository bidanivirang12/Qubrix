from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class Principal:
    subject: str
    organization_id: UUID
    roles: frozenset[str]
    scopes: frozenset[str]
