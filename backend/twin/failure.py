"""Engine failure definition shared by the live twin and RUL labelling.

An engine has failed when the smoothed health of its weakest subsystem
drops below FAILURE_THRESHOLD and does not recover. Health comes from
DigitalTwinService.calculate_health(), so training labels and the live
dashboard use the same scores.
"""

from collections.abc import Sequence


# Health (0-100) below which a subsystem counts as failed.
FAILURE_THRESHOLD = 30.0

# Moving-average length (samples at 1 Hz) applied before the threshold,
# so sensor noise cannot flicker the health across it.
SMOOTHING_WINDOW = 90

# Engine subsystems considered. `overall` is excluded: averaging would let
# one failing subsystem hide behind healthy ones. `sensor` is excluded
# too: a failing sensor makes its reading unreliable but does not shorten
# engine life, so it raises alerts without starting an RUL countdown.
SUBSYSTEMS = (
    "thermal",
    "combustion",
    "lubrication",
    "mechanical",
    "electrical",
    "injection",
)


def weakest_health(health) -> float:
    """Lowest subsystem score of a HealthState (or mapping)."""

    get = health.get if isinstance(health, dict) else (
        lambda name: getattr(health, name)
    )

    return min(
        score
        for score in (get(name) for name in SUBSYSTEMS)
        if score is not None
    )


def smooth(values: Sequence[float]) -> list[float]:
    """Trailing moving average over SMOOTHING_WINDOW samples."""

    smoothed = []
    total = 0.0

    for i, value in enumerate(values):
        total += value
        if i >= SMOOTHING_WINDOW:
            total -= values[i - SMOOTHING_WINDOW]
        smoothed.append(total / min(i + 1, SMOOTHING_WINDOW))

    return smoothed


def failure_index(weakest: Sequence[float]) -> int | None:
    """Index of the sample at which the engine fails, or None.

    `weakest` is the weakest-subsystem health per 1 Hz sample. Failure is
    the first sample after which the smoothed health stays below the
    threshold until the end of the run.
    """

    smoothed = smooth(weakest)

    index = None
    for i in range(len(smoothed) - 1, -1, -1):
        if smoothed[i] >= FAILURE_THRESHOLD:
            break
        index = i

    return index


def remaining_useful_life(
    times: Sequence[float],
    weakest: Sequence[float],
) -> list[float | None]:
    """Seconds until failure for each sample (None if the run never fails)."""

    index = failure_index(weakest)

    if index is None:
        return [None] * len(times)

    failure_time = times[index]

    return [max(0.0, failure_time - t) for t in times]
