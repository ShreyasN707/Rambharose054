// Engine efficiency index: shaft power produced per kg/h of fuel, relative
// to a healthy engine (100 = healthy).
//
// Torque telemetry is noisy, so power and fuel are summed over a rolling
// window before dividing. HEALTHY_POWER_PER_FUEL is the average of 24
// healthy, warmed-up (t >= 10 min) simulator flights across all five
// mission profiles (standard deviation 2.6 %), so a warm healthy engine
// reads 100 ± 3 in any profile. A cold engine reads lower, and faults that
// waste fuel or power (misfire, fuel starvation) pull it down. It is a
// trend indicator, not a diagnosis: a fouled injector cuts fuel more than
// power, so it raises the index.
//
// An index rather than BSFC (g/kWh) or thermal efficiency: the simulator's
// fuel map burns about 2.5x more fuel per kWh than a real engine of this
// size, so absolute values would be misleading while the trend is sound.

import type { TelemetryData } from "./types/api";

export const HEALTHY_POWER_PER_FUEL = 1446; // W per kg/h
export const EFFICIENCY_WINDOW = 60;        // samples (1 Hz)

// Below this speed the engine is starting or stopped.
const MIN_RPM = 300;

type Sample = Pick<TelemetryData, "rpm" | "torque" | "fuel_flow">;

function shaftPowerW(sample: Sample): number {
    return (sample.torque ?? 0) * sample.rpm * (2 * Math.PI) / 60;
}

/** Efficiency index (healthy = 100) over the given samples, or null. */
export function efficiencyIndex(samples: Sample[]): number | null {
    let power = 0;
    let fuel = 0;

    for (const sample of samples) {
        if (sample.rpm < MIN_RPM) continue;
        power += shaftPowerW(sample);
        fuel += sample.fuel_flow ?? 0;
    }

    if (fuel <= 0) return null;

    return (power / fuel / HEALTHY_POWER_PER_FUEL) * 100;
}

/** Rolling efficiency index for every sample (null until a full window). */
export function efficiencySeries(data: Sample[]): (number | null)[] {
    return data.map((_, index) =>
        index + 1 < EFFICIENCY_WINDOW
            ? null
            : efficiencyIndex(data.slice(index + 1 - EFFICIENCY_WINDOW, index + 1))
    );
}
