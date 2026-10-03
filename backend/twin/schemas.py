from datetime import datetime

from pydantic import BaseModel

from twin.advisory import Advisory


class MLPrediction(BaseModel):
    # Normalised so that 1.0 is the detector's threshold.
    anomaly_score: float
    is_anomaly: bool = False
    fault_id: int | None = None       # 0 healthy, 1-9 faults (predictor.FAULTS)
    fault: str | None = None          # display name; None when healthy
    confidence: float = 0.0           # 0-1
    rul_seconds: float | None = None  # 0-600; 600 = "10 min or more"
    rul_low: float | None = None
    rul_high: float | None = None
    top_features: list[tuple[str, float]] = []
    source: str | None = None         # which predictors produced it


class HealthState(BaseModel):
    overall: float
    thermal: float
    combustion: float
    lubrication: float
    mechanical: float
    # None when telemetry lacks electrical / injection signals; included
    # in `overall` whenever present.
    electrical: float | None = None
    injection: float | None = None
    # Instrumentation health (CHT sensor jitter). Not part of `overall`.
    sensor: float | None = None


class DigitalTwinState(BaseModel):
    engine_id: str
    mission_id: str
    operating_state: str

    health: HealthState
    prediction: MLPrediction
    advisory: Advisory | None = None


class HealthSnapshot(BaseModel):
    engine_id: str
    mission_id: str
    timestamp: datetime
    health: HealthState