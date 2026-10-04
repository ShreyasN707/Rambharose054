"""Mission-wise health report: one flight summarised for maintenance crews.

Built from the stored telemetry and health snapshots of a mission (the
snapshots carry health, prediction and advisory per sample), so it can be
generated for any past flight.
"""

from math import pi

from twin.failure import failure_index, weakest_health
from twin.predictor import RUL_CAP_S

# Mission IDs end with the mission profile (simulation_controller.py).
PROFILES = {
    "cruise": "Cruise",
    "high_altitude": "High altitude",
    "hot_weather": "Hot weather",
    "endurance": "Endurance",
    "rapid_throttle": "Rapid throttle",
}

ENGINE_SUBSYSTEMS = (
    "thermal",
    "combustion",
    "lubrication",
    "mechanical",
    "electrical",
    "injection",
)

# Shaft power per kg/h of fuel of a warmed-up healthy engine; must match
# HEALTHY_POWER_PER_FUEL in frontend/src/efficiency.ts.
HEALTHY_POWER_PER_FUEL = 1446.0

# Efficiency window (samples) and minimum engine speed.
EFFICIENCY_WINDOW = 60

# A fault counts in the report once the predictor reports it for this many
# samples (1 Hz) in a row. Startup blips last up to ~15 s; real faults
# persist for minutes.
MIN_FAULT_RUN = 30
MIN_RPM = 300


def _profile(mission_id: str) -> str | None:
    for key, name in PROFILES.items():
        if mission_id.endswith(f"_{key}"):
            return name
    return None


def _efficiency(rows) -> tuple[float | None, float | None]:
    """Mean and lowest 60 s rolling efficiency index (100 = healthy)."""

    usable = [r for r in rows if r.rpm >= MIN_RPM]
    if len(usable) < EFFICIENCY_WINDOW:
        return None, None

    def index(window):
        power = sum((r.torque or 0) * r.rpm * 2 * pi / 60 for r in window)
        fuel = sum(r.fuel_flow for r in window)
        return power / fuel / HEALTHY_POWER_PER_FUEL * 100 if fuel > 0 else None

    rolling = [
        index(usable[i - EFFICIENCY_WINDOW + 1:i + 1])
        for i in range(EFFICIENCY_WINDOW - 1, len(usable), EFFICIENCY_WINDOW // 2)
    ]
    rolling = [v for v in rolling if v is not None]

    return round(index(usable), 1), round(min(rolling), 1) if rolling else None


def build_report(mission_id: str, rows, snapshots) -> dict:
    """Report for one mission. `rows` and `snapshots` are oldest first."""

    start = rows[0].time

    def at(time) -> float:
        return round((time - start).total_seconds())

    report = {
        "mission_id": mission_id,
        "engine_id": rows[0].engine_id,
        "profile": _profile(mission_id),
        "start_time": start,
        "end_time": rows[-1].time,
        "duration_s": at(rows[-1].time),
        "samples": len(rows),
        "max_altitude_m": round(max(r.altitude for r in rows)),
        "ambient_min_c": round(min(r.ambient_temperature for r in rows), 1),
        "ambient_max_c": round(max(r.ambient_temperature for r in rows), 1),
        "mean_throttle": round(sum(r.throttle for r in rows) / len(rows), 2),
    }

    report["efficiency_mean"], report["efficiency_min"] = _efficiency(rows)

    if not snapshots:
        report.update(outcome="NO HEALTH DATA", faults=[], advisories=[],
                      maintenance=[])
        return report

    # Health: lowest overall and the weakest engine subsystem.
    worst = min(snapshots, key=lambda s: s.overall)
    weakest = None
    for s in snapshots:
        for name in ENGINE_SUBSYSTEMS:
            value = getattr(s, name)
            if value is not None and (weakest is None or value < weakest[1]):
                weakest = (name, value, s.time)

    report["final_health"] = round(snapshots[-1].overall, 1)
    report["min_health"] = round(worst.overall, 1)
    report["min_health_at_s"] = at(worst.time)
    report["weakest_subsystem"] = weakest[0] if weakest else None
    report["weakest_subsystem_health"] = round(weakest[1], 1) if weakest else None
    report["weakest_subsystem_at_s"] = at(weakest[2]) if weakest else None

    # Outcome, with the same failure definition as the RUL labels.
    engine = [
        weakest_health({name: getattr(s, name) for name in ENGINE_SUBSYSTEMS})
        for s in snapshots
    ]
    failed_at = failure_index(engine)
    if failed_at is not None:
        report["outcome"] = "FAILURE"
        report["failure_at_s"] = at(snapshots[failed_at].time)
    elif worst.overall < 60 or any(
        (s.advisory or {}).get("level") in ("WARNING", "CRITICAL") for s in snapshots
    ):
        report["outcome"] = "DEGRADED"
    else:
        report["outcome"] = "NOMINAL"

    countdowns = [
        s.rul_seconds for s in snapshots
        if s.rul_seconds is not None and s.rul_seconds < RUL_CAP_S
    ]
    report["min_time_to_failure_s"] = round(min(countdowns)) if countdowns else None

    # Faults the predictor reported for at least MIN_FAULT_RUN samples in a
    # row, with the start of the first such run and the total time in them.
    # Shorter blips (e.g. during engine warm-up) are not reported.
    faults: dict[str, dict] = {}
    runs: list[tuple[str, int, int]] = []   # (fault, first index, length)
    for i, s in enumerate(snapshots):
        if s.fault and runs and runs[-1][0] == s.fault and runs[-1][1] + runs[-1][2] == i:
            runs[-1] = (s.fault, runs[-1][1], runs[-1][2] + 1)
        elif s.fault:
            runs.append((s.fault, i, 1))
    for fault, first, length in runs:
        if length < MIN_FAULT_RUN:
            continue
        entry = faults.setdefault(fault, {
            "fault": fault,
            "first_detected_at_s": at(snapshots[first].time),
            "seconds_detected": 0,
        })
        entry["seconds_detected"] += length
    report["faults"] = sorted(faults.values(), key=lambda f: f["first_detected_at_s"])

    # Advisory timeline: every change of level or fault.
    advisories = []
    previous = None
    maintenance: list[str] = []
    for s in snapshots:
        advisory = s.advisory
        key = (advisory["level"], advisory["fault_family"]) if advisory else None
        if key != previous:
            advisories.append({
                "at_s": at(s.time),
                "level": advisory["level"] if advisory else "CLEARED",
                "title": advisory["title"] if advisory else "Advisory cleared",
                "eta_seconds": advisory.get("eta_seconds") if advisory else None,
                "do_now": advisory["do_now"] if advisory else [],
            })
            if advisory:
                for item in advisory["maintenance"]:
                    if item not in maintenance:
                        maintenance.append(item)
        previous = key

    report["advisories"] = advisories
    report["maintenance"] = maintenance

    return report
