"""Sanity-check a labelled simulation dataset.

    python ai/dataset/check_dataset.py DATASET_DIR

Run after ai/dataset/label_dataset.py. Prints failures of hard checks
(problems that would corrupt training) and a summary per fault and mission
profile: how many runs fail, how long after onset, at what fault strength,
plus sensor clipping and noise correlation.
"""

import argparse
import csv
import math
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

# Sensor range limits in the Simulink model (Saturation blocks).
RANGES = {
    "rpm": (0, 9000),
    "torque": (-10, 15),
    "cht": (0, 300),
    "egt": (0, 1500),
    "fuel_flow": (0, 10),
    "oil_pressure": (0, 150),
    "oil_temperature": (0, 200),
    "vibration": (-20, 20),
}

NOISE_SIGNALS = ("rpm", "torque", "fuel_flow", "cht", "egt", "oil_pressure",
                 "oil_temperature")


def load(path):
    return [
        {k: (float(v) if v != "" else None) for k, v in r.items()}
        for r in csv.DictReader(path.open())
    ]


def second_difference(values):
    return [values[i] - (values[i - 1] + values[i + 1]) / 2
            for i in range(1, len(values) - 1)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_dir", type=Path)
    args = parser.parse_args()

    runs = list(csv.DictReader((args.dataset_dir / "runs.csv").open()))
    problems = []
    by_fault = defaultdict(list)
    clipped = defaultdict(lambda: defaultdict(int))
    noise_pairs = defaultdict(list)

    for run in runs:
        rows = load(args.dataset_dir / "runs" / f"{run['run_id']}.csv")
        fault = int(run["fault_id"])
        failure = float(run["failure_s"]) if run["failure_s"] else None

        missing = sum(
            1 for r in rows if r["sim_time"] >= 60
            for k, v in r.items() if v is None and k != "health_electrical"
            and k != "health_injection"
        )
        if missing:
            problems.append(f"{run['run_id']}: {missing} empty values after warm-up")

        if fault == 0 and failure is not None:
            problems.append(f"{run['run_id']}: healthy run fails at {failure:.0f} s")
        if fault == 7 and failure is not None:
            problems.append(f"{run['run_id']}: sensor fault counted as engine failure")
        if fault and failure is not None and failure < float(run["onset_s"]):
            problems.append(f"{run['run_id']}: fails at {failure:.0f} s, before onset")

        for k, (low, high) in RANGES.items():
            # Skip the warm-up: at engine start every reading is 0.
            n = sum(1 for r in rows if r["sim_time"] >= 60 and r[k] is not None
                    and (r[k] <= low + 1e-6 or r[k] >= high - 1e-6))
            if n:
                clipped[k][run["run_id"]] = n

        severity_at_failure = None
        if failure is not None:
            at = [r for r in rows if r["sim_time"] == failure]
            severity_at_failure = at[0]["severity"] if at else None
        by_fault[fault].append({
            "profile": run["profile"],
            "fails": failure is not None,
            "after_onset": (failure - float(run["onset_s"]))
            if failure is not None and fault else None,
            "ramp": float(run["ramp_s"]) if fault else None,
            "severity": severity_at_failure,
            "min_health": min(
                min(r[f"health_{s}"] for s in ("thermal", "combustion",
                    "lubrication", "mechanical")
                    if r[f"health_{s}"] is not None)
                for r in rows if r["sim_time"] >= 60
            ),
        })

        # Noise independence on healthy, steady stretches.
        if run["profile"] in ("cruise", "hot_weather"):
            steady = [r for r in rows if 300 <= r["sim_time"]
                      < (float(run["onset_s"]) if fault else 900)]
            if len(steady) > 60:
                diffs = {k: second_difference([r[k] for r in steady])
                         for k in NOISE_SIGNALS}
                for i, a in enumerate(NOISE_SIGNALS):
                    for b in NOISE_SIGNALS[i + 1:]:
                        noise_pairs[(a, b)].append(
                            st.correlation(diffs[a], diffs[b]))

    print(f"{len(runs)} runs checked")
    print("\n== HARD CHECKS")
    print("\n".join(problems) if problems else "all passed")

    print("\n== FAILURE SUMMARY (per fault)")
    for fault in sorted(by_fault):
        items = by_fault[fault]
        failing = [i for i in items if i["fails"]]
        line = f"fault {fault}: {len(failing)}/{len(items)} fail"
        if failing and fault:
            after = [i["after_onset"] for i in failing]
            sev = [i["severity"] for i in failing if i["severity"] is not None]
            line += (f" | onset->failure {min(after):.0f}-{max(after):.0f} s "
                     f"(median {st.median(after):.0f})"
                     f" | strength at failure {min(sev):.2f}-{max(sev):.2f}")
        never = sorted({i["profile"] for i in items if not i["fails"]})
        if never and fault:
            line += f" | never fails in: {', '.join(never)}"
        if fault == 0:
            line += f" | lowest engine health {min(i['min_health'] for i in items):.0f}"
        print(line)

    print("\n== SENSOR CLIPPING (samples at a range limit)")
    if not clipped:
        print("none")
    for k, per_run in clipped.items():
        total = sum(per_run.values())
        worst = sorted(per_run.items(), key=lambda kv: -kv[1])[:3]
        print(f"{k}: {total} samples in {len(per_run)} runs; most in "
              + ", ".join(f"{r} ({n})" for r, n in worst))

    print("\n== NOISE CORRELATION between signals (healthy steady flight; |r| should be small)")
    worst = sorted(noise_pairs.items(),
                   key=lambda kv: -abs(st.mean(kv[1])))[:5]
    for (a, b), values in worst:
        print(f"{a} vs {b}: mean r = {st.mean(values):+.3f} over {len(values)} runs")

    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
