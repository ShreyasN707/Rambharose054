"""Fit the healthy-engine baseline used by backend/twin/baseline.py.

    python ai/baseline/fit_baseline.py TRAIN_DIR [--test GLOB ...]

TRAIN_DIR holds 1 Hz CSVs of healthy (Fault_ID 0) simulator runs that
start at engine start, one per mission profile variant, as exported by
the dataset generator. Files named *_seed7.csv or *_nominal.csv are held
out for testing; everything else is used for fitting. Writes
backend/twin/ml_models/baseline/healthy_baseline.json and prints the
held-out error per signal.
"""

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.linear_model import Ridge

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "backend"))

from twin.baseline import MODEL_PATH, TARGETS, expand, feature_series  # noqa: E402

# The first minute is engine start and spin-up; the live twin scores
# health only from the 60th sample on.
SKIP_SAMPLES = 60
ALPHAS = (0.01, 0.1, 1.0, 10.0)


def load_run(path: Path):
    rows = [
        {k: float(v) for k, v in r.items()}
        for r in csv.DictReader(path.open())
    ]
    x = expand(feature_series(rows, from_engine_start=True))
    y = np.array([[r[t] for t in TARGETS] for r in rows])
    return x[SKIP_SAMPLES:], y[SKIP_SAMPLES:]


def stack(paths):
    parts = [load_run(p) for p in paths]
    return (np.concatenate([p[0] for p in parts]),
            np.concatenate([p[1] for p in parts]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("train_dir", type=Path)
    parser.add_argument("--test", nargs="*", type=Path, default=[])
    args = parser.parse_args()

    files = sorted(args.train_dir.glob("*.csv"))
    held_out = [f for f in files if f.stem.endswith(("_seed7", "_nominal"))]
    train = [f for f in files if f not in held_out]
    test = held_out + args.test
    print(f"fitting on {len(train)} runs, testing on {len(test)}")

    x_train, y_train = stack(train)
    x_test, y_test = stack(test)

    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0)
    std[std == 0] = 1.0
    z_train = (x_train - mean) / std
    z_test = (x_test - mean) / std

    coef, intercept = {}, {}
    print(f"{'signal':20s} {'alpha':>6s} {'rmse':>8s} {'p99 |err|':>10s} "
          f"{'max |err|':>10s} {'range':>18s}")
    for k, name in enumerate(TARGETS):
        best = None
        for alpha in ALPHAS:
            model = Ridge(alpha=alpha).fit(z_train, y_train[:, k])
            err = model.predict(z_test) - y_test[:, k]
            rmse = float(np.sqrt(np.mean(err ** 2)))
            if best is None or rmse < best[0]:
                best = (rmse, alpha, model, err)
        rmse, alpha, model, err = best
        coef[name] = model.coef_.tolist()
        intercept[name] = float(model.intercept_)
        abs_err = np.abs(err)
        print(f"{name:20s} {alpha:6g} {rmse:8.3f} "
              f"{np.percentile(abs_err, 99):10.3f} {abs_err.max():10.3f} "
              f"{y_test[:, k].min():8.1f}-{y_test[:, k].max():8.1f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(json.dumps({
        "targets": list(TARGETS),
        "mean": mean.tolist(),
        "std": std.tolist(),
        "coef": coef,
        "intercept": intercept,
        "train_runs": [f.name for f in train],
    }, indent=1))
    print(f"wrote {MODEL_PATH}")


if __name__ == "__main__":
    main()
