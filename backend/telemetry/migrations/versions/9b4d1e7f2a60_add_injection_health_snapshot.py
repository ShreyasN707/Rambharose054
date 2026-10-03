"""add injection health snapshot

Adds the rule-based injection health component to health snapshots.
Nullable so snapshots recorded before it existed remain valid.

Revision ID: 9b4d1e7f2a60
Revises: 7c2e9a41b5d3
Create Date: 2026-10-03 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b4d1e7f2a60"
down_revision: Union[str, Sequence[str], None] = "7c2e9a41b5d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "health_snapshots",
        sa.Column(
            "injection",
            sa.Float(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "health_snapshots",
        "injection",
    )
