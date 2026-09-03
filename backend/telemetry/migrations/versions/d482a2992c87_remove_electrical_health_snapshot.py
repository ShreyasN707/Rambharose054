"""remove electrical health snapshot

Revision ID: d482a2992c87
Revises: 063319a65a67
Create Date: 2026-09-04 00:13:04.863280

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd482a2992c87'
down_revision: Union[str, Sequence[str], None] = '063319a65a67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("health_snapshots", "electrical")


def downgrade() -> None:
    op.add_column(
        "health_snapshots",
        sa.Column("electrical", sa.Float(), nullable=False, server_default="100"),
    )
