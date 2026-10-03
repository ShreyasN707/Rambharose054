"""add maintenance advisory to health snapshots

Stores the twin's maintenance advisory (twin/advisory.py) with each
health snapshot, so the dashboard, WebSocket and mission reports can show
what was recommended and when.

Nullable: no advisory while the engine is nominal, and snapshots
recorded before advisories existed stay valid.

Revision ID: f2a6d8c41e97
Revises: e5b7c1a39d24
Create Date: 2026-10-03 22:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f2a6d8c41e97"
down_revision: Union[str, Sequence[str], None] = "e5b7c1a39d24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "health_snapshots",
        sa.Column(
            "advisory",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "health_snapshots",
        "advisory",
    )
