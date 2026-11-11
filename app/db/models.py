from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Integer,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("external_tenant_ref", name="uq_organizations_external_tenant_ref"),
        UniqueConstraint("id", name="uq_organizations_id"),
        PrimaryKeyConstraint(name="pk_organizations"),
        CheckConstraint(
            "state IN ('ACTIVE', 'SUSPENDED', 'DELETED')",
            name="ck_organizations_state",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    external_tenant_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IdentityStatus(Base):
    __tablename__ = "identity_status"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_identity_status_organization_id_organizations",
            ondelete="RESTRICT",
        ),
        PrimaryKeyConstraint("organization_id", "subject", name="pk_identity_status"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
    )
    subject: Mapped[str] = mapped_column(String(255), primary_key=True)
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tokens_valid_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RateLimitWindow(Base):
    __tablename__ = "rate_limit_windows"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_rate_limit_windows_organization_id_organizations",
            ondelete="RESTRICT",
        ),
        PrimaryKeyConstraint(
            "organization_id",
            "subject",
            "route_class",
            "window_start",
            name="pk_rate_limit_windows",
        ),
        CheckConstraint("request_count > 0", name="ck_rate_limit_windows_request_count"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
    )
    subject: Mapped[str] = mapped_column(String(255), primary_key=True)
    route_class: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
