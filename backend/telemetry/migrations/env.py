from logging.config import fileConfig

from alembic import context
from sqlalchemy import text

from telemetry.models import Base
from twin.models import HealthSnapshot
from telemetry.database import engine

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# The api and telemetry containers both run `alembic upgrade head` on start.
# A session-level advisory lock serialises them, so the second one finds
# the database already at head instead of re-running the same migration.
MIGRATION_LOCK_ID = 720_260_001


def run_migrations_online() -> None:
    with engine.connect() as connection:
        connection.execute(
            text("SELECT pg_advisory_lock(:id)"),
            {"id": MIGRATION_LOCK_ID},
        )
        connection.commit()

        try:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
            )

            with context.begin_transaction():
                context.run_migrations()
        finally:
            connection.execute(
                text("SELECT pg_advisory_unlock(:id)"),
                {"id": MIGRATION_LOCK_ID},
            )
            connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()