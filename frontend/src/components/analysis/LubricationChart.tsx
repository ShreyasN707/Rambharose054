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

interface LubricationChartProps {
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

function movingAverage(
    data: (number | undefined)[],
    windowSize: number
): (number | undefined)[] {
    return data.map((_, index) => {
        const start = Math.max(0, index - windowSize + 1);

        const window = data
            .slice(start, index + 1)
            .filter((value): value is number => value !== undefined);

        if (window.length === 0) {
            return undefined;
        }

        return (
            window.reduce((sum, value) => sum + value, 0) /
            window.length
        );
    });
}

export default function LubricationChart({
    data,
    replayIndex = null,
}: LubricationChartProps) {
    const torqueSmoothed = movingAverage(
        data.map((point) => point.torque),
        5
    );

    const vibrationSmoothed = movingAverage(
        data.map((point) => point.vibration),
        8
    );

    const chartData = data.map((point, index) => ({
        ...point,
        index,
        torque_smoothed: torqueSmoothed[index],
        vibration_smoothed: vibrationSmoothed[index],
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
                    className="font-bold text-xl"
                    style={{ color: "#fff" }}
                >
                    MECHANICAL / LUBRICATION
                </span>

                <div className="flex items-center gap-4">
                    {/* Torque */}
                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#60a5fa" }}
                        />
                        TORQUE
                    </div>

                    {/* Vibration */}
                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#c084fc" }}
                        />
                        VIBRATION
                    </div>

                    {/* Oil Pressure */}
                    <div
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "#aaa" }}
                    >
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: "#38bdf8" }}
                        />
                        OIL PRESSURE
                    </div>
                </div>
            </div>

            {/* TORQUE + VIBRATION */}
            <div className="mb-5">
                <div
                    className="text-[10px] mb-1"
                    style={{
                        color: "#60a5fa",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 17,
                    }}
                >
                    TORQUE / VIBRATION
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
                                    Number(value).toFixed(2),
                                    name,
                                ]}
                            />

                            <Line
                                type="monotone"
                                dataKey="torque_smoothed"
                                name="TORQUE"
                                stroke="#60a5fa"
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                            />

                            <Line
                                type="monotone"
                                dataKey="vibration_smoothed"
                                name="VIBRATION"
                                stroke="#c084fc"
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

            {/* OIL PRESSURE */}
            <div>
                <div
                    className="text-[10px] mb-1"
                    style={{
                        color: "#38bdf8",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 17,
                    }}
                >
                    OIL PRESSURE
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
                                formatter={(value) => [
                                    `${Number(value).toFixed(2)} psi`,
                                    "OIL PRESSURE",
                                ]}
                            />

                            <Line
                                type="monotone"
                                dataKey="oil_pressure"
                                name="OIL PRESSURE"
                                stroke="#38bdf8"
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