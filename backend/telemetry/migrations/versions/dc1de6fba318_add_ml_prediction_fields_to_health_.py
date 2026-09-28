"""add ML prediction fields to health snapshots

Revision ID: dc1de6fba318
Revises: 2f3f37c3fb4c
Create Date: 2026-09-28 21:08:58.161976

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "dc1de6fba318"
down_revision: Union[str, Sequence[str], None] = "2f3f37c3fb4c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "health_snapshots",
        sa.Column(
            "anomaly_score",
            sa.Float(),
            nullable=True,
        ),
    )

    op.add_column(
        "health_snapshots",
        sa.Column(
            "is_anomaly",
            sa.Boolean(),
            nullable=True,
        ),
    )

    op.add_column(
        "health_snapshots",
        sa.Column(
            "fault",
            sa.String(),
            nullable=True,
        ),
    )

    op.add_column(
        "health_snapshots",
        sa.Column(
            "confidence",
            sa.Float(),
            nullable=True,
        ),
    )

    op.add_column(
        "health_snapshots",
        sa.Column(
            "rul_hours",
            sa.Float(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "health_snapshots",
        "rul_hours",
    )

    op.drop_column(
        "health_snapshots",
        "confidence",
    )

    op.drop_column(
        "health_snapshots",
        "fault",
    )

    op.drop_column(
        "health_snapshots",
        "is_anomaly",
    )

    op.drop_column(
        "health_snapshots",
        "anomaly_score",
    )