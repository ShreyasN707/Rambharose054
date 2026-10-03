"""Healthy-engine baseline: expected sensor readings for the flight conditions.

A healthy engine's RPM, temperatures, oil pressure and bus readings depend
on throttle, load, altitude and ambient temperature, and the thermal
signals lag power changes by minutes. The baseline predicts those readings
from the operating-condition history, so health can be scored on the
deviation from what a healthy engine would read right now rather than on
fixed cruise limits.

The model is a ridge regression on physics-based features (ISA density
ratio and exponentially lagged inputs) with second-order terms. Its
coefficients live in a JSON file fitted by ai/baseline/fit_baseline.py
from healthy simulator runs over all mission profiles; both use
feature_series() below, so training and live inference build identical
inputs.
"""

import json
from functools import lru_cache
from pathlib import Path

import numpy as np


MODEL_PATH = (
    Path(__file__).resolve().parent
    / "ml_models" / "baseline" / "healthy_baseline.json"
)

# Signals the baseline predicts.
TARGETS = (
    "rpm",
    "egt",
    "cht",
    "oil_pressure",
    "oil_temperature",
    "battery_voltage",
    "alternator_current",
)

# Time constants (s) of the lagged inputs. The fast ones follow RPM and
# EGT, the slow ones the cylinder head and oil warming up or cooling down.
LAG_TAUS = (1.0, 2.0, 5.0, 20.0, 60.0, 180.0, 400.0)

# History the live twin needs so the slowest lag has settled
# (exp(-1200 / 400) ~ 5 % weight left on the initial state).
HISTORY_SAMPLES = 1200

# ISA constants, as in the Simulink Environment_Model.
_P0 = 101325.0
_T0 = 288.15
_RHO0 = 1.225
_LAPSE = 0.0065
_R = 287.05
_G = 9.80665


def density_ratio(altitude: float, ambient_c: float) -> float:
    """Air density relative to ISA sea level (Environment_Model)."""

    pressure = _P0 * (1 - _LAPSE * altitude / _T0) ** (_G / (_R * _LAPSE))
    return pressure / (_R * (ambient_c + 273.15)) / _RHO0


def feature_series(
    history: list[dict],
    from_engine_start: bool,
) -> np.ndarray:
    """Feature vectors for every sample of `history` (oldest first).

    `history` holds 1 Hz samples with throttle, engine_load, altitude and
    ambient_temperature. With `from_engine_start` the lags start from a
    cold, stopped engine (zero power, warm-up included); otherwise they
    start settled at the first sample's value.
    """

    throttle = np.array([s["throttle"] for s in history], dtype=float)
    load = np.array([s["engine_load"] for s in history], dtype=float)
    ambient = np.array([s["ambient_temperature"] for s in history])
    sigma = np.array([
        density_ratio(s["altitude"], s["ambient_temperature"])
        for s in history
    ])
    power = throttle * sigma

    def lag(values: np.ndarray, tau: float, start: float) -> np.ndarray:
        alpha = 1.0 - np.exp(-1.0 / tau)
        out = np.empty_like(values)
        state = start
        for i, value in enumerate(values):
            state += alpha * (value - state)
            out[i] = state
        return out

    columns = [throttle, load, sigma, ambient, power]
    for tau in LAG_TAUS:
        columns.append(lag(power, tau, 0.0 if from_engine_start else power[0]))
        columns.append(lag(load, tau, 0.0 if from_engine_start else load[0]))
    columns.append(lag(ambient, LAG_TAUS[-1], ambient[0]))

    return np.stack(columns, axis=-1)


def features(
    history: list[dict],
    from_engine_start: bool,
) -> np.ndarray:
    """Feature vector for the latest sample of `history`."""

    return feature_series(history, from_engine_start)[-1]


def expand(x: np.ndarray) -> np.ndarray:
    """Linear plus pairwise (second-order) terms."""

    n = x.shape[-1]
    pairs = [x[..., i] * x[..., j] for i in range(n) for j in range(i, n)]
    return np.concatenate([x, np.stack(pairs, axis=-1)], axis=-1)


@lru_cache(maxsize=1)
def _model() -> dict | None:

    if not MODEL_PATH.exists():
        return None

    raw = json.loads(MODEL_PATH.read_text())

    return {
        "mean": np.array(raw["mean"]),
        "std": np.array(raw["std"]),
        "coef": {k: np.array(v) for k, v in raw["coef"].items()},
        "intercept": raw["intercept"],
    }


def expected_series(
    history: list[dict],
    from_engine_start: bool,
) -> list[dict[str, float]] | None:
    """Expected healthy readings for every sample of `history`.

    None without a fitted model.
    """

    model = _model()

    if model is None or not history:
        return None

    z = expand(feature_series(history, from_engine_start))
    z = (z - model["mean"]) / model["std"]
    values = {
        name: z @ model["coef"][name] + model["intercept"][name]
        for name in TARGETS
    }

    return [
        {name: float(values[name][i]) for name in TARGETS}
        for i in range(len(history))
    ]


def expected(
    history: list[dict],
    from_engine_start: bool,
) -> dict[str, float] | None:
    """Expected healthy readings now, or None without a fitted model."""

    series = expected_series(history, from_engine_start)

    return series[-1] if series else None
