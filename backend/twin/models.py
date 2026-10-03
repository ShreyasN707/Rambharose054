from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
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

    fault_id: Mapped[int | None] = mapped_column(
        Integer,
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

    rul_seconds: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    rul_low: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    rul_high: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    # [[signal, contribution], ...] behind the fault call.
    top_features: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    # Which predictors produced the prediction (rules, health-trend or a
    # trained model's name).
    prediction_source: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    # Maintenance advisory (twin/advisory.py Advisory) or None when the
    # engine is nominal.
    advisory: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )