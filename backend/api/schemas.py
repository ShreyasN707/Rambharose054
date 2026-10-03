from datetime import datetime

from pydantic import BaseModel

from telemetry.models import Telemetry
from twin.models import HealthSnapshot
from twin.schemas import HealthState, MLPrediction
from twin.service import DigitalTwinService


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

    # Simulink simulation clock; None for telemetry recorded before it existed
    sim_time: float | None = None               # s

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
            sim_time=row.sim_time,
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
    # Normalised so that 1.0 is the detector's threshold.
    anomaly_score: float
    is_anomaly: bool
    fault_id: int | None = None
    fault: str | None
    confidence: float
    rul_seconds: float | None = None     # 600 = "10 min or more"
    rul_low: float | None = None
    rul_high: float | None = None
    top_features: list[tuple[str, float]] = []
    source: str | None = None

    @classmethod
    def from_snapshot(cls, snapshot: HealthSnapshot) -> "PredictionResponse":
        return cls(
            anomaly_score=snapshot.anomaly_score or 0.0,
            is_anomaly=bool(snapshot.is_anomaly),
            fault_id=snapshot.fault_id,
            fault=snapshot.fault,
            confidence=snapshot.confidence or 0.0,
            rul_seconds=snapshot.rul_seconds,
            rul_low=snapshot.rul_low,
            rul_high=snapshot.rul_high,
            top_features=[tuple(f) for f in (snapshot.top_features or [])],
            source=snapshot.prediction_source,
        )


def operating_state_of(snapshot: HealthSnapshot) -> str:
    """Operating state of a stored snapshot (same rules as the live twin)."""

    return DigitalTwinService._determine_operating_state(
        HealthState(**HealthResponse.from_snapshot(snapshot).model_dump()),
        MLPrediction(**PredictionResponse.from_snapshot(snapshot).model_dump()),
    )


class AdvisoryResponse(BaseModel):
    # MONITOR / CAUTION / WARNING / CRITICAL (twin/advisory.py)
    level: str
    fault_family: str
    title: str
    eta_seconds: float | None       # estimated time to failure; None if no trend
    evidence: list[str]
    do_now: list[str]
    maintenance: list[str]

    @classmethod
    def from_snapshot(
        cls, snapshot: HealthSnapshot
    ) -> "AdvisoryResponse | None":
        if not snapshot.advisory:
            return None
        return cls(**snapshot.advisory)


class EngineHealthResponse(BaseModel):
    engine_id: str
    mission_id: str
    operating_state: str
    health: HealthResponse
    prediction: PredictionResponse
    advisory: AdvisoryResponse | None = None


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


class ReportFault(BaseModel):
    fault: str
    first_detected_at_s: float      # seconds since mission start
    seconds_detected: int


class ReportAdvisory(BaseModel):
    at_s: float                     # seconds since mission start
    level: str                      # MONITOR / CAUTION / WARNING / CRITICAL / CLEARED
    title: str
    eta_seconds: float | None = None
    do_now: list[str] = []


class MissionReportResponse(BaseModel):
    """Mission-wise health report (twin/report.py)."""

    mission_id: str
    engine_id: str
    profile: str | None
    start_time: datetime
    end_time: datetime
    duration_s: float
    samples: int
    max_altitude_m: float
    ambient_min_c: float
    ambient_max_c: float
    mean_throttle: float
    efficiency_mean: float | None = None
    efficiency_min: float | None = None
    outcome: str                    # NOMINAL / DEGRADED / FAILURE / NO HEALTH DATA
    failure_at_s: float | None = None
    final_health: float | None = None
    min_health: float | None = None
    min_health_at_s: float | None = None
    weakest_subsystem: str | None = None
    weakest_subsystem_health: float | None = None
    weakest_subsystem_at_s: float | None = None
    min_time_to_failure_s: float | None = None
    faults: list[ReportFault]
    advisories: list[ReportAdvisory]
    maintenance: list[str]


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
    advisory: AdvisoryResponse | None = None
    alerts: list[AlertResponse]
    recent_health_history: list[HealthHistoryPoint]