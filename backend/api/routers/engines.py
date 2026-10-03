import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.dependencies import (
    get_session,
    get_telemetry_repo,
    get_health_snapshot_repo,
)
from api.exceptions import EngineNotFoundError
from api.schemas import (
    EngineListResponse,
    EngineSummary,
    TelemetryResponse,
    EngineHealthResponse,
    AdvisoryResponse,
    HealthResponse,
    PredictionResponse,
    HealthHistoryResponse,
    HealthHistoryPoint,
    AlertResponse,
    operating_state_of,
)
from telemetry.repository import TelemetryRepository
from twin.repository import HealthSnapshotRepository

import paho.mqtt.client as mqtt


router = APIRouter()


# ---------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------

@router.get("/engines", response_model=EngineListResponse)
def list_engines(
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
):
    engine_ids = telemetry_repo.get_distinct_engines(session)

    return EngineListResponse(
        engines=[
            EngineSummary(engine_id=eid)
            for eid in engine_ids
        ]
    )

@router.get("/engines/{engine_id}/simulation/status")
def get_simulation_status(
    engine_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
):

    try:
        response = requests.get(
            f"{SIMULATION_CONTROLLER_URL}/simulation/status",
            timeout=5,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to get simulation status: {exc}",
        )
        
@router.get(
    "/engines/{engine_id}",
    response_model=EngineSummary,
)
def get_engine(
    engine_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
):

    return EngineSummary(engine_id=engine_id)


# ---------------------------------------------------------
# Fault injection
# ---------------------------------------------------------

# Simulink Fault_ID values: 0 = healthy, 1 = misfire, 2 = overheating,
# 3 = oil pressure failure, 4 = fuel starvation, 5 = injector abnormality,
# 6 = cooling degradation, 7 = CHT sensor drift/failure,
# 8 = combustion instability, 9 = abnormal vibration.
VALID_FAULT_IDS = range(0, 10)


@router.post("/engines/{engine_id}/fault")
def inject_fault(
    engine_id: str,
    fault_id: int,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(
        get_telemetry_repo
    ),
):
    if fault_id not in VALID_FAULT_IDS:
        raise HTTPException(
            status_code=400,
            detail=(
                "fault_id must be one of "
                + ", ".join(str(i) for i in VALID_FAULT_IDS)
            ),
        )

    if engine_id not in telemetry_repo.get_distinct_engines(
        session
    ):
        raise EngineNotFoundError(engine_id)

    topic = f"engine/{engine_id}/fault"

    client = mqtt.Client()

    try:
        client.connect(
            "mosquitto",
            1883,
            60,
        )

        client.loop_start()

        message = client.publish(
            topic,
            str(fault_id),
            qos=1,
        )

        message.wait_for_publish()

        client.loop_stop()
        client.disconnect()

    except Exception as exc:
        client.loop_stop()
        client.disconnect()

        raise HTTPException(
            status_code=503,
            detail=f"Failed to publish fault command: {exc}",
        )

    return {
        "engine_id": engine_id,
        "fault_id": fault_id,
        "status": "published",
    }

SIMULATION_CONTROLLER_URL = "http://host.docker.internal:9000"


@router.post("/engines/{engine_id}/simulation/start")
def start_simulation(
    engine_id: str,
    profile: str = "cruise",
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(
        get_telemetry_repo
    ),
):

    # The controller validates the profile name and returns the new
    # mission ID for this run.
    try:
        response = requests.post(
            f"{SIMULATION_CONTROLLER_URL}/simulation/start",
            params={"profile": profile},
            timeout=5,
        )

        if response.status_code == 422:
            raise HTTPException(
                status_code=422,
                detail=response.json().get("detail"),
            )


        response.raise_for_status()

        return response.json()

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to start simulation: {exc}",
        )


@router.post("/engines/{engine_id}/simulation/stop")
def stop_simulation(
    engine_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(
        get_telemetry_repo
    ),
):

    try:
        response = requests.post(
            f"{SIMULATION_CONTROLLER_URL}/simulation/stop",
            timeout=5,
        )

        response.raise_for_status()

        return response.json()

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to stop simulation: {exc}",
        )

# ---------------------------------------------------------
# Latest telemetry
# ---------------------------------------------------------

@router.get(
    "/engines/{engine_id}/telemetry/latest",
    response_model=TelemetryResponse,
)
def latest_telemetry(
    engine_id: str,
    mission_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(
        get_telemetry_repo
    ),
):
    row = telemetry_repo.get_latest(
        session,
        engine_id,
        mission_id,
    )

    if row is None:
        raise EngineNotFoundError(engine_id)

    return TelemetryResponse.from_row(row)


# ---------------------------------------------------------
# Engine health
# ---------------------------------------------------------

@router.get(
    "/engines/{engine_id}/health",
    response_model=EngineHealthResponse,
)
def engine_health(
    engine_id: str,
    mission_id: str,
    session: Session = Depends(get_session),
    health_repo: HealthSnapshotRepository = Depends(
        get_health_snapshot_repo
    ),
):
    # Health, prediction and advisory are stored with every snapshot by
    # the telemetry service.
    latest_snapshot = health_repo.get_latest(
        session,
        engine_id,
        mission_id,
    )

    if latest_snapshot is None:
        raise EngineNotFoundError(engine_id)

    return EngineHealthResponse(
        engine_id=engine_id,
        mission_id=mission_id,
        operating_state=operating_state_of(latest_snapshot),
        health=HealthResponse.from_snapshot(latest_snapshot),
        prediction=PredictionResponse.from_snapshot(latest_snapshot),
        advisory=AdvisoryResponse.from_snapshot(latest_snapshot),
    )


# ---------------------------------------------------------
# Health history
# ---------------------------------------------------------

@router.get(
    "/engines/{engine_id}/health/history",
    response_model=HealthHistoryResponse,
)
def health_history(
    engine_id: str,
    mission_id: str,
    session: Session = Depends(get_session),
    health_repo: HealthSnapshotRepository = Depends(
        get_health_snapshot_repo
    ),
):
    snapshots = health_repo.get_by_mission(
        session,
        engine_id,
        mission_id,
    )

    if not snapshots:
        raise EngineNotFoundError(engine_id)

    return HealthHistoryResponse(
        engine_id=engine_id,
        mission_id=mission_id,
        history=[
            HealthHistoryPoint(
                timestamp=s.time,
                health=HealthResponse.from_snapshot(s),
            )
            for s in snapshots
        ],
    )


# ---------------------------------------------------------
# Alerts
# ---------------------------------------------------------

@router.get(
    "/engines/{engine_id}/alerts",
    response_model=list[AlertResponse],
)
def engine_alerts(
    engine_id: str,
    mission_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(
        get_telemetry_repo
    ),
    health_repo: HealthSnapshotRepository = Depends(
        get_health_snapshot_repo
    ),
):
    alerts: list[AlertResponse] = []

    snapshots = health_repo.get_by_mission(
        session,
        engine_id,
        mission_id,
    )

    for s in snapshots:

        if s.overall < 60:

            alerts.append(
                AlertResponse(
                    engine_id=engine_id,
                    mission_id=mission_id,
                    severity="DEGRADED",
                    message=(
                        f"Overall health dropped to "
                        f"{s.overall}"
                    ),
                    source="operating_state",
                    timestamp=s.time,
                )
            )

    events = telemetry_repo.get_ingestion_events(
        session,
        engine_id,
        mission_id,
    )

    for e in events:

        alerts.append(
            AlertResponse(
                engine_id=engine_id,
                mission_id=mission_id,
                severity="WARNING",
                message=(
                    f"Ingestion event: "
                    f"{e.event_type}"
                ),
                source="ingestion_event",
                timestamp=e.event_time,
            )
        )

    alerts.sort(
        key=lambda a: a.timestamp
    )

    return alerts