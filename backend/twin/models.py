from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from telemetry.models import Base


class HealthSnapshot(Base):
    __tablename__ = "health_snapshots"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    time: Mapped[datetime] = mapped_column(
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

    overall: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    thermal: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    combustion: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    lubrication: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    mechanical: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    electrical: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    injection: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    sensor: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    anomaly_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    is_anomaly: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    fault: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    rul_hours: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )