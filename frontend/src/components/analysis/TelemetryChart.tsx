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

interface Series {
    key: keyof TelemetryData;
    label: string;
    unit: string;
    color: string;
}

interface TelemetryChartProps {
    title: string;
    data: TelemetryData[];
    series: Series[];
    replayIndex?: number | null;
}

function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], {
        minute: "2-digit",
        second: "2-digit",
    });
}

export default function TelemetryChart({
    title,
    data,
    series,
    replayIndex = null,
}: TelemetryChartProps) {
    const chartData = data.map((point, index) => ({
        ...point,
        index,
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
                    {title}
                </span>

                <div className="flex items-center gap-4">
                    {series.map((item) => (
                        <div
                            key={String(item.key)}
                            className="flex items-center gap-1.5 text-xs"
                            style={{ color: "#aaa" }}
                        >
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: item.color }}
                            />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ width: "100%", height: 320 }}>
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
                            stroke="#555"
                            tick={{
                                fill: "#777",
                                fontSize: 10,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                            width={55}
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
                            formatter={(value, name) => {
                                const item = series.find(
                                    (s) => s.label === name
                                );

                                return [
                                    `${Number(value).toFixed(2)} ${item?.unit ?? ""}`,
                                    name,
                                ];
                            }}
                        />

                        {series.map((item) => (
                            <Line
                                key={String(item.key)}
                                type="monotone"
                                dataKey={String(item.key)}
                                name={item.label}
                                stroke={item.color}
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
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