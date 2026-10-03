"""store predictor outputs in seconds with fault id and explanation

The twin's predictors (twin/predictor.py) report time to failure in
seconds, a fault ID, a confidence band and the signals behind the fault
call. rul_hours (old GRU output) becomes rul_seconds; old values are not
convertible and are dropped.

Revision ID: a7c3e5f19b28
Revises: f2a6d8c41e97
Create Date: 2026-10-04 00:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a7c3e5f19b28"
down_revision: Union[str, Sequence[str], None] = "f2a6d8c41e97"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.drop_column("health_snapshots", "rul_hours")
    op.add_column("health_snapshots", sa.Column("rul_seconds", sa.Float(), nullable=True))
    op.add_column("health_snapshots", sa.Column("rul_low", sa.Float(), nullable=True))
    op.add_column("health_snapshots", sa.Column("rul_high", sa.Float(), nullable=True))
    op.add_column("health_snapshots", sa.Column("fault_id", sa.Integer(), nullable=True))
    op.add_column(
        "health_snapshots",
        sa.Column("top_features", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("health_snapshots", sa.Column("prediction_source", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""

    for column in ("prediction_source", "top_features", "fault_id",
                   "rul_high", "rul_low", "rul_seconds"):
        op.drop_column("health_snapshots", column)
    op.add_column("health_snapshots", sa.Column("rul_hours", sa.Float(), nullable=True))
