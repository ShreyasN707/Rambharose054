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
import { efficiencySeries } from "../../efficiency";

interface EfficiencyChartProps {
    data: TelemetryData[];
    replayIndex?: number | null;
}

function formatElapsedTime(timestamp: string, startTimestamp: string) {
    const elapsedSeconds = Math.max(
        0,
        Math.floor(
            (new Date(timestamp).getTime() - new Date(startTimestamp).getTime()) / 1000
        )
    );
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `T+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function EfficiencyChart({
    data,
    replayIndex = null,
}: EfficiencyChartProps) {
    const index = efficiencySeries(data);
    const chartData = data.map((point, i) => ({
        time: formatElapsedTime(point.timestamp, data[0]?.timestamp ?? point.timestamp),
        efficiency: index[i] != null ? Math.round(index[i]! * 10) / 10 : null,
    }));

    const replayTime =
        replayIndex != null && chartData[replayIndex]
            ? chartData[replayIndex].time
            : undefined;

    const mono = { fontFamily: "'JetBrains Mono', monospace" };

    return (
        <div className="p-5" style={{ background: "#0e0e0e", border: "1px solid #3a3a3a" }}>
            <div className="mb-4">
                <div className="text-xs mb-1" style={{ ...mono, color: "#C6FF3D" }}>
                    ENGINE EFFICIENCY TREND
                </div>
                <h3 className="text-xl font-bold" style={{ color: "#fff" }}>
                    POWER PER UNIT OF FUEL
                </h3>
                <div className="text-xs mt-1" style={{ ...mono, color: "#777" }}>
                    100 = warmed-up healthy engine (60 s rolling average)
                </div>
            </div>

            {chartData.every((point) => point.efficiency == null) ? (
                <div className="h-64 flex items-center justify-center text-sm" style={{ ...mono, color: "#666" }}>
                    NOT ENOUGH DATA
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                        <CartesianGrid stroke="#252525" strokeDasharray="3 3" />
                        <XAxis dataKey="time" tick={{ fill: "#777", fontSize: 11 }} minTickGap={40} />
                        <YAxis
                            domain={[40, 130]}
                            tick={{ fill: "#777", fontSize: 11 }}
                            label={{ value: "INDEX", angle: -90, position: "insideLeft", fill: "#777" }}
                        />
                        <Tooltip
                            contentStyle={{ background: "#111", border: "1px solid #444", color: "#fff" }}
                        />
                        <ReferenceLine y={100} stroke="#7fe0a0" strokeDasharray="5 5" />
                        <ReferenceLine y={90} stroke="#e8c34a" strokeDasharray="3 3" />
                        {replayTime && <ReferenceLine x={replayTime} stroke="#C6FF3D" />}
                        <Line
                            type="monotone"
                            dataKey="efficiency"
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
