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

import type { ReplayPoint } from "../../types/api";

interface RULChartProps {
    data: ReplayPoint[];
    replayIndex: number;
}

export default function RULChart({
    data,
    replayIndex,
}: RULChartProps) {
    const chartData = data
        .map((point, index) => ({
            index,
            time: new Date(point.timestamp).toLocaleTimeString(),
            rul_minutes:
                point.prediction?.rul_seconds != null
                    ? Math.round((point.prediction.rul_seconds / 60) * 10) / 10
                    : null,
        }))
        .filter((point) => point.rul_minutes !== null);

    return (
        <div
            className="p-5"
            style={{
                background: "#0e0e0e",
                border: "1px solid #3a3a3a",
            }}
        >
            <div className="mb-4">
                <div
                    className="text-xs mb-1"
                    style={{
                        color: "#C6FF3D",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    MACHINE LEARNING
                </div>

                <h3
                    className="text-xl font-bold"
                    style={{ color: "#fff" }}
                >
                    ESTIMATED TIME TO FAILURE
                </h3>
                <div
                    className="text-xs mt-1"
                    style={{ color: "#777", fontFamily: "'JetBrains Mono', monospace" }}
                >
                    10 = 10 minutes or more (no failure ahead)
                </div>
            </div>

            {chartData.length === 0 ? (
                <div
                    className="h-64 flex items-center justify-center text-sm"
                    style={{
                        color: "#666",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    NO RUL DATA
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                        <CartesianGrid
                            stroke="#252525"
                            strokeDasharray="3 3"
                        />

                        <XAxis
                            dataKey="time"
                            tick={{
                                fill: "#777",
                                fontSize: 11,
                            }}
                        />

                        <YAxis
                            tick={{
                                fill: "#777",
                                fontSize: 11,
                            }}
                            label={{
                                value: "MINUTES",
                                angle: -90,
                                position: "insideLeft",
                                fill: "#777",
                            }}
                        />

                        <Tooltip
                            contentStyle={{
                                background: "#111",
                                border: "1px solid #444",
                                color: "#fff",
                            }}
                        />

                        <ReferenceLine
                            x={
                                chartData.find(
                                    (point) =>
                                        point.index === replayIndex
                                )?.time
                            }
                            stroke="#C6FF3D"
                        />

                        <Line
                            type="monotone"
                            dataKey="rul_minutes"
                            stroke="#C6FF3D"
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}