// Shared data model of the mission analysis page: one row per telemetry
// sample with raw, smoothed and expected-healthy values, the derived health
// metrics, health scores and predictions, plus the mission's events.

import type {
    MissionBaseline,
    MissionReport,
    ReplayPoint,
    SubsystemHealth,
    TelemetryData,
} from "../../types/api";
import { efficiencySeries } from "../../efficiency";

export type Row = Record<string, number | null> & { x: number };

// Centred moving average over SMOOTH_WINDOW samples (1 Hz).
const SMOOTH_WINDOW = 10;

export const SIGNAL_KEYS = [
    "rpm", "torque", "fuel_flow", "cht", "egt", "oil_pressure",
    "oil_temperature", "vibration", "battery_voltage", "alternator_current",
    "injection_timing", "injection_duration",
] as const;

export const HEALTH_KEYS = [
    "thermal", "combustion", "lubrication", "mechanical",
    "electrical", "injection", "sensor",
] as const;
export type SubsystemKey = typeof HEALTH_KEYS[number];

// One line on a chart. `key` is a Row field; smoothed and expected lines are
// derived automatically for signals that have them.
export interface SignalSpec {
    key: string;
    label: string;
    unit: string;
    color: string;
    smooth?: boolean;          // draw raw faint + 10 s smoothed line
    limitKey?: "vibration_rms_limit" | "rpm_roughness_limit" | "cht_roughness_limit";
}

export interface SubsystemSpec {
    key: SubsystemKey;
    label: string;
    description: string;
    signals: SignalSpec[];
}

// Signals behind each health score, as computed in backend/twin/service.py.
export const SUBSYSTEMS: SubsystemSpec[] = [
    {
        key: "thermal", label: "THERMAL",
        description: "Cylinder head and exhaust gas temperature against the healthy expectation.",
        signals: [
            { key: "cht", label: "CHT", unit: "°C", color: "#f97316", smooth: true },
            { key: "egt", label: "EGT", unit: "°C", color: "#e8543f", smooth: true },
        ],
    },
    {
        key: "combustion", label: "COMBUSTION",
        description: "RPM and EGT against the healthy expectation, plus RPM roughness (misfire / instability).",
        signals: [
            { key: "rpm", label: "RPM", unit: "rpm", color: "#60a5fa", smooth: true },
            { key: "egt", label: "EGT", unit: "°C", color: "#e8543f", smooth: true },
            { key: "rpm_roughness", label: "RPM ROUGHNESS", unit: "rpm", color: "#c084fc", limitKey: "rpm_roughness_limit" },
        ],
    },
    {
        key: "lubrication", label: "LUBRICATION",
        description: "Oil pressure (too low) and oil temperature (too high).",
        signals: [
            { key: "oil_pressure", label: "OIL PRESSURE", unit: "psi", color: "#facc15", smooth: true },
            { key: "oil_temperature", label: "OIL TEMPERATURE", unit: "°C", color: "#fb923c", smooth: true },
        ],
    },
    {
        key: "mechanical", label: "MECHANICAL",
        description: "Vibration RMS over the last 30 samples (imbalance, bearing wear).",
        signals: [
            { key: "vibration_rms", label: "VIBRATION RMS", unit: "", color: "#a78bfa", limitKey: "vibration_rms_limit" },
        ],
    },
    {
        key: "electrical", label: "ELECTRICAL",
        description: "Bus voltage and alternator current against the healthy expectation.",
        signals: [
            { key: "battery_voltage", label: "BUS VOLTAGE", unit: "V", color: "#34d399", smooth: true },
            { key: "alternator_current", label: "ALTERNATOR CURRENT", unit: "A", color: "#7fd4ff", smooth: true },
        ],
    },
    {
        key: "injection", label: "INJECTION",
        description: "Injection timing and pulse width against the ECU map, and the fuel flow they command.",
        signals: [
            { key: "injection_timing", label: "INJECTION TIMING", unit: "° BTDC", color: "#e8c34a", smooth: true },
            { key: "injection_duration", label: "PULSE WIDTH", unit: "ms", color: "#c084fc", smooth: true },
            { key: "fuel_flow", label: "FUEL FLOW", unit: "kg/h", color: "#22d3ee", smooth: true },
        ],
    },
    {
        key: "sensor", label: "SENSOR",
        description: "CHT reading jitter: a failing thermocouple reads erratically. Not part of overall health.",
        signals: [
            { key: "cht", label: "CHT (REPORTED)", unit: "°C", color: "#f97316" },
            { key: "cht_roughness", label: "CHT JITTER", unit: "°C", color: "#c084fc", limitKey: "cht_roughness_limit" },
        ],
    },
];

export const LEVEL_COLOR: Record<string, string> = {
    MONITOR: "#7fd4ff",
    CAUTION: "#eab308",
    WARNING: "#f97316",
    CRITICAL: "#e8543f",
    CLEARED: "#7fe0a0",
};

export interface MissionEvent {
    x: number;           // seconds from mission start
    label: string;
    color: string;
    labelRow?: number;   // 0 or 1: close events alternate label rows
}

export interface MissionModel {
    rows: Row[];
    hasExpected: boolean;
    limits: Pick<MissionBaseline, "vibration_rms_limit" | "rpm_roughness_limit" | "cht_roughness_limit">;
    events: MissionEvent[];
    // Shaded period from the first advisory to failure / mission end.
    faultSpan: [number, number] | null;
    duration: number;
}

export function healthColor(score: number | null | undefined): string {
    if (score == null) return "#555";
    if (score < 30) return "#e8543f";
    if (score < 60) return "#f97316";
    if (score < 80) return "#eab308";
    return "#7fe0a0";
}

export function clock(seconds: number | null | undefined): string {
    if (seconds == null) return "--";
    const s = Math.max(0, Math.round(seconds));
    return `T+${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
    const half = Math.floor(window / 2);
    return values.map((_, i) => {
        let sum = 0;
        let n = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
            const v = values[j];
            if (v != null) { sum += v; n++; }
        }
        return n ? sum / n : null;
    });
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Median |x[i] - (x[i-1] + x[i+1]) / 2| over a trailing window, as
// _roughness() in backend/twin/service.py.
function roughness(values: number[], window: number): (number | null)[] {
    return values.map((_, i) => {
        if (i + 1 < 5) return null;
        const w = values.slice(Math.max(0, i + 1 - window), i + 1);
        const diffs = [];
        for (let k = 1; k < w.length - 1; k++) diffs.push(Math.abs(w[k] - (w[k - 1] + w[k + 1]) / 2));
        return diffs.length ? median(diffs) : null;
    });
}

function rms(values: number[], window: number): number[] {
    return values.map((_, i) => {
        const w = values.slice(Math.max(0, i + 1 - window), i + 1);
        return Math.sqrt(w.reduce((sum, v) => sum + v * v, 0) / w.length);
    });
}

export function buildMissionModel(
    telemetry: TelemetryData[],
    points: ReplayPoint[],
    baseline: MissionBaseline | null,
    report: MissionReport | null,
): MissionModel {
    const start = telemetry.length ? new Date(telemetry[0].timestamp).getTime() : 0;
    const window = baseline?.roughness_window ?? 30;
    const expected = baseline && baseline.expected.length === telemetry.length ? baseline.expected : null;
    const healthByTime = new Map<string, ReplayPoint>();
    points.forEach((p) => healthByTime.set(p.timestamp, p));

    const num = (key: keyof TelemetryData) => telemetry.map((t) => (t[key] as number | null) ?? null);
    const smoothed: Record<string, (number | null)[]> = {};
    SIGNAL_KEYS.forEach((key) => { smoothed[key] = movingAverage(num(key), SMOOTH_WINDOW); });

    const rpmResidual = telemetry.map((t, i) => t.rpm - (expected ? expected[i].rpm : 0));
    const rpmRoughness = roughness(rpmResidual, window);
    const chtRoughness = roughness(telemetry.map((t) => t.cht), window);
    const vibrationRms = rms(telemetry.map((t) => t.vibration ?? 0), window);
    const efficiency = efficiencySeries(telemetry);

    const rows: Row[] = telemetry.map((t, i) => {
        const row: Row = { x: Math.round((new Date(t.timestamp).getTime() - start) / 1000) };
        SIGNAL_KEYS.forEach((key) => {
            row[key] = (t[key] as number | null) ?? null;
            row[`${key}_smooth`] = smoothed[key][i];
        });
        if (expected) {
            Object.entries(expected[i]).forEach(([key, value]) => { row[`${key}_expected`] = value; });
        }
        row.throttle = t.throttle ?? null;
        row.rpm_roughness = rpmRoughness[i];
        row.cht_roughness = chtRoughness[i];
        row.vibration_rms = vibrationRms[i];
        row.efficiency = efficiency[i] != null ? Math.round(efficiency[i]! * 10) / 10 : null;

        const point = healthByTime.get(t.timestamp);
        const health: SubsystemHealth | null = point?.health ?? null;
        row.overall = health?.overall ?? null;
        HEALTH_KEYS.forEach((key) => { row[key] = health?.[key] ?? null; });
        row.anomaly_score = point?.prediction?.anomaly_score ?? null;
        const rul = point?.prediction?.rul_seconds;
        row.rul_minutes = rul != null ? Math.round((rul / 60) * 10) / 10 : null;
        return row;
    });

    const duration = rows.length ? rows[rows.length - 1].x : 0;

    // Events: the first time each advisory level is reached, and failure.
    // Single-sample fault detections are left out: they can fire briefly
    // during warm-up, while advisories need the fault to persist.
    const events: MissionEvent[] = [];
    if (report) {
        const seen = new Set<string>();
        report.advisories.forEach((a) => {
            if (a.level === "CLEARED" || seen.has(a.level)) return;
            seen.add(a.level);
            events.push({ x: a.at_s, label: a.level, color: LEVEL_COLOR[a.level] ?? "#fff" });
        });
        if (report.failure_at_s != null) events.push({ x: report.failure_at_s, label: "FAILURE", color: "#ff2222" });
    }
    events.sort((a, b) => a.x - b.x);
    // Keep labels of close events apart: an event close to the previous one
    // takes the other label row.
    const duration0 = telemetry.length ? Math.round((new Date(telemetry[telemetry.length - 1].timestamp).getTime() - start) / 1000) : 0;
    events.forEach((e, i) => {
        const prev = events[i - 1];
        e.labelRow = prev && e.x - prev.x < duration0 * 0.07 ? 1 - (prev.labelRow ?? 0) : 0;
    });

    const firstAdvisory = report?.advisories.find((a) => a.level !== "CLEARED")?.at_s;
    const faultSpan: [number, number] | null = firstAdvisory != null
        ? [firstAdvisory, report?.failure_at_s ?? duration]
        : null;

    return {
        rows,
        hasExpected: expected != null,
        limits: {
            vibration_rms_limit: baseline?.vibration_rms_limit ?? 2.2,
            rpm_roughness_limit: baseline?.rpm_roughness_limit ?? 2.0,
            cht_roughness_limit: baseline?.cht_roughness_limit ?? 1.2,
        },
        events,
        faultSpan,
        duration,
    };
}

// Subsystem with the lowest health in the mission (sensor last, since it
// isn't part of overall health).
export function weakestSubsystem(rows: Row[]): SubsystemKey | null {
    let worst: { key: SubsystemKey; value: number } | null = null;
    for (const key of HEALTH_KEYS) {
        if (key === "sensor") continue;
        for (const row of rows) {
            const v = row[key];
            if (v != null && (worst == null || v < worst.value)) worst = { key, value: v };
        }
    }
    return worst && worst.value < 80 ? worst.key : null;
}

export function minHealth(rows: Row[], key: string): { value: number; x: number } | null {
    let best: { value: number; x: number } | null = null;
    for (const row of rows) {
        const v = row[key];
        if (v != null && (best == null || v < best.value)) best = { value: v, x: row.x };
    }
    return best;
}
