"""Label the simulated ML dataset with the live twin's own code.

    python ai/dataset/label_dataset.py DATASET_DIR [--workers N]

Reads the raw runs written by simulation/generate_sim_dataset.m
(DATASET_DIR/raw/<run_id>.csv + .json) and writes

    DATASET_DIR/runs/<run_id>.csv   1 Hz rows: flight conditions, signals,
                                    expected_* healthy values, health_*
                                    scores, fault_id, severity, failed,
                                    rul_seconds
    DATASET_DIR/runs.csv            one row per run with its settings,
                                    failure time and split

Expected values, health and failure come from backend/twin (baseline.py,
DigitalTwinService.calculate_health, failure.py), fed the same windows
the live twin uses, so labels match what the dashboard shows. Expected
values use the history since engine start; the live twin uses the last
HISTORY_SAMPLES (20 min), which agrees to within a few percent of the
slowest lag after that.

See ANOMALY_MODEL_GUIDE.md and RUL_MODEL_GUIDE.md for the column meanings.
"""

import argparse
import csv
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "backend"))
sys.path.insert(0, str(REPO / "backend" / "telemetry"))

from telemetry.schemas import TelemetryCreate  # noqa: E402
from twin import baseline  # noqa: E402
from twin.failure import failure_index, weakest_health  # noqa: E402
from twin.service import ROUGHNESS_WINDOW, DigitalTwinService  # noqa: E402

# RUL label cap (s): "10 minutes or more". Rows before the fault's onset
# also get the cap.
RUL_CAP = 600.0

# Rows kept after the failure moment.
POST_FAILURE_S = 60

# Samples before the live twin starts scoring health.
WARMUP_SAMPLES = 60

SPLITS = {1: "train", 2: "train", 3: "train", 4: "train", 5: "val", 6: "test"}

CONDITIONS = ("throttle", "engine_load", "altitude", "ambient_temperature")
SIGNALS = (
    "rpm", "torque", "fuel_flow", "cht", "egt", "oil_pressure",
    "oil_temperature", "vibration", "battery_voltage", "alternator_current",
    "injection_timing", "injection_duration",
)
HEALTH = (
    "thermal", "combustion", "lubrication", "mechanical", "electrical",
    "injection", "sensor",
)
COLUMNS = (
    ("sim_time",) + CONDITIONS + SIGNALS
    + tuple(f"expected_{name}" for name in baseline.TARGETS)
    + tuple(f"health_{name}" for name in HEALTH)
    + ("fault_id", "severity", "failed", "rul_seconds")
)

# Only the health calculation is used: no repositories or predictors.
_service = DigitalTwinService(None, None, None, None)
_start = datetime(2026, 1, 1, tzinfo=timezone.utc)


def expected_series(rows):
    """Expected healthy readings for every sample, from engine start."""

    model = baseline._model()
    if model is None:
        raise SystemExit("No healthy baseline fitted (healthy_baseline.json)")

    z = baseline.expand(baseline.feature_series(
        [{k: r[k] for k in CONDITIONS} for r in rows],
        from_engine_start=True,
    ))
    z = (z - model["mean"]) / model["std"]

    return {
        name: z @ model["coef"][name] + model["intercept"][name]
        for name in baseline.TARGETS
    }


def label_run(raw_csv: Path, out_dir: Path) -> dict:
    meta = json.loads(raw_csv.with_suffix(".json").read_text())
    rows = [
        {k: float(v) for k, v in r.items()}
        for r in csv.DictReader(raw_csv.open())
    ]
    expected = expected_series(rows)

    samples = [
        TelemetryCreate(
            timestamp=_start + timedelta(seconds=r["sim_time"]),
            engine_id="dataset",
            mission_id=meta["run_id"],
            sim_time=r["sim_time"],
            **{k: r[k] for k in CONDITIONS + SIGNALS},
        )
        for r in rows
    ]

    # Health per sample, with the windows DigitalTwinService.process()
    # uses: roughness over the last ROUGHNESS_WINDOW samples, injection
    # over the last 10, scoring from the 60th sample on.
    health = [None] * len(rows)
    for i in range(WARMUP_SAMPLES - 1, len(rows)):
        window = samples[i - WARMUP_SAMPLES + 1:i + 1]
        rough = window[-ROUGHNESS_WINDOW:]
        health[i] = _service.calculate_health(
            samples[i],
            recent_vibration=[s.vibration for s in rough],
            recent_injection=[
                (s.rpm, s.throttle, s.fuel_flow,
                 s.injection_timing, s.injection_duration)
                for s in window[-10:]
            ],
            # Deviation from the expected RPM, as the live twin uses.
            recent_rpm=[
                rows[j]["rpm"] - float(expected["rpm"][j])
                for j in range(i - len(rough) + 1, i + 1)
            ],
            recent_cht=[s.cht for s in rough],
            expected={k: float(v[i]) for k, v in expected.items()},
        )

    scored = range(WARMUP_SAMPLES - 1, len(rows))
    weakest = [weakest_health(health[i]) for i in scored]
    index = failure_index(weakest)
    failure_s = (
        rows[WARMUP_SAMPLES - 1 + index]["sim_time"]
        if index is not None else None
    )

    onset_s = meta["onset_s"] if meta["fault_id"] else 0.0

    end = len(rows)
    if failure_s is not None:
        end = min(end, int(failure_s) + POST_FAILURE_S + 1)

    out_path = out_dir / "runs" / f"{meta['run_id']}.csv"
    with out_path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(COLUMNS)
        for i in range(end):
            r = rows[i]
            t = r["sim_time"]
            if failure_s is None or t < onset_s:
                # No failure ahead, or the fault has not started yet: the
                # signals cannot know about it, so no countdown.
                rul, failed = RUL_CAP, 0
            elif t >= failure_s:
                rul, failed = 0.0, 1
            else:
                rul, failed = min(RUL_CAP, failure_s - t), 0
            h = health[i]
            writer.writerow(
                [f"{t:.0f}"]
                + [f"{r[k]:.6g}" for k in CONDITIONS + SIGNALS]
                + [f"{expected[k][i]:.6g}" for k in baseline.TARGETS]
                + [
                    "" if h is None or getattr(h, k) is None
                    else f"{getattr(h, k):.2f}"
                    for k in HEALTH
                ]
                + [f"{r['fault_id']:.0f}", f"{r['severity']:.4f}",
                   failed, f"{rul:.0f}"]
            )

    return {
        "run_id": meta["run_id"],
        "profile": meta["profile"],
        "seed": meta["seed"],
        "profile_seed": meta["profile_seed"],
        "fault_id": meta["fault_id"],
        "onset_s": meta["onset_s"] if meta["fault_id"] else "",
        "ramp_s": meta["ramp_s"] if meta["fault_id"] else "",
        "failure_s": "" if failure_s is None else f"{failure_s:.0f}",
        "duration_s": end - 1,
        "split": SPLITS.get(meta["seed"], "extra"),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_dir", type=Path)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    raw = sorted((args.dataset_dir / "raw").glob("*.csv"))
    (args.dataset_dir / "runs").mkdir(parents=True, exist_ok=True)
    print(f"labelling {len(raw)} runs with {args.workers} workers")

    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(
            label_run, raw, [args.dataset_dir] * len(raw)
        ))

    results.sort(key=lambda r: (r["seed"], r["profile"], r["fault_id"]))
    with (args.dataset_dir / "runs.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)

    failed = sum(1 for r in results if r["failure_s"])
    print(f"wrote {len(results)} runs ({failed} reach failure) to "
          f"{args.dataset_dir}")


if __name__ == "__main__":
    main()
