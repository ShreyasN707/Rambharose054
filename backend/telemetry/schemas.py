from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TelemetryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: datetime

    engine_id: str
    mission_id: str

    rpm: float
    cht: float
    egt: float

    oil_pressure: float
    oil_temperature: float

    fuel_flow: float
    vibration: float

    battery_voltage: float
    alternator_current: float

    injection_timing: float