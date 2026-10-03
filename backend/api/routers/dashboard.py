from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import (
    get_session,
    get_telemetry_repo,
    get_health_snapshot_repo,
)
from api.exceptions import EngineNotFoundError
from api.schemas import (
    DashboardResponse,
    TelemetryResponse,
    AdvisoryResponse,
    HealthResponse,
    PredictionResponse,
    AlertResponse,
    HealthHistoryPoint,
    operating_state_of,
)
from telemetry.repository import TelemetryRepository
from twin.repository import HealthSnapshotRepository

router = APIRouter()


@router.get(
    "/dashboard/{engine_id}",
    response_model=DashboardResponse,
)
def dashboard(
    engine_id: str,
    mission_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
    health_repo: HealthSnapshotRepository = Depends(get_health_snapshot_repo),
):
    latest_row = telemetry_repo.get_latest(session, engine_id, mission_id)
    if latest_row is None:
        raise EngineNotFoundError(engine_id)

    latest_telemetry = TelemetryResponse.from_row(latest_row)

    # The telemetry service stores health, prediction and advisory with
    # every snapshot; the dashboard only reads them.
    snapshots = health_repo.get_recent(session, engine_id, mission_id, 20)

    health = prediction = advisory = operating_state = None
    recent_health_history = []

    if snapshots:
        latest_snapshot = snapshots[-1]
        health = HealthResponse.from_snapshot(latest_snapshot)
        prediction = PredictionResponse.from_snapshot(latest_snapshot)
        advisory = AdvisoryResponse.from_snapshot(latest_snapshot)
        operating_state = operating_state_of(latest_snapshot)
        recent_health_history = [
            HealthHistoryPoint(
                timestamp=s.time,
                health=HealthResponse.from_snapshot(s),
            )
            for s in snapshots
        ]

    alerts: list[AlertResponse] = []
    for s in snapshots:
        if s.overall < 60:
            alerts.append(
                AlertResponse(
                    engine_id=engine_id,
                    mission_id=mission_id,
                    severity="DEGRADED",
                    message=f"Overall health dropped to {s.overall}",
                    source="operating_state",
                    timestamp=s.time,
                )
            )

    events = telemetry_repo.get_ingestion_events(session, engine_id, mission_id)
    for e in events:
        alerts.append(
            AlertResponse(
                engine_id=engine_id,
                mission_id=mission_id,
                severity="WARNING",
                message=f"Ingestion event: {e.event_type}",
                source="ingestion_event",
                timestamp=e.event_time,
            )
        )
    alerts.sort(key=lambda a: a.timestamp)

    return DashboardResponse(
        engine_id=engine_id,
        mission_id=mission_id,
        latest_telemetry=latest_telemetry,
        health=health,
        prediction=prediction,
        operating_state=operating_state,
        advisory=advisory,
        alerts=alerts,
        recent_health_history=recent_health_history,
    )
