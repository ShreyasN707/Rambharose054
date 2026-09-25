import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from "recharts";
import type { HealthHistoryPoint } from "../../types/api";

interface HealthTrendChartProps {
    data: HealthHistoryPoint[];
    replayIndex?: number | null;
}

const series = [
    {
        key: "overall",
        label: "OVERALL",
        color: "#C6FF3D",
    },
    {
        key: "thermal",
        label: "THERMAL",
        color: "#e8543f",
    },
    {
        key: "combustion",
        label: "COMBUSTION",
        color: "#e8c34a",
    },
    {
        key: "lubrication",
        label: "LUBRICATION",
        color: "#7fd4ff",
    },
    {
        key: "mechanical",
        label: "MECHANICAL",
        color: "#c084fc",
    },
] as const;

function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], {
        minute: "2-digit",
        second: "2-digit",
    });
}

export default function HealthTrendChart({
    data,
    replayIndex= null,
}: HealthTrendChartProps) {
    const chartData = data.map((point) => ({
        ...point.health,
        time: formatTime(point.timestamp),
    }));

    return (
        <div
            className="p-4"
            style={{
                border: "1px solid #3a3a3a",
                background: "#0e0e0e",
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <span
                    className="font-bold text-sm"
                    style={{
                        color: "#fff",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    HEALTH TRENDS
                </span>

                <div className="flex flex-wrap gap-4">
                    {series.map((item) => (
                        <div
                            key={item.key}
                            className="flex items-center gap-1.5 text-xs"
                            style={{
                                color: "#999",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                    background: item.color,
                                }}
                            />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ width: "100%", height: 340 }}>
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
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                            minTickGap={40}
                        />

                        <YAxis
                            domain={[0, 100]}
                            stroke="#555"
                            tick={{
                                fill: "#777",
                                fontSize: 10,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                            width={40}
                        />

                        <Tooltip
                            contentStyle={{
                                background: "#111",
                                border: "1px solid #444",
                                color: "#fff",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                            }}
                            labelStyle={{
                                color: "#C6FF3D",
                                marginBottom: 5,
                            }}
                            formatter={(value, name) => [
                                `${Number(value).toFixed(1)}%`,
                                name,
                            ]}
                        />

                        {series.map((item) => (
                            <Line
                                key={item.key}
                                type="monotone"
                                dataKey={item.key}
                                name={item.label}
                                stroke={item.color}
                                strokeWidth={
                                    item.key === "overall" ? 2.5 : 1.5
                                }
                                dot={false}
                                isAnimationActive={false}
                            />
                        ))}

                        {replayIndex !== null &&
                            replayIndex !== undefined &&
                            replayIndex >= 0 &&
                            replayIndex < chartData.length && (
                                <ReferenceLine
                                    x={chartData[replayIndex].time}
                                    stroke="#ffffff"
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                />
                            )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}