"""Add subject status and atomic authenticated rate windows.

Revision ID: 0003_identity_rate_revocation
Revises: 0002_runtime_table_privileges
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003_identity_rate_revocation"
down_revision = "0002_runtime_table_privileges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "identity_status",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tokens_valid_after", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_identity_status_organization_id_organizations",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "organization_id",
            "subject",
            name="pk_identity_status",
        ),
    )
    op.create_table(
        "rate_limit_windows",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("route_class", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="fk_rate_limit_windows_organization_id_organizations",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "organization_id",
            "subject",
            "route_class",
            "window_start",
            name="pk_rate_limit_windows",
        ),
        sa.CheckConstraint(
            "request_count > 0",
            name="ck_rate_limit_windows_request_count",
        ),
    )
    op.create_index(
        "ix_rate_limit_windows_window_start",
        "rate_limit_windows",
        ["window_start"],
    )
    op.execute(
        "REVOKE ALL PRIVILEGES ON TABLE identity_status FROM PUBLIC, qubrix_runtime"
    )
    op.execute("GRANT SELECT ON TABLE identity_status TO qubrix_runtime")
    op.execute(
        "REVOKE ALL PRIVILEGES ON TABLE rate_limit_windows FROM PUBLIC, qubrix_runtime"
    )
    # DELETE is required by the bounded-retention cleanup function for expired windows.
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE rate_limit_windows TO qubrix_runtime"
    )


def downgrade() -> None:
    op.execute("REVOKE ALL PRIVILEGES ON TABLE rate_limit_windows FROM qubrix_runtime")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE rate_limit_windows FROM PUBLIC")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE identity_status FROM qubrix_runtime")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE identity_status FROM PUBLIC")
    op.drop_index("ix_rate_limit_windows_window_start", table_name="rate_limit_windows")
    op.drop_table("rate_limit_windows")
    op.drop_table("identity_status")
