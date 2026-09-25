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

interface ThermalChartProps {
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

export default function ThermalChart({
    data,
    replayIndex = null,
}: ThermalChartProps) {
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
                    className="font-bold text-sm text-xl"
                    style={{ color: "#fff" }}
                >
                    THERMAL
                </span>

                <div className="flex items-center gap-4">
                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#ff6b5c" }}
                        />
                        CHT
                    </div>

                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#ff9f43" }}
                        />
                        OIL TEMP
                    </div>

                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#f5c542" }}
                        />
                        EGT
                    </div>
                </div>
            </div>

            {/* CHT + OIL TEMP */}
            <div className="mb-5">
                <div
                    className="text-[10px] mb-1"
                    style={{
                        color: "#ff9f43",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 17,
                    }}
                >
                    CHT / OIL TEMPERATURE
                </div>

                <div style={{ width: "100%", height: 220 }}>
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
                                    color: "#C6FF3D",
                                    marginBottom: 5,
                                }}
                                formatter={(value, name) => [
                                    `${Number(value).toFixed(2)} °C`,
                                    name,
                                ]}
                            />

                            <Line
                                type="monotone"
                                dataKey="cht"
                                name="CHT"
                                stroke="#ff6b5c"
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                            />

                            <Line
                                type="monotone"
                                dataKey="oil_temperature"
                                name="OIL TEMP"
                                stroke="#ff9f43"
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

            {/* EGT */}
            <div>
                <div
                    className="text-[10px] mb-1"
                    style={{
                        color: "#f5c542",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 17,
                    }}
                >
                    EXHAUST GAS TEMPERATURE
                </div>

                <div style={{ width: "100%", height: 220 }}>
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
                                    color: "#f5c542",
                                    marginBottom: 5,
                                }}
                                formatter={(value) => [
                                    `${Number(value).toFixed(2)} °C`,
                                    "EGT",
                                ]}
                            />

                            <Line
                                type="monotone"
                                dataKey="egt"
                                name="EGT"
                                stroke="#f5c542"
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