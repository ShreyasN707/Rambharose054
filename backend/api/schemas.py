from datetime import datetime

from pydantic import BaseModel

from telemetry.models import Telemetry
from twin.models import HealthSnapshot
from twin.service import ANOMALY_THRESHOLD  # noqa: F401 (re-exported)


# ---------------------------------------------------------------------------
# Telemetry
# ---------------------------------------------------------------------------

class TelemetryResponse(BaseModel):
    timestamp: datetime
    engine_id: str
    mission_id: str
    rpm: float
    torque: float
    cht: float
    egt: float
    oil_pressure: float
    oil_temperature: float
    fuel_flow: float
    vibration: float

    # Operating conditions (Simulink inputs)
    throttle: float | None = None               # 0-1
    engine_load: float | None = None            # 0-1
    altitude: float | None = None               # m
    ambient_temperature: float | None = None    # °C

    # Electrical system; None for telemetry recorded before these existed
    battery_voltage: float | None = None        # V
    alternator_current: float | None = None     # A

    # ECU injection parameters
    injection_timing: float | None = None       # deg BTDC
    injection_duration: float | None = None     # ms

    @classmethod
    def from_row(cls, row: Telemetry) -> "TelemetryResponse":
        return cls(
            timestamp=row.time,
            engine_id=row.engine_id,
            mission_id=row.mission_id,
            rpm=row.rpm,
            torque=row.torque,
            cht=row.cht,
            egt=row.egt,
            oil_pressure=row.oil_pressure,
            oil_temperature=row.oil_temperature,
            fuel_flow=row.fuel_flow,
            vibration=row.vibration,
            throttle=row.throttle,
            engine_load=row.engine_load,
            altitude=row.altitude,
            ambient_temperature=row.ambient_temperature,
            battery_voltage=row.battery_voltage,
            alternator_current=row.alternator_current,
            injection_timing=row.injection_timing,
            injection_duration=row.injection_duration,
        )


# ---------------------------------------------------------------------------
# Health / Prediction (mirror twin/schemas.py shapes, kept separate on purpose
# so the API layer's response contract doesn't break if twin/schemas.py changes)
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    overall: float
    thermal: float
    combustion: float
    lubrication: float
    mechanical: float
    # None for snapshots recorded before these signals existed.
    electrical: float | None = None
    injection: float | None = None
    # Instrumentation health; not part of `overall`.
    sensor: float | None = None

    @classmethod
    def from_snapshot(cls, snapshot: HealthSnapshot) -> "HealthResponse":
        return cls(
            overall=snapshot.overall,
            thermal=snapshot.thermal,
            combustion=snapshot.combustion,
            lubrication=snapshot.lubrication,
            mechanical=snapshot.mechanical,
            electrical=snapshot.electrical,
            injection=snapshot.injection,
            sensor=snapshot.sensor,
        )


class PredictionResponse(BaseModel):
    anomaly_score: float
    is_anomaly: bool
    fault: str | None
    confidence: float
    rul_hours: float | None


class EngineHealthResponse(BaseModel):
    engine_id: str
    mission_id: str
    operating_state: str
    health: HealthResponse
    prediction: PredictionResponse


class HealthHistoryPoint(BaseModel):
    timestamp: datetime
    health: HealthResponse


class HealthHistoryResponse(BaseModel):
    engine_id: str
    mission_id: str
    history: list[HealthHistoryPoint]


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertResponse(BaseModel):
    engine_id: str
    mission_id: str
    severity: str          # NOMINAL / WARNING / DEGRADED / CRITICAL
    message: str
    source: str             # "operating_state" | "ingestion_event"
    timestamp: datetime


# ---------------------------------------------------------------------------
# Engines
# ---------------------------------------------------------------------------

class EngineSummary(BaseModel):
    engine_id: str


class EngineListResponse(BaseModel):
    engines: list[EngineSummary]


# ---------------------------------------------------------------------------
# Missions
# ---------------------------------------------------------------------------

class MissionSummary(BaseModel):
    mission_id: str


class MissionListResponse(BaseModel):
    missions: list[MissionSummary]


class MissionResponse(BaseModel):
    mission_id: str
    engine_id: str
    start_time: datetime
    end_time: datetime
    sample_count: int


# ---------------------------------------------------------------------------
# Replay
# ---------------------------------------------------------------------------

class ReplayPoint(BaseModel):
    timestamp: datetime
    telemetry: TelemetryResponse
    health: HealthResponse | None = None
    prediction: PredictionResponse | None = None


class ReplayResponse(BaseModel):
    mission_id: str
    engine_id: str
    points: list[ReplayPoint]


# ---------------------------------------------------------------------------
# Dashboard (aggregation)
# ---------------------------------------------------------------------------

class DashboardResponse(BaseModel):
    engine_id: str
    mission_id: str
    latest_telemetry: TelemetryResponse | None
    health: HealthResponse | None
    prediction: PredictionResponse | None
    operating_state: str | None
    alerts: list[AlertResponse]
    recent_health_history: list[HealthHistoryPoint]