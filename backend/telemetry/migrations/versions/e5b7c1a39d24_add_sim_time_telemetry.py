"""add sim_time to telemetry

Stores the Simulink simulation clock published with each sample so the
dashboard can show the same time base the fault onset/progression uses.

Nullable so telemetry recorded before the simulator published it remains
valid.

Revision ID: e5b7c1a39d24
Revises: c3a8f2d91b47
Create Date: 2026-10-03 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5b7c1a39d24"
down_revision: Union[str, Sequence[str], None] = "c3a8f2d91b47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "telemetry",
        sa.Column(
            "sim_time",
            sa.Float(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "telemetry",
        "sim_time",
    )
