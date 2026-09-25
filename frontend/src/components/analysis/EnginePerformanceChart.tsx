import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import type { TelemetryData } from "../../types/api";

interface EnginePerformanceChartProps {
    data: TelemetryData[];
    replayIndex?: number | null;
}

function formatElapsedTime(timestamp: string, startTimestamp: string) {
    const start = new Date(startTimestamp).getTime();
    const current = new Date(timestamp).getTime();

    const elapsedSeconds = Math.max(
        0,
        Math.floor((current - start) / 1000)
    );

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return `T+${String(minutes).padStart(2, "0")}:${String(
        seconds
    ).padStart(2, "0")}`;
}

export default function EnginePerformanceChart({
    data,
    replayIndex = null,
}: EnginePerformanceChartProps) {
    const chartData = data.map((point, index) => ({
        ...point,
        index,
        time: formatElapsedTime(
            point.timestamp,
            data[0]?.timestamp ?? point.timestamp
        ),
    }));

    const replayTime =
        replayIndex !== null &&
        replayIndex !== undefined &&
        replayIndex >= 0 &&
        replayIndex < chartData.length
            ? chartData[replayIndex].time
            : null;

    return (
        <div
            className="p-4"
            style={{
                border: "1px solid #3a3a3a",
                background: "#0e0e0e",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between mb-4"
                style={{
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >
                <span
                    className="font-bold text-sm"
                    style={{ color: "#fff" }}
                >
                    ENGINE PERFORMANCE
                </span>

                <div className="flex items-center gap-4">
                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#C6FF3D" }}
                        />
                        RPM
                    </div>

                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#6DD5FF" }}
                        />
                        FUEL FLOW
                    </div>
                </div>
            </div>

            {/* RPM */}
            <div className="mb-5">
                <div
                    className="text-[10px] mb-1"
                    style={{
                        color: "#666",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    RPM
                </div>

                <div style={{ width: "100%", height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{
                                top: 5,
                                right: 15,
                                left: 0,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid
                                stroke="#222"
                                strokeDasharray="3 3"
                            />

                            <XAxis
                                dataKey="time"
                                stroke="#555"
                                tick={{
                                    fill: "#777",
                                    fontSize: 10,
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                }}
                                minTickGap={40}
                            />

                            <YAxis
                                stroke="#555"
                                domain={["auto", "auto"]}
                                tick={{
                                    fill: "#777",
                                    fontSize: 10,
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                }}
                                width={55}
                            />

                            <Tooltip
                                contentStyle={{
                                    background: "#111",
                                    border: "1px solid #444",
                                    color: "#fff",
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                    fontSize: 11,
                                }}
                                labelStyle={{
                                    color: "#C6FF3D",
                                    marginBottom: 5,
                                }}
                                formatter={(value) => [
                                    `${Number(value).toFixed(2)} rpm`,
                                    "RPM",
                                ]}
                            />

                            <Line
                                type="monotone"
                                dataKey="rpm"
                                name="RPM"
                                stroke="#C6FF3D"
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                            />

                            {replayTime && (
                                <ReferenceLine
                                    x={replayTime}
                                    stroke="#ffffff"
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Fuel Flow */}
            <div>
                <div
                    className="text-[10px] mb-1"
                    style={{
                        color: "#666",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    FUEL FLOW
                </div>

                <div style={{ width: "100%", height: 170 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{
                                top: 5,
                                right: 15,
                                left: 0,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid
                                stroke="#222"
                                strokeDasharray="3 3"
                            />

                            <XAxis
                                dataKey="time"
                                stroke="#aca1a1"
                                tick={{
                                    fill: "#efeaea",
                                    fontSize: 11,
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                }}
                                minTickGap={40}
                            />

                            <YAxis
                                stroke="#aca1a1"
                                domain={["auto", "auto"]}
                                tick={{
                                    fill: "#efeaea",
                                    fontSize: 11,
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                }}
                                width={55}
                            />

                            <Tooltip
                                contentStyle={{
                                    background: "#111",
                                    border: "1px solid #444",
                                    color: "#fff",
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                    fontSize: 11,
                                }}
                                labelStyle={{
                                    color: "#6DD5FF",
                                    marginBottom: 5,
                                }}
                                formatter={(value) => [
                                    `${Number(value).toFixed(2)}`,
                                    "FUEL FLOW",
                                ]}
                            />

                            <Line
                                type="monotone"
                                dataKey="fuel_flow"
                                name="FUEL FLOW"
                                stroke="#6DD5FF"
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                            />

                            {replayTime && (
                                <ReferenceLine
                                    x={replayTime}
                                    stroke="#ffffff"
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}