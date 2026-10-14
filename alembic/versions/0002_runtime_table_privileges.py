"""Restrict runtime privileges to the explicit foundation table allowlist.

Revision ID: 0002_runtime_table_privileges
Revises: 0001_organizations_audit
"""

from alembic import op

revision = "0002_runtime_table_privileges"
down_revision = "0001_organizations_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM qubrix_runtime"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE qubrix_app IN SCHEMA public "
        "REVOKE ALL ON SEQUENCES FROM qubrix_runtime"
    )
    op.execute("REVOKE ALL PRIVILEGES ON TABLE organizations FROM PUBLIC, qubrix_runtime")
    op.execute("GRANT SELECT, INSERT, UPDATE ON TABLE organizations TO qubrix_runtime")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE audit_records FROM PUBLIC, qubrix_runtime")
    op.execute("GRANT SELECT, INSERT ON TABLE audit_records TO qubrix_runtime")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE alembic_version FROM PUBLIC, qubrix_runtime")


def downgrade() -> None:
    # Never restore broad or inherited runtime privileges during a rollback.
    pass
