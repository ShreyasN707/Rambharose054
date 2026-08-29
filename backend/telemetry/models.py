from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Telemetry(Base):
    __tablename__ = "telemetry"

    __table_args__ = (
        UniqueConstraint(
            "engine_id",
            "mission_id",
            "time",
            name="uq_telemetry_event",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    engine_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    mission_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    rpm: Mapped[float] = mapped_column(Float, nullable=False)
    cht: Mapped[float] = mapped_column(Float, nullable=False)
    egt: Mapped[float] = mapped_column(Float, nullable=False)

    oil_pressure: Mapped[float] = mapped_column(Float, nullable=False)
    oil_temperature: Mapped[float] = mapped_column(Float, nullable=False)

    fuel_flow: Mapped[float] = mapped_column(Float, nullable=False)
    vibration: Mapped[float] = mapped_column(Float, nullable=False)

    battery_voltage: Mapped[float] = mapped_column(Float, nullable=False)
    alternator_current: Mapped[float] = mapped_column(Float, nullable=False)

    injection_timing: Mapped[float] = mapped_column(Float, nullable=False)