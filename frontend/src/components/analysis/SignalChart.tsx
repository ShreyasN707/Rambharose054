import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { clock, type MissionEvent, type Row, type SignalSpec } from "./missionData";

export interface LineSpec {
    dataKey: string;
    name: string;
    color: string;
    width?: number;
    opacity?: number;
    dashed?: boolean;
}

// Raw (faint) + smoothed (bold) + expected healthy (dashed) for one signal.
export function signalLines(spec: SignalSpec, hasExpected: boolean, rows: Row[]): LineSpec[] {
    const lines: LineSpec[] = [];
    if (spec.smooth) {
        lines.push({ dataKey: spec.key, name: `${spec.label} (raw)`, color: spec.color, width: 1, opacity: 0.25 });
        lines.push({ dataKey: `${spec.key}_smooth`, name: spec.label, color: spec.color, width: 2 });
    } else {
        lines.push({ dataKey: spec.key, name: spec.label, color: spec.color, width: 1.6 });
    }
    const expectedKey = `${spec.key}_expected`;
    if (hasExpected && rows.some((r) => r[expectedKey] != null)) {
        lines.push({ dataKey: expectedKey, name: "Expected (healthy)", color: "#d0d0d0", width: 1.2, dashed: true, opacity: 0.8 });
    }
    return lines;
}

interface SignalChartProps {
    title: string;
    subtitle?: string;
    rows: Row[];
    lines: LineSpec[];
    unit?: string;
    height?: number;
    yDomain?: [number | "auto", number | "auto"];
    limit?: { value: number; label: string } | null;
    events: MissionEvent[];
    faultSpan: [number, number] | null;
    duration: number;
    cursorX: number | null;
    onSelectX: (x: number) => void;
    showEventLabels?: boolean;
    compact?: boolean;
}

const mono = "'JetBrains Mono', monospace";

// Y range from the measured lines (and the limit), padded; the expected-
// healthy line is clipped to it, since the baseline extrapolates poorly in
// the first seconds after a cold start.
function autoDomain(
    rows: Row[],
    lines: LineSpec[],
    limit: number | undefined,
    fixed: [number | "auto", number | "auto"],
): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (const l of lines) {
        if (l.dashed) continue;
        for (const r of rows) {
            const v = r[l.dataKey];
            if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        }
    }
    if (limit != null) { lo = Math.min(lo, limit); hi = Math.max(hi, limit); }
    if (!Number.isFinite(lo)) return [0, 1];
    const pad = (hi - lo) * 0.05 || Math.abs(hi) * 0.05 || 1;
    let min = lo >= 0 ? Math.max(0, lo - pad) : lo - pad;
    let max = hi + pad;
    // Round to a tidy step so the 5 ticks land on round numbers.
    const raw = (max - min) / 4;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const m = raw / pow;
    const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pow;
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    return [
        typeof fixed[0] === "number" ? fixed[0] : min,
        typeof fixed[1] === "number" ? fixed[1] : max,
    ];
}

export default function SignalChart({
    title,
    subtitle,
    rows,
    lines,
    unit = "",
    height = 240,
    yDomain = ["auto", "auto"],
    limit = null,
    events,
    faultSpan,
    duration,
    cursorX,
    onSelectX,
    showEventLabels = false,
    compact = false,
}: SignalChartProps) {
    const legend = lines.filter((l) => !l.name.endsWith("(raw)"));
    const domain = yDomain[0] === "auto" || yDomain[1] === "auto" ? autoDomain(rows, lines, limit?.value, yDomain) : yDomain;

    return (
        <div className={compact ? "" : "p-4"} style={compact ? undefined : { border: "1px solid #2e2e2e", background: "#0e0e0e" }}>
            {title && <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2" style={{ fontFamily: mono }}>
                <div>
                    <span className={compact ? "text-xs font-bold" : "text-sm font-bold"} style={{ color: "#fff" }}>{title}</span>
                    {unit && <span className="text-xs ml-2" style={{ color: "#777" }}>{unit}</span>}
                    {subtitle && <div className="text-xs mt-0.5" style={{ color: "#888" }}>{subtitle}</div>}
                </div>
                {!compact && (
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#aaa" }}>
                        {legend.map((l) => (
                            <span key={l.dataKey} className="flex items-center gap-1.5">
                                <span style={{ width: 14, borderTop: `2px ${l.dashed ? "dashed" : "solid"} ${l.color}` }} />
                                {l.name}
                            </span>
                        ))}
                        {limit && (
                            <span className="flex items-center gap-1.5">
                                <span style={{ width: 14, borderTop: "2px dotted #e8543f" }} />
                                {limit.label}
                            </span>
                        )}
                    </div>
                )}
            </div>}

            <div style={{ width: "100%", height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={rows}
                        syncId="mission"
                        syncMethod="value"
                        margin={{ top: showEventLabels ? 28 : 6, right: 12, left: 0, bottom: 0 }}
                        onClick={(state) => {
                            const x = Number(state?.activeLabel);
                            if (Number.isFinite(x)) onSelectX(x);
                        }}
                        style={{ cursor: "crosshair" }}
                    >
                        {!compact && <CartesianGrid stroke="#1e1e1e" strokeDasharray="3 3" />}
                        <XAxis
                            dataKey="x"
                            type="number"
                            domain={[0, Math.max(duration, 1)]}
                            tickFormatter={clock}
                            hide={compact}
                            stroke="#555"
                            tick={{ fill: "#999", fontSize: 10, fontFamily: mono }}
                            minTickGap={50}
                        />
                        <YAxis
                            domain={domain}
                            allowDataOverflow
                            tickCount={5}
                            hide={compact}
                            width={52}
                            stroke="#555"
                            tick={{ fill: "#999", fontSize: 10, fontFamily: mono }}
                            tickFormatter={(v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Number(v.toFixed(2)).toString())}
                        />
                        <Tooltip
                            isAnimationActive={false}
                            contentStyle={{ background: "#111", border: "1px solid #444", fontFamily: mono, fontSize: 11 }}
                            labelStyle={{ color: "#C6FF3D", marginBottom: 4 }}
                            labelFormatter={(x) => clock(Number(x))}
                            formatter={(value, name) => [
                                value == null ? "--" : `${Number(value).toFixed(Math.abs(Number(value)) >= 100 ? 0 : 2)} ${unit}`,
                                name,
                            ]}
                        />

                        {faultSpan && (
                            <ReferenceArea x1={faultSpan[0]} x2={faultSpan[1]} fill="#e8543f" fillOpacity={0.07} ifOverflow="extendDomain" />
                        )}
                        {events.map((e) => (
                            <ReferenceLine
                                key={`${e.label}-${e.x}`}
                                x={e.x}
                                stroke={e.color}
                                strokeOpacity={0.7}
                                strokeDasharray="2 3"
                                label={showEventLabels ? (props: { viewBox?: { x?: number; y?: number } }) => (
                                    <text
                                        x={(props.viewBox?.x ?? 0) + 3}
                                        y={(props.viewBox?.y ?? 0) - 4 - (e.labelRow ?? 0) * 11}
                                        fill={e.color}
                                        fontSize={9}
                                        fontFamily={mono}
                                    >
                                        {e.label}
                                    </text>
                                ) : undefined}
                            />
                        ))}
                        {limit && (
                            <ReferenceLine y={limit.value} stroke="#e8543f" strokeDasharray="1 3" strokeWidth={1.5} ifOverflow="extendDomain" />
                        )}

                        {lines.map((l) => (
                            <Line
                                key={l.dataKey}
                                type="monotone"
                                dataKey={l.dataKey}
                                name={l.name}
                                stroke={l.color}
                                strokeWidth={l.width ?? 1.6}
                                strokeOpacity={l.opacity ?? 1}
                                strokeDasharray={l.dashed ? "5 4" : undefined}
                                dot={false}
                                activeDot={l.name.endsWith("(raw)") ? false : { r: 3 }}
                                isAnimationActive={false}
                                connectNulls={false}
                            />
                        ))}

                        {cursorX != null && <ReferenceLine x={cursorX} stroke="#ffffff" strokeWidth={1.2} />}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
