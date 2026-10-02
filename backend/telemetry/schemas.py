from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TelemetryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

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

    throttle: float
    engine_load: float
    altitude: float
    ambient_temperature: float

    # Electrical system (Simulink Electrical_Model, bus signals 10-11).
    # Optional so older publishers and historical payloads stay valid.
    battery_voltage: float | None = Field(
        default=None,
        description="28 VDC bus / battery terminal voltage (V)",
    )
    alternator_current: float | None = Field(
        default=None,
        description="Alternator output current (A)",
    )

    # ECU injection parameters (Simulink Injection_Model, signals 12-13).
    injection_timing: float | None = Field(
        default=None,
        description="Start of injection (degrees crank angle BTDC)",
    )
    injection_duration: float | None = Field(
        default=None,
        description="Injector pulse width per injection event (ms)",
    )

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamp must include timezone information")

        return value
