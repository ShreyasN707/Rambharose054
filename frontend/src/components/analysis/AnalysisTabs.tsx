import type { MissionReport as MissionReportData } from "../../types/api";
import MissionReport from "./MissionReport";
import SignalChart, { signalLines } from "./SignalChart";
import {
    SUBSYSTEMS,
    clock,
    healthColor,
    minHealth,
    type MissionModel,
    type SubsystemKey,
} from "./missionData";

export type SignalsSub = SubsystemKey | "efficiency";

const mono = { fontFamily: "'JetBrains Mono', monospace" };

interface CursorProps {
    model: MissionModel;
    cursorX: number | null;
    onSelectX: (x: number) => void;
}

function chartProps({ model, cursorX, onSelectX }: CursorProps) {
    return {
        rows: model.rows,
        events: model.events,
        faultSpan: model.faultSpan,
        duration: model.duration,
        cursorX,
        onSelectX,
    };
}

// ── SUMMARY ────────────────────────────────────────────────────────────────

export function SummaryTab({
    model,
    report,
    onOpenSubsystem,
}: {
    model: MissionModel;
    report: MissionReportData | null;
    onOpenSubsystem: (key: SubsystemKey, atX?: number) => void;
}) {
    return (
        <div>
            {report ? <MissionReport report={report} /> : (
                <div className="mb-8 p-5 text-sm" style={{ ...mono, border: "1px solid #3a3a3a", color: "#888" }}>
                    NO HEALTH REPORT FOR THIS MISSION
                </div>
            )}

            <div className="text-xs mb-3 font-semibold" style={{ ...mono, color: "#c0c0c0" }}>
                SUBSYSTEMS — LOWEST HEALTH IN THIS MISSION (CLICK FOR DETAILS)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                {SUBSYSTEMS.map((sub) => {
                    const low = minHealth(model.rows, sub.key);
                    return (
                        <button
                            key={sub.key}
                            onClick={() => onOpenSubsystem(sub.key, low && low.value < 80 ? low.x : undefined)}
                            className="p-3 text-left transition hover:bg-white/5"
                            style={{ border: `1px solid ${low && low.value < 80 ? healthColor(low.value) : "#2a2a2a"}`, background: "#0e0e0e" }}
                        >
                            <div className="text-xs mb-1.5" style={{ ...mono, color: "#999" }}>{sub.label}</div>
                            <div className="text-2xl font-bold" style={{ color: healthColor(low?.value) }}>
                                {low ? Math.round(low.value) : "--"}
                            </div>
                            <div className="text-xs mt-1" style={{ ...mono, color: "#777" }}>
                                {low && low.value < 80 ? `at ${clock(low.x)}` : low ? "healthy" : "no data"}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── SIGNALS ────────────────────────────────────────────────────────────────

export function SignalsTab({
    sub,
    onSub,
    ...cursor
}: CursorProps & { sub: SignalsSub; onSub: (sub: SignalsSub) => void }) {
    const { model } = cursor;
    const spec = SUBSYSTEMS.find((s) => s.key === sub);
    const low = spec ? minHealth(model.rows, spec.key) : null;

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-5">
                {[...SUBSYSTEMS.map((s) => ({ key: s.key as SignalsSub, label: s.label })), { key: "efficiency" as SignalsSub, label: "EFFICIENCY" }].map((item) => {
                    const m = item.key === "efficiency" ? null : minHealth(model.rows, item.key);
                    const active = item.key === sub;
                    return (
                        <button
                            key={item.key}
                            onClick={() => onSub(item.key)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition"
                            style={{
                                ...mono,
                                border: `1px solid ${active ? "#C6FF3D" : "#333"}`,
                                background: active ? "rgba(198,255,61,0.12)" : "#0e0e0e",
                                color: active ? "#C6FF3D" : "#bbb",
                            }}
                        >
                            {item.key !== "efficiency" && (
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: healthColor(m?.value) }} />
                            )}
                            {item.label}
                        </button>
                    );
                })}
            </div>

            {spec ? (
                <div className="flex flex-col gap-4">
                    <div className="text-sm" style={{ color: "#aaa" }}>
                        {spec.description}
                        {low && (
                            <span style={{ ...mono, color: healthColor(low.value) }}>
                                {"  "}{low.value < 80 ? `Lowest health ${Math.round(low.value)} at ${clock(low.x)}.` : "Healthy throughout this mission."}
                            </span>
                        )}
                    </div>
                    <SignalChart
                        {...chartProps(cursor)}
                        title={`${spec.label} HEALTH`}
                        unit="/ 100"
                        height={190}
                        yDomain={[0, 100]}
                        lines={[{ dataKey: spec.key, name: `${spec.label} health`, color: "#C6FF3D", width: 2 }]}
                        showEventLabels
                    />
                    {spec.signals.map((signal) => (
                        <SignalChart
                            key={signal.key}
                            {...chartProps(cursor)}
                            title={signal.label}
                            unit={signal.unit}
                            lines={signalLines(signal, model.hasExpected, model.rows)}
                            limit={signal.limitKey ? { value: model.limits[signal.limitKey], label: "Healthy limit" } : null}
                        />
                    ))}
                    {!model.hasExpected && (
                        <div className="text-xs" style={{ ...mono, color: "#777" }}>
                            Expected-healthy lines unavailable (no fitted baseline or baseline request failed).
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="text-sm" style={{ color: "#aaa" }}>
                        Shaft power per kg/h of fuel over a 60 s window, relative to a warmed-up healthy engine (100). A trend indicator: misfire and fuel starvation pull it down.
                    </div>
                    <SignalChart
                        {...chartProps(cursor)}
                        title="EFFICIENCY INDEX"
                        unit="healthy = 100"
                        height={280}
                        lines={[{ dataKey: "efficiency", name: "Efficiency index", color: "#34d399", width: 2 }]}
                        limit={{ value: 100, label: "Healthy engine" }}
                        showEventLabels
                    />
                </div>
            )}
        </div>
    );
}

// ── HEALTH & RUL ───────────────────────────────────────────────────────────

const HEALTH_LINES = [
    { dataKey: "overall", name: "Overall", color: "#ffffff", width: 2.4 },
    { dataKey: "thermal", name: "Thermal", color: "#f97316" },
    { dataKey: "combustion", name: "Combustion", color: "#60a5fa" },
    { dataKey: "lubrication", name: "Lubrication", color: "#facc15" },
    { dataKey: "mechanical", name: "Mechanical", color: "#a78bfa" },
    { dataKey: "electrical", name: "Electrical", color: "#34d399" },
    { dataKey: "injection", name: "Injection", color: "#e8c34a", dashed: true },
    { dataKey: "sensor", name: "Sensor", color: "#888", dashed: true },
];

export function HealthTab(cursor: CursorProps) {
    return (
        <div className="flex flex-col gap-4">
            <SignalChart
                {...chartProps(cursor)}
                title="SUBSYSTEM HEALTH"
                subtitle="Failure = weakest engine subsystem below 30 (90 s average). Sensor health is not part of overall."
                unit="/ 100"
                height={320}
                yDomain={[0, 100]}
                lines={HEALTH_LINES}
                limit={{ value: 30, label: "Failure threshold" }}
                showEventLabels
            />
            <div className="grid xl:grid-cols-2 gap-4">
                <SignalChart
                    {...chartProps(cursor)}
                    title="ANOMALY SCORE"
                    subtitle="1.0 = detection threshold"
                    lines={[{ dataKey: "anomaly_score", name: "Anomaly score", color: "#e8543f", width: 2 }]}
                    yDomain={[0, "auto"]}
                    limit={{ value: 1, label: "Threshold" }}
                />
                <SignalChart
                    {...chartProps(cursor)}
                    title="REMAINING USEFUL LIFE"
                    subtitle="Predicted time to failure; 10 min = 10 min or more"
                    unit="min"
                    lines={[{ dataKey: "rul_minutes", name: "RUL", color: "#7fd4ff", width: 2 }]}
                    yDomain={[0, 10]}
                />
            </div>
        </div>
    );
}
