"""Create organizations and append-only audit records.

Revision ID: 0001_organizations_audit
Revises:
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_organizations_audit"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_tenant_ref", sa.String(length=255), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_organizations"),
        sa.UniqueConstraint("external_tenant_ref", name="uq_organizations_external_tenant_ref"),
        sa.UniqueConstraint("id", name="uq_organizations_id"),
        sa.CheckConstraint(
            "state IN ('ACTIVE', 'SUSPENDED', 'DELETED')", name="ck_organizations_state"
        ),
    )
    op.create_table(
        "audit_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_subject", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_ref", sa.String(length=255), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_records"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_audit_records_organization_id_organizations",
            ondelete="RESTRICT",
        ),
    )
    op.create_index(
        "ix_audit_records_organization_occurred_id",
        "audit_records",
        ["organization_id", "occurred_at", "id"],
    )
    op.create_index(
        "ix_audit_records_organization_actor_occurred",
        "audit_records",
        ["organization_id", "actor_subject", "occurred_at"],
    )
    op.execute("GRANT SELECT, INSERT ON TABLE organizations TO qubrix_runtime")
    op.execute("GRANT SELECT, INSERT ON TABLE audit_records TO qubrix_runtime")
    op.execute(
        "REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER "
        "ON TABLE audit_records FROM qubrix_runtime"
    )


def downgrade() -> None:
    op.execute("REVOKE ALL PRIVILEGES ON TABLE audit_records FROM qubrix_runtime")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE organizations FROM qubrix_runtime")
    op.drop_index("ix_audit_records_organization_actor_occurred", table_name="audit_records")
    op.drop_index("ix_audit_records_organization_occurred_id", table_name="audit_records")
    op.drop_table("audit_records")
    op.drop_table("organizations")
