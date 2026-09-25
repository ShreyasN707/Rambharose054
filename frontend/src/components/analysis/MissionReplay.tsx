import { useEffect, useMemo, useState } from "react";
import {
    Pause,
    Play,
    SkipBack,
    SkipForward,
} from "lucide-react";
import type { ReplayPoint } from "../../types/api";

interface MissionReplayProps {
    points: ReplayPoint[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
}

const SPEEDS = [1, 2, 5];

function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function formatDuration(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0"
        )}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
        2,
        "0"
    )}`;
}

export default function MissionReplay({
    points,
    currentIndex,
    onIndexChange,
}: MissionReplayProps) {
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);

    const currentPoint = points[currentIndex];

    const duration = useMemo(() => {
        if (points.length < 2) return 0;

        const start = new Date(points[0].timestamp).getTime();
        const end = new Date(
            points[points.length - 1].timestamp
        ).getTime();

        return (end - start) / 1000;
    }, [points]);

    const elapsed = useMemo(() => {
        if (!currentPoint || points.length === 0) return 0;

        const start = new Date(points[0].timestamp).getTime();
        const current = new Date(currentPoint.timestamp).getTime();

        return (current - start) / 1000;
    }, [currentPoint, points]);

    useEffect(() => {
        if (!playing || points.length < 2) return;

        const interval = window.setInterval(() => {
            onIndexChange(
                currentIndex >= points.length - 1
                    ? 0
                    : currentIndex + 1
            );
        }, 1000 / speed);

        return () => window.clearInterval(interval);
    }, [
        playing,
        speed,
        currentIndex,
        points.length,
        onIndexChange,
    ]);

    useEffect(() => {
        if (currentIndex >= points.length && points.length > 0) {
            onIndexChange(points.length - 1);
        }
    }, [currentIndex, points.length, onIndexChange]);

    if (points.length === 0) {
        return (
            <section
                className="p-6"
                style={{
                    border: "1px solid #3a3a3a",
                    background: "#0e0e0e",
                }}
            >
                <div
                    className="text-sm"
                    style={{
                        color: "#777",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    NO REPLAY DATA AVAILABLE
                </div>
            </section>
        );
    }

    return (
        <section
            className="p-5"
            style={{
                border: "1px solid #3a3a3a",
                background: "#0e0e0e",
            }}
        >
            <div className="flex items-center justify-between mb-5">
                <div>
                    <div
                        className="text-xs mb-1"
                        style={{
                            color: "#C6FF3D",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        RECORDED MISSION
                    </div>

                    <h2
                        className="text-2xl font-bold"
                        style={{ color: "#fff" }}
                    >
                        MISSION REPLAY
                    </h2>
                </div>

                <div
                    className="text-xs"
                    style={{
                        color: "#777",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    {currentIndex + 1} / {points.length}
                </div>
            </div>

            {/* Timeline */}
            <div className="mb-6">
                <div className="flex justify-between mb-2">
                    <span
                        className="text-xs"
                        style={{
                            color: "#777",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        {formatTime(points[0].timestamp)}
                    </span>

                    <span
                        className="text-sm font-bold"
                        style={{
                            color: "#C6FF3D",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        {formatTime(currentPoint.timestamp)}
                    </span>

                    <span
                        className="text-xs"
                        style={{
                            color: "#777",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        {formatTime(
                            points[points.length - 1].timestamp
                        )}
                    </span>
                </div>

                <input
                    type="range"
                    min={0}
                    max={Math.max(0, points.length - 1)}
                    value={currentIndex}
                    onChange={(e) =>
                        onIndexChange(Number(e.target.value))
                    }
                    className="w-full"
                    style={{
                        accentColor: "#C6FF3D",
                        cursor: "pointer",
                    }}
                />

                <div
                    className="flex justify-between mt-1 text-xs"
                    style={{
                        color: "#555",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    <span>+{formatDuration(elapsed)}</span>
                    <span>{formatDuration(duration)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                <button
                    onClick={() => onIndexChange(0)}
                    className="p-2 transition hover:bg-white/10"
                    style={{
                        border: "1px solid #444",
                        color: "#ccc",
                    }}
                    title="Restart"
                >
                    <SkipBack size={16} />
                </button>

                <button
                    onClick={() => {
                        if (
                            currentIndex >= points.length - 1
                        ) {
                            onIndexChange(0);
                        }

                        setPlaying((value) => !value);
                    }}
                    className="flex items-center gap-2 px-5 py-2 font-bold text-sm"
                    style={{
                        background: "#C6FF3D",
                        color: "#050505",
                    }}
                >
                    {playing ? (
                        <>
                            <Pause size={15} />
                            PAUSE
                        </>
                    ) : (
                        <>
                            <Play size={15} />
                            PLAY
                        </>
                    )}
                </button>

                <button
                    onClick={() =>
                        onIndexChange(
                            Math.min(
                                points.length - 1,
                                currentIndex + 1
                            )
                        )
                    }
                    className="p-2 transition hover:bg-white/10"
                    style={{
                        border: "1px solid #444",
                        color: "#ccc",
                    }}
                    title="Next sample"
                >
                    <SkipForward size={16} />
                </button>

                <div className="ml-3 flex items-center gap-1">
                    <span
                        className="text-xs mr-2"
                        style={{
                            color: "#777",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        SPEED
                    </span>

                    {SPEEDS.map((value) => (
                        <button
                            key={value}
                            onClick={() => setSpeed(value)}
                            className="px-3 py-1.5 text-xs font-bold"
                            style={{
                                border:
                                    speed === value
                                        ? "1px solid #C6FF3D"
                                        : "1px solid #444",
                                background:
                                    speed === value
                                        ? "rgba(198,255,61,0.12)"
                                        : "transparent",
                                color:
                                    speed === value
                                        ? "#C6FF3D"
                                        : "#777",
                                fontFamily:
                                    "'JetBrains Mono', monospace",
                            }}
                        >
                            {value}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Current telemetry */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                    ["RPM", currentPoint.telemetry.rpm, "rpm"],
                    ["CHT", currentPoint.telemetry.cht, "°C"],
                    ["EGT", currentPoint.telemetry.egt, "°C"],
                    [
                        "OIL PRESSURE",
                        currentPoint.telemetry.oil_pressure,
                        "psi",
                    ],
                    [
                        "OIL TEMP",
                        currentPoint.telemetry.oil_temperature,
                        "°C",
                    ],
                    [
                        "FUEL FLOW",
                        currentPoint.telemetry.fuel_flow,
                        "gal/hr",
                    ],
                    [
                        "VIBRATION",
                        currentPoint.telemetry.vibration,
                        "mm/s",
                    ],
                ].map(([label, value, unit]) => (
                    <div
                        key={String(label)}
                        className="p-3"
                        style={{
                            border: "1px solid #292929",
                            background: "#090909",
                        }}
                    >
                        <div
                            className="text-[10px] mb-1"
                            style={{
                                color: "#666",
                                fontFamily:
                                    "'JetBrains Mono', monospace",
                            }}
                        >
                            {label}
                        </div>

                        <div
                            className="font-bold text-sm"
                            style={{
                                color: "#fff",
                                fontFamily:
                                    "'JetBrains Mono', monospace",
                            }}
                        >
                            {Number(value).toFixed(2)}
                        </div>

                        <div
                            className="text-[10px] mt-0.5"
                            style={{
                                color: "#555",
                                fontFamily:
                                    "'JetBrains Mono', monospace",
                            }}
                        >
                            {unit}
                        </div>
                    </div>
                ))}
            </div>

            {/* Health at replay point */}
            {currentPoint.health && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                    {[
                        ["OVERALL", currentPoint.health.overall],
                        ["THERMAL", currentPoint.health.thermal],
                        [
                            "COMBUSTION",
                            currentPoint.health.combustion,
                        ],
                        [
                            "LUBRICATION",
                            currentPoint.health.lubrication,
                        ],
                        [
                            "MECHANICAL",
                            currentPoint.health.mechanical,
                        ],
                    ].map(([label, value]) => (
                        <div
                            key={String(label)}
                            className="px-3 py-2"
                            style={{
                                border: "1px solid #292929",
                                background: "#090909",
                            }}
                        >
                            <div
                                className="text-[10px]"
                                style={{
                                    color: "#666",
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                }}
                            >
                                {label}
                            </div>

                            <div
                                className="text-sm font-bold"
                                style={{
                                    color: "#C6FF3D",
                                    fontFamily:
                                        "'JetBrains Mono', monospace",
                                }}
                            >
                                {Number(value).toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}