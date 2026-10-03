"""add sensor health snapshot

Adds the rule-based instrumentation (CHT sensor) health component to
health snapshots. Nullable so older snapshots remain valid.

Revision ID: c3a8f2d91b47
Revises: 9b4d1e7f2a60
Create Date: 2026-10-03 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3a8f2d91b47"
down_revision: Union[str, Sequence[str], None] = "9b4d1e7f2a60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "health_snapshots",
        sa.Column(
            "sensor",
            sa.Float(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "health_snapshots",
        "sensor",
    )
