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

interface AnomalyChartProps {
    data: ReplayPoint[];
    replayIndex: number;
}

export default function AnomalyChart({
    data,
    replayIndex,
}: AnomalyChartProps) {
    const chartData = data
        .map((point, index) => ({
            index,
            time: new Date(point.timestamp).toLocaleTimeString(),
            anomaly_score: point.prediction?.anomaly_score ?? null,
        }))
        .filter((point) => point.anomaly_score !== null);

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
                    ANOMALY SCORE
                </h3>
            </div>

            {chartData.length === 0 ? (
                <div
                    className="h-64 flex items-center justify-center text-sm"
                    style={{
                        color: "#666",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    NO PREDICTION DATA
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
                            domain={[0, "auto"]}
                            tick={{
                                fill: "#777",
                                fontSize: 11,
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
                            y={1}
                            stroke="#888"
                            strokeDasharray="5 5"
                            label={{
                                value: "ANOMALY THRESHOLD",
                                fill: "#888",
                                fontSize: 10,
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
                            dataKey="anomaly_score"
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