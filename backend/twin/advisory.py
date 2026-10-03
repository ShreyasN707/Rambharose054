"""Maintenance advisory: what is wrong, how urgent, and what to do.

Turns the twin's predictions into an operator advisory once per sample:

* fault    - from the fault predictor (backend/twin/predictor.py);
* urgency  - from the RUL predictor's time to failure and the health
             scores;
* actions  - looked up in advisory_rules.json per fault family and level.

Levels: MONITOR (abnormal, no failure expected within 10 min), CAUTION
(failure within 10 min, or weakest health below 60), WARNING (failure
within 3 min), CRITICAL (failure threshold reached). A level is shown only
after it has held for ESCALATE_SAMPLES samples and is lowered only after
DEESCALATE_SAMPLES samples, so noise cannot make it flicker.
"""

import json
from math import sqrt
from pathlib import Path

from pydantic import BaseModel

from twin.failure import SUBSYSTEMS
from twin.predictor import (
    RUL_CAP_S,
    FaultResult,
    RULResult,
    roughness,
)


RULES = json.loads(
    (Path(__file__).resolve().parent / "advisory_rules.json").read_text()
)

LEVELS = ("MONITOR", "CAUTION", "WARNING", "CRITICAL")

# Countdown horizons (s) and health limits for the levels.
CAUTION_ETA_S = 600
WARNING_ETA_S = 180
CAUTION_HEALTH = 60
MONITOR_HEALTH = 80

ESCALATE_SAMPLES = 10
DEESCALATE_SAMPLES = 30

# Engine warm-up (samples): no advisories before the engine has settled.
WARMUP_SAMPLES = 120


class Advisory(BaseModel):
    level: str
    fault_family: str
    title: str
    eta_seconds: float | None
    evidence: list[str]
    do_now: list[str]
    maintenance: list[str]


class _MissionState:

    def __init__(self):
        self.samples = 0
        self.shown: tuple[str, str] | None = None
        self.higher_count = 0
        self.lower_count = 0
        self.other_family_count = 0


def _rank(level: str | None) -> int:
    return LEVELS.index(level) + 1 if level else 0


def _evidence(family, telemetry, expected, recent_rpm, recent_vibration,
              commanded_fuel) -> list[str]:
    exp = expected or {}

    def vs(label, value, key, unit):
        if key in exp:
            return f"{label} {value:.1f} {unit} (expected {exp[key]:.1f})"
        return f"{label} {value:.1f} {unit}"

    t = telemetry
    if family == "oil_pressure":
        return [vs("Oil pressure", t.oil_pressure, "oil_pressure", "psi"),
                vs("Oil temperature", t.oil_temperature, "oil_temperature", "°C")]
    if family in ("overheating", "cooling"):
        return [vs("CHT", t.cht, "cht", "°C"),
                vs("EGT", t.egt, "egt", "°C"),
                vs("Oil temperature", t.oil_temperature, "oil_temperature", "°C")]
    if family in ("misfire", "instability"):
        return [vs("RPM", t.rpm, "rpm", "RPM"),
                f"RPM roughness {roughness(recent_rpm or []):.1f} (healthy < 1)",
                vs("EGT", t.egt, "egt", "°C")]
    if family == "fuel_starvation":
        return [vs("RPM", t.rpm, "rpm", "RPM"),
                f"Fuel flow {t.fuel_flow:.2f} kg/h",
                vs("EGT", t.egt, "egt", "°C")]
    if family == "injector":
        lines = [f"Fuel flow {t.fuel_flow:.2f} kg/h"]
        if commanded_fuel:
            lines.append(
                f"ECU commands {commanded_fuel:.2f} kg/h "
                f"(delivered {100 * t.fuel_flow / commanded_fuel:.0f} %)"
            )
        return lines
    if family == "vibration":
        samples = recent_vibration or [t.vibration]
        rms = sqrt(sum(v * v for v in samples) / len(samples))
        return [f"Vibration RMS {rms:.2f} (healthy ≈ 1.5)"]
    if family == "electrical":
        return [vs("Bus voltage", t.battery_voltage or 0, "battery_voltage", "V"),
                vs("Alternator current", t.alternator_current or 0,
                   "alternator_current", "A")]
    if family == "cht_sensor":
        return [vs("CHT", t.cht, "cht", "°C"),
                vs("EGT", t.egt, "egt", "°C") + " — normal",
                vs("Oil temperature", t.oil_temperature, "oil_temperature",
                   "°C") + " — normal"]
    return []


class AdvisoryEngine:
    """Per-mission advisory state; feed it one sample at a time."""

    def __init__(self):
        self._missions: dict[tuple[str, str], _MissionState] = {}

    def update(
        self,
        telemetry,
        health,
        fault: FaultResult,
        rul: RULResult | None,
        expected: dict[str, float] | None = None,
        recent_rpm: list[float] | None = None,
        recent_vibration: list[float] | None = None,
        commanded_fuel: float | None = None,
    ) -> Advisory | None:

        key = (telemetry.engine_id, telemetry.mission_id)
        state = self._missions.setdefault(key, _MissionState())
        state.samples += 1

        weakest = min(
            getattr(health, name)
            for name in SUBSYSTEMS
            if getattr(health, name) is not None
        )
        eta = rul.rul_seconds if rul is not None else None
        countdown = eta is not None and eta < RUL_CAP_S

        # Candidate level and fault family for this sample.
        if countdown and eta <= 0:
            level = "CRITICAL"
        elif countdown and eta < WARNING_ETA_S:
            level = "WARNING"
        elif countdown and eta < CAUTION_ETA_S or weakest < CAUTION_HEALTH:
            level = "CAUTION"
        elif fault.is_anomaly:
            level = "MONITOR"
        else:
            level = None

        family = fault.fault_family if level else None
        if level and family == "healthy":
            family = "unclassified"

        # A failing sensor never starts an engine countdown: cap it.
        if family == "cht_sensor" and _rank(level) > _rank("CAUTION"):
            level = "CAUTION"

        if state.samples < WARMUP_SAMPLES:
            level, family = None, None

        # Persistence: raise the shown level after ESCALATE_SAMPLES samples
        # above it, lower or clear it after DEESCALATE_SAMPLES samples
        # below it, and switch the fault after ESCALATE_SAMPLES samples of
        # a different diagnosis at the same level.
        shown_rank = _rank(state.shown[0] if state.shown else None)
        rank = _rank(level)
        state.higher_count = state.higher_count + 1 if rank > shown_rank else 0
        state.lower_count = state.lower_count + 1 if rank < shown_rank else 0
        state.other_family_count = (
            state.other_family_count + 1
            if rank == shown_rank and state.shown and family != state.shown[1]
            else 0
        )

        if (
            state.higher_count >= ESCALATE_SAMPLES
            or state.lower_count >= DEESCALATE_SAMPLES
            or state.other_family_count >= ESCALATE_SAMPLES
        ):
            state.shown = (level, family) if level else None
            state.higher_count = state.lower_count = 0
            state.other_family_count = 0

        if state.shown is None:
            return None

        shown_level, shown_family = state.shown
        rule = RULES.get(shown_family, RULES["unclassified"])

        return Advisory(
            level=shown_level,
            fault_family=shown_family,
            title=rule["title"],
            eta_seconds=(
                round(eta) if countdown and shown_family != "cht_sensor"
                else None
            ),
            evidence=_evidence(
                shown_family, telemetry, expected, recent_rpm,
                recent_vibration, commanded_fuel,
            ),
            do_now=rule["do_now"][shown_level],
            maintenance=rule["maintenance"],
        )

    def forget(self, engine_id: str, mission_id: str) -> None:
        self._missions.pop((engine_id, mission_id), None)
