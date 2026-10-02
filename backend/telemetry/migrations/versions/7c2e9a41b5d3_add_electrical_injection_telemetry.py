"""add electrical and injection telemetry

Adds the Simulink Electrical_Model / Injection_Model signals to telemetry
and the rule-based electrical health component to health snapshots.

All columns are nullable so telemetry and snapshots recorded before these
signals existed remain valid. This is a new forward migration; the old
063319a65a67 downgrade (NOT NULL, no default) is deliberately not reused.

Revision ID: 7c2e9a41b5d3
Revises: dc1de6fba318
Create Date: 2026-10-02 21:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c2e9a41b5d3"
down_revision: Union[str, Sequence[str], None] = "dc1de6fba318"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TELEMETRY_COLUMNS = (
    "battery_voltage",       # V
    "alternator_current",    # A
    "injection_timing",      # deg BTDC
    "injection_duration",    # ms
)


def upgrade() -> None:
    """Upgrade schema."""

    for column in TELEMETRY_COLUMNS:
        op.add_column(
            "telemetry",
            sa.Column(
                column,
                sa.Float(),
                nullable=True,
            ),
        )

    op.add_column(
        "health_snapshots",
        sa.Column(
            "electrical",
            sa.Float(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "health_snapshots",
        "electrical",
    )

    for column in reversed(TELEMETRY_COLUMNS):
        op.drop_column(
            "telemetry",
            column,
        )
