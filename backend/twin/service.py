from datetime import datetime

from sqlalchemy.orm import Session

from telemetry.repository import TelemetryRepository
from telemetry.schemas import TelemetryCreate

from twin.ml import MLPredictor
from twin.models import HealthSnapshot
from twin.repository import HealthSnapshotRepository
from twin.schemas import (
    DigitalTwinState,
    HealthState,
    MLPrediction,
)


class DigitalTwinService:

    def __init__(
        self,
        repository: HealthSnapshotRepository,
        telemetry_repository: TelemetryRepository,
        predictor: MLPredictor,
    ):
        self.repository = repository
        self.telemetry_repository = telemetry_repository
        self.predictor = predictor


    def process(
        self,
        session: Session,
        telemetry: TelemetryCreate,
    ) -> DigitalTwinState | None:

        telemetry_records = (
            self.telemetry_repository.get_latest_window(
                session,
                telemetry.engine_id,
                telemetry.mission_id,
            )
        )

        if len(telemetry_records) < 60:
            return None

        telemetry_window = [
            {
                "rpm": item.rpm,
                "cht": item.cht,
                "egt": item.egt,
                "oil_pressure": item.oil_pressure,
                "torque": item.torque,
                "oil_temperature": item.oil_temperature,
                "fuel_flow": item.fuel_flow,
                "vibration": item.vibration,
                "throttle": item.throttle,
                "engine_load": item.engine_load,
                "altitude": item.altitude,
                "ambient_temperature": item.ambient_temperature,
            }
            for item in telemetry_records
        ]

        prediction = self.predictor.predict(
            telemetry_window,
        )
        
        state = self.build_state(
            telemetry,
            prediction,
        )

        self.save_health_snapshot(
            session,
            state,
            telemetry.timestamp,
        )

        return state

    def calculate_health(
        self,
        telemetry: TelemetryCreate,
    ) -> HealthState:

        thermal = self._thermal_health(telemetry)
        combustion = self._combustion_health(telemetry)
        lubrication = self._lubrication_health(telemetry)
        mechanical = self._mechanical_health(telemetry)

        overall = (
            thermal
            + combustion
            + lubrication
            + mechanical
        ) / 4

        return HealthState(
            overall=round(overall, 2),
            thermal=thermal,
            combustion=combustion,
            lubrication=lubrication,
            mechanical=mechanical,
        )

    def save_health_snapshot(
        self,
        session: Session,
        state: DigitalTwinState,
        timestamp: datetime,
    ) -> HealthSnapshot:

        snapshot = HealthSnapshot(
            time=timestamp,
            engine_id=state.engine_id,
            mission_id=state.mission_id,
            overall=state.health.overall,
            thermal=state.health.thermal,
            combustion=state.health.combustion,
            lubrication=state.health.lubrication,
            mechanical=state.health.mechanical,
        )

        return self.repository.save(
            session,
            snapshot,
        )

    def _thermal_health(
        self,
        telemetry: TelemetryCreate,
    ) -> float:

        # Healthy operating region:
        # CHT <= 100°C
        # EGT <= 700°C

        cht_penalty = max(
            0,
            telemetry.cht - 100,
        ) * 1.5

        egt_penalty = max(
            0,
            telemetry.egt - 700,
        ) * 0.25

        return self._score(
            100
            - cht_penalty
            - egt_penalty
        )


    def _combustion_health(
        self,
        telemetry: TelemetryCreate,
    ) -> float:

        # Healthy RPM centered around the current simulator's
        # normal operating point (~4000 RPM).

        rpm_deviation = abs(
            telemetry.rpm - 4000
        )

        rpm_penalty = max(
            0,
            rpm_deviation - 300,
        ) * 0.04

        egt_deviation = abs(
            telemetry.egt - 650
        )

        egt_penalty = max(
            0,
            egt_deviation - 80,
        ) * 0.10

        return self._score(
            100
            - rpm_penalty
            - egt_penalty
        )


    def _lubrication_health(
        self,
        telemetry: TelemetryCreate,
    ) -> float:

        # Healthy oil pressure is around 60 psi.
        # Oil temperature can normally be around 100-105°C.

        pressure_penalty = max(
            0,
            55 - telemetry.oil_pressure,
        ) * 3.0

        temperature_penalty = max(
            0,
            telemetry.oil_temperature - 115,
        ) * 0.75

        return self._score(
            100
            - pressure_penalty
            - temperature_penalty
        )


    def _mechanical_health(
        self,
        telemetry: TelemetryCreate,
    ) -> float:

        # Keep normal vibration near 100%.
        # Penalize elevated vibration aggressively.

        vibration = abs(
            telemetry.vibration
        )

        vibration_penalty = max(
            0,
            vibration - 2.0,
        ) * 25

        return self._score(
            100
            - vibration_penalty
        )

    @staticmethod
    def _score(value: float) -> float:

        return round(
            max(0, min(100, value)),
            2,
        )

    def build_state(
        self,
        telemetry: TelemetryCreate,
        prediction: MLPrediction,
    ) -> DigitalTwinState:

        health = self.calculate_health(telemetry)

        operating_state = self._determine_operating_state(
            health.overall,
            prediction,
        )

        return DigitalTwinState(
            engine_id=telemetry.engine_id,
            mission_id=telemetry.mission_id,
            operating_state=operating_state,
            health=health,
            prediction=prediction,
        )

    def _determine_operating_state(
        self,
        health: float,
        prediction: MLPrediction,
    ) -> str:

        if prediction.anomaly_score >= 0.9:
            return "CRITICAL"

        if health < 60 or prediction.anomaly_score >= 0.7:
            return "DEGRADED"

        if health < 80 or prediction.anomaly_score >= 0.4:
            return "WARNING"

        return "NOMINAL"
    