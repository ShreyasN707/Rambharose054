from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from models import Telemetry


class TelemetryRepository:

    def save(
        self,
        session: Session,
        telemetry: Telemetry,
    ) -> bool:
        statement = insert(Telemetry).values(
            time=telemetry.time,
            engine_id=telemetry.engine_id,
            mission_id=telemetry.mission_id,
            rpm=telemetry.rpm,
            cht=telemetry.cht,
            egt=telemetry.egt,
            oil_pressure=telemetry.oil_pressure,
            oil_temperature=telemetry.oil_temperature,
            fuel_flow=telemetry.fuel_flow,
            vibration=telemetry.vibration,
            battery_voltage=telemetry.battery_voltage,
            alternator_current=telemetry.alternator_current,
            injection_timing=telemetry.injection_timing,
        )

        statement = statement.on_conflict_do_nothing(
            constraint="uq_telemetry_event",
        )

        result = session.execute(statement)

        return result.rowcount == 1

    def get_by_mission(
        self,
        session: Session,
        mission_id: str,
    ) -> list[Telemetry]:
        statement = (
            select(Telemetry)
            .where(Telemetry.mission_id == mission_id)
            .order_by(Telemetry.time)
        )

        return list(session.scalars(statement))