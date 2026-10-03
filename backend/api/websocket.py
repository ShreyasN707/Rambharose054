import asyncio

from fastapi import WebSocket, WebSocketDisconnect

from api.schemas import (
    AdvisoryResponse,
    HealthResponse,
    PredictionResponse,
    TelemetryResponse,
    operating_state_of,
)
from telemetry.database import SessionLocal
from telemetry.repository import TelemetryRepository
from twin.repository import HealthSnapshotRepository
import traceback

POLL_INTERVAL_SECONDS = 2

_telemetry_repo = TelemetryRepository()
_health_repo = HealthSnapshotRepository()


class ConnectionManager:
    def __init__(self):
        self.connections: dict[tuple[str, str], set[WebSocket]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        engine_id: str,
        mission_id: str,
    ):
        await websocket.accept()

        key = (engine_id, mission_id)
        self.connections.setdefault(key, set()).add(websocket)
        print(f"[WS] Connected: {engine_id}/{mission_id}")

    def disconnect(
        self,
        websocket: WebSocket,
        engine_id: str,
        mission_id: str,
    ):
        key = (engine_id, mission_id)

        if key in self.connections:
            self.connections[key].discard(websocket)

            if not self.connections[key]:
                del self.connections[key]

    async def run(self):
        while True:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

            try:
                await self._poll_and_broadcast()
            except Exception:
                print("[WS] Broadcast error:")
                traceback.print_exc()

    async def _poll_and_broadcast(self):
        for key in list(self.connections.keys()):
            engine_id, mission_id = key
            sockets = self.connections.get(key)

            if not sockets:
                continue

            payload = self._build_payload(engine_id, mission_id)
            print(f"[WS] Broadcasting: {engine_id}/{mission_id}")

            if payload is None:
                continue

            dead = set()

            for websocket in sockets:
                try:
                    await websocket.send_json(payload)
                except Exception:
                    dead.add(websocket)

            for websocket in dead:
                sockets.discard(websocket)

    def _build_payload(
        self,
        engine_id: str,
        mission_id: str,
    ) -> dict | None:

        session = SessionLocal()

        try:
            latest_row = _telemetry_repo.get_latest(
                session,
                engine_id,
                mission_id,
            )

            if latest_row is None:
                return None

            telemetry = TelemetryResponse.from_row(
                latest_row
            ).model_dump(mode="json")

            # Health, prediction and advisory are computed once per
            # sample by the telemetry service and stored with the snapshot.
            snapshot = _health_repo.get_latest(
                session,
                engine_id,
                mission_id,
            )

            health = prediction = advisory = operating_state = None

            if snapshot is not None:
                health = HealthResponse.from_snapshot(
                    snapshot
                ).model_dump(mode="json")
                prediction = PredictionResponse.from_snapshot(
                    snapshot
                ).model_dump(mode="json")
                latest_advisory = AdvisoryResponse.from_snapshot(snapshot)
                if latest_advisory is not None:
                    advisory = latest_advisory.model_dump(mode="json")
                operating_state = operating_state_of(snapshot)

            return {
                "type": "engine_update",
                "engine_id": engine_id,
                "mission_id": mission_id,
                "telemetry": telemetry,
                "health": health,
                "prediction": prediction,
                "operating_state": operating_state,
                "advisory": advisory,
            }

        finally:
            session.close()


ws_manager = ConnectionManager()


async def websocket_endpoint(
    websocket: WebSocket,
    engine_id: str,
    mission_id: str,
):
    await ws_manager.connect(
        websocket,
        engine_id,
        mission_id,
    )

    try:
        while True:
            await asyncio.sleep(60)

    except WebSocketDisconnect:
        ws_manager.disconnect(
            websocket,
            engine_id,
            mission_id,
        )

    except Exception:
        ws_manager.disconnect(
            websocket,
            engine_id,
            mission_id,
        )