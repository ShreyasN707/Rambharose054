import { useEffect, useMemo, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";
import type { MissionReport } from "../../types/api";
import SignalChart from "./SignalChart";
import {
    LEVEL_COLOR,
    SUBSYSTEMS,
    clock,
    healthColor,
    type MissionModel,
    type Row,
    type SubsystemKey,
} from "./missionData";

const mono = { fontFamily: "'JetBrains Mono', monospace" };

const SPARKLINES = [
    { key: "rpm", label: "RPM", unit: "rpm", color: "#60a5fa" },
    { key: "torque", label: "TORQUE", unit: "N·m", color: "#93c5fd" },
    { key: "fuel_flow", label: "FUEL FLOW", unit: "kg/h", color: "#22d3ee" },
    { key: "cht", label: "CHT", unit: "°C", color: "#f97316" },
    { key: "egt", label: "EGT", unit: "°C", color: "#e8543f" },
    { key: "oil_pressure", label: "OIL PRESSURE", unit: "psi", color: "#facc15" },
    { key: "oil_temperature", label: "OIL TEMP", unit: "°C", color: "#fb923c" },
    { key: "vibration_rms", label: "VIBRATION RMS", unit: "", color: "#a78bfa" },
    { key: "battery_voltage", label: "BUS VOLTAGE", unit: "V", color: "#34d399" },
    { key: "alternator_current", label: "ALTERNATOR", unit: "A", color: "#7fd4ff" },
    { key: "injection_timing", label: "INJ TIMING", unit: "°", color: "#e8c34a" },
    { key: "injection_duration", label: "INJ PULSE", unit: "ms", color: "#c084fc" },
];

// Sparklines redraw on every replay step; ~300 points each keeps that cheap.
const SPARK_POINTS = 300;

function fmt(v: number | null | undefined) {
    if (v == null) return "--";
    return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
}

export default function ReplayTab({
    model,
    report,
    cursorIndex,
    onCursorIndex,
    onOpenSubsystem,
}: {
    model: MissionModel;
    report: MissionReport | null;
    cursorIndex: number;
    onCursorIndex: (index: number) => void;
    onOpenSubsystem: (key: SubsystemKey) => void;
}) {
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(5);
    const { rows } = model;
    const row: Row | undefined = rows[cursorIndex];
    const cursorX = row?.x ?? null;

    useEffect(() => {
        if (!playing) return;
        if (cursorIndex >= rows.length - 1) { setPlaying(false); return; }
        const id = window.setTimeout(() => onCursorIndex(cursorIndex + 1), 1000 / speed);
        return () => window.clearTimeout(id);
    }, [playing, speed, cursorIndex, rows.length, onCursorIndex]);

    const sparkRows = useMemo(() => {
        const stride = Math.max(1, Math.ceil(rows.length / SPARK_POINTS));
        return rows.filter((_, i) => i % stride === 0 || i === rows.length - 1);
    }, [rows]);

    const advisory = report?.advisories.filter((a) => cursorX != null && a.at_s <= cursorX).pop();
    const selectX = (x: number) => {
        const i = rows.findIndex((r) => r.x >= x);
        onCursorIndex(i < 0 ? rows.length - 1 : i);
    };

    if (!rows.length) {
        return <div className="p-6 text-sm" style={{ ...mono, color: "#777", border: "1px solid #3a3a3a" }}>NO REPLAY DATA</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Controls + scrubber */}
            <div className="p-4" style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }}>
                <div className="flex flex-wrap items-center gap-3 mb-3" style={mono}>
                    <button
                        onClick={() => { if (cursorIndex >= rows.length - 1) onCursorIndex(0); setPlaying((p) => !p); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold"
                        style={{ background: "#C6FF3D", color: "#050505" }}
                    >
                        {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "PAUSE" : "PLAY"}
                    </button>
                    <button onClick={() => { setPlaying(false); onCursorIndex(0); }} className="px-3 py-2" style={{ border: "1px solid #444", color: "#ccc" }} title="Back to start">
                        <SkipBack size={14} />
                    </button>
                    <div className="flex" style={{ border: "1px solid #333" }}>
                        {[1, 5, 10, 30].map((s) => (
                            <button key={s} onClick={() => setSpeed(s)} className="px-2.5 py-1.5 text-xs"
                                style={{ background: speed === s ? "rgba(198,255,61,0.15)" : "transparent", color: speed === s ? "#C6FF3D" : "#888" }}>
                                {s}×
                            </button>
                        ))}
                    </div>
                    <span className="text-lg font-bold ml-auto" style={{ color: "#fff" }}>
                        {clock(cursorX)} <span className="text-xs" style={{ color: "#777" }}>/ {clock(model.duration)}</span>
                    </span>
                </div>

                <div className="relative pt-4">
                    {model.events.map((e) => (
                        <button
                            key={`${e.label}-${e.x}`}
                            onClick={() => selectX(e.x)}
                            title={`${e.label} at ${clock(e.x)}`}
                            className="absolute top-0 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap"
                            style={{ ...mono, left: `${(e.x / Math.max(model.duration, 1)) * 100}%`, color: e.color }}
                        >
                            ▼
                        </button>
                    ))}
                    <input
                        type="range"
                        min={0}
                        max={rows.length - 1}
                        value={cursorIndex}
                        onChange={(e) => { setPlaying(false); onCursorIndex(Number(e.target.value)); }}
                        className="w-full"
                        style={{ accentColor: "#C6FF3D" }}
                    />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs" style={mono}>
                    {model.events.map((e) => (
                        <button key={`${e.label}-${e.x}-legend`} onClick={() => selectX(e.x)} style={{ color: e.color }}>
                            ▼ {e.label} {clock(e.x)}
                        </button>
                    ))}
                    {!model.events.length && <span style={{ color: "#666" }}>No faults or advisories in this mission.</span>}
                </div>
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
                {/* Subsystems + advisory at the cursor */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="p-4" style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }}>
                        <div className="flex items-baseline justify-between mb-3" style={mono}>
                            <span className="text-sm font-bold" style={{ color: "#fff" }}>SUBSYSTEM HEALTH</span>
                            <span className="text-xs" style={{ color: "#888" }}>
                                OVERALL <span className="text-base font-bold" style={{ color: healthColor(row?.overall) }}>{row?.overall != null ? Math.round(row.overall) : "--"}</span>
                            </span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {SUBSYSTEMS.map((sub) => {
                                const value = row?.[sub.key] ?? null;
                                return (
                                    <button key={sub.key} onClick={() => onOpenSubsystem(sub.key)} className="text-left group" title="Open this subsystem's signals at this moment">
                                        <div className="flex justify-between text-xs mb-1" style={mono}>
                                            <span className="group-hover:underline" style={{ color: "#ddd" }}>{sub.label} ›</span>
                                            <span style={{ color: healthColor(value), fontWeight: 700 }}>{value != null ? Math.round(value) : "--"}</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full" style={{ background: "#262626" }}>
                                            <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: healthColor(value), transition: "width 0.2s" }} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {row?.overall == null && (
                            <div className="text-xs mt-3" style={{ ...mono, color: "#777" }}>Health scores start 60 s into the mission.</div>
                        )}
                    </div>

                    <div className="p-4" style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }}>
                        <div className="text-sm font-bold mb-2" style={{ ...mono, color: "#fff" }}>AT THIS MOMENT</div>
                        <div className="text-sm mb-2" style={{ color: "#ddd" }}>
                            {advisory && advisory.level !== "CLEARED" ? (
                                <>
                                    <span style={{ ...mono, color: LEVEL_COLOR[advisory.level], fontWeight: 700 }}>{advisory.level} </span>
                                    {advisory.title}
                                    <span style={{ color: "#888" }}> (since {clock(advisory.at_s)})</span>
                                    {advisory.do_now.length > 0 && <div className="text-xs mt-1" style={{ color: "#aaa" }}>{advisory.do_now.join(" ")}</div>}
                                </>
                            ) : (
                                <span style={{ color: "#7fe0a0" }}>No active advisory.</span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs" style={mono}>
                            <div style={{ color: "#888" }}>ANOMALY SCORE <span className="font-bold" style={{ color: (row?.anomaly_score ?? 0) >= 1 ? "#e8543f" : "#fff" }}>{fmt(row?.anomaly_score)}</span></div>
                            <div style={{ color: "#888" }}>RUL <span className="font-bold" style={{ color: "#fff" }}>{row?.rul_minutes != null ? `${row.rul_minutes} min` : "--"}</span></div>
                        </div>
                    </div>
                </div>

                {/* Every signal over the whole mission, cursor line at this moment */}
                <div className="lg:col-span-3 p-4" style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }}>
                    <div className="text-sm font-bold mb-3" style={{ ...mono, color: "#fff" }}>SIGNALS</div>
                    <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
                        {SPARKLINES.map((s) => (
                            <div key={s.key}>
                                <div className="flex justify-between text-xs" style={mono}>
                                    <span style={{ color: "#999" }}>{s.label}</span>
                                    <span style={{ color: s.color, fontWeight: 700 }}>{fmt(row?.[s.key])} <span style={{ color: "#666" }}>{s.unit}</span></span>
                                </div>
                                <SignalChart
                                    title=""
                                    compact
                                    height={46}
                                    rows={sparkRows}
                                    lines={[{ dataKey: s.key, name: s.label, color: s.color, width: 1.2 }]}
                                    unit={s.unit}
                                    events={model.events}
                                    faultSpan={model.faultSpan}
                                    duration={model.duration}
                                    cursorX={cursorX}
                                    onSelectX={selectX}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
