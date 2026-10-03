from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.dependencies import (
    get_session,
    get_telemetry_repo,
    get_health_snapshot_repo,
)
from api.exceptions import MissionNotFoundError, InvalidTimeRangeError
from api.schemas import (
    MissionListResponse,
    MissionSummary,
    MissionResponse,
    TelemetryResponse,
    ReplayResponse,
    ReplayPoint,
    HealthResponse,
    PredictionResponse,
    MissionReportResponse,
)
from telemetry.repository import TelemetryRepository
from twin.report import build_report
from twin.repository import HealthSnapshotRepository


router = APIRouter()


@router.get(
    "/missions",
    response_model=MissionListResponse,
)
def list_missions(
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
):
    mission_ids = telemetry_repo.get_distinct_missions(session)

    return MissionListResponse(
        missions=[
            MissionSummary(mission_id=mid)
            for mid in mission_ids
        ]
    )


@router.get(
    "/missions/{mission_id}",
    response_model=MissionResponse,
)
def get_mission(
    mission_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
):
    rows = telemetry_repo.get_by_mission(
        session,
        mission_id,
    )

    if not rows:
        raise MissionNotFoundError(mission_id)

    return MissionResponse(
        mission_id=mission_id,
        engine_id=rows[0].engine_id,
        start_time=rows[0].time,
        end_time=rows[-1].time,
        sample_count=len(rows),
    )


@router.get(
    "/missions/{mission_id}/report",
    response_model=MissionReportResponse,
)
def mission_report(
    mission_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
    health_repo: HealthSnapshotRepository = Depends(get_health_snapshot_repo),
):
    rows = telemetry_repo.get_by_mission(session, mission_id)

    if not rows:
        raise MissionNotFoundError(mission_id)

    snapshots = health_repo.get_by_mission(
        session,
        rows[0].engine_id,
        mission_id,
    )

    return MissionReportResponse(**build_report(mission_id, rows, snapshots))


@router.get(
    "/missions/{mission_id}/telemetry",
    response_model=list[TelemetryResponse],
)
def mission_telemetry(
    mission_id: str,
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
):
    if start and end:
        if start >= end:
            raise InvalidTimeRangeError(
                "start must be before end"
            )

        rows = telemetry_repo.get_by_time_range(
            session,
            engine_id=_engine_id_for_mission(
                session,
                telemetry_repo,
                mission_id,
            ),
            mission_id=mission_id,
            start_time=start,
            end_time=end,
        )

    else:
        rows = telemetry_repo.get_by_mission(
            session,
            mission_id,
        )

    if not rows:
        raise MissionNotFoundError(mission_id)

    return [
        TelemetryResponse.from_row(r)
        for r in rows
    ]


@router.get(
    "/missions/{mission_id}/replay",
    response_model=ReplayResponse,
)
def mission_replay(
    mission_id: str,
    session: Session = Depends(get_session),
    telemetry_repo: TelemetryRepository = Depends(get_telemetry_repo),
    health_repo: HealthSnapshotRepository = Depends(
        get_health_snapshot_repo
    ),
):
    rows = telemetry_repo.get_by_mission(
        session,
        mission_id,
    )

    if not rows:
        raise MissionNotFoundError(mission_id)

    engine_id = rows[0].engine_id

    snapshots = health_repo.get_by_mission(
        session,
        engine_id,
        mission_id,
    )

    health_by_time = {
        snapshot.time: snapshot
        for snapshot in snapshots
    }

    points = []

    for row in rows:
        snapshot = health_by_time.get(row.time)

        health = None
        prediction = None

        if snapshot is not None:
            health = HealthResponse.from_snapshot(snapshot)

            # Older health snapshots may not contain ML prediction data.
            if (
                snapshot.anomaly_score is not None
                and snapshot.is_anomaly is not None
                and snapshot.confidence is not None
            ):
                prediction = PredictionResponse.from_snapshot(snapshot)

        points.append(
            ReplayPoint(
                timestamp=row.time,
                telemetry=TelemetryResponse.from_row(row),
                health=health,
                prediction=prediction,
            )
        )

    return ReplayResponse(
        mission_id=mission_id,
        engine_id=engine_id,
        points=points,
    )


def _engine_id_for_mission(
    session: Session,
    telemetry_repo: TelemetryRepository,
    mission_id: str,
) -> str:
    rows = telemetry_repo.get_by_mission(
        session,
        mission_id,
    )

    if not rows:
        raise MissionNotFoundError(mission_id)

    return rows[0].engine_id