from sqlalchemy.orm import Session

from models import Telemetry
from repository import TelemetryRepository
from schemas import TelemetryCreate


class TelemetryService:

    def __init__(self, repository: TelemetryRepository):
        self.repository = repository

    def process(
        self,
        session: Session,
        data: TelemetryCreate,
    ) -> bool:
        telemetry = Telemetry(
            time=data.timestamp,
            engine_id=data.engine_id,
            mission_id=data.mission_id,
            rpm=data.rpm,
            cht=data.cht,
            egt=data.egt,
            oil_pressure=data.oil_pressure,
            oil_temperature=data.oil_temperature,
            fuel_flow=data.fuel_flow,
            vibration=data.vibration,
            battery_voltage=data.battery_voltage,
            alternator_current=data.alternator_current,
            injection_timing=data.injection_timing,
        )

        return self.repository.save(session, telemetry)