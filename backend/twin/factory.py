from telemetry.repository import TelemetryRepository

from twin.predictor import create_predictors
from twin.repository import HealthSnapshotRepository
from twin.service import DigitalTwinService


def create_digital_twin_service() -> DigitalTwinService:
    fault_model, rul_model = create_predictors()

    return DigitalTwinService(
        repository=HealthSnapshotRepository(),
        telemetry_repository=TelemetryRepository(),
        fault_model=fault_model,
        rul_model=rul_model,
    )
