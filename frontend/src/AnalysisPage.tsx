import { useEffect, useState } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import EnginePerformanceChart from "./components/analysis/EnginePerformanceChart";
import ThermalChart from "./components/analysis/ThermalChart";
import LubricationChart from "./components/analysis/LubricationChart";
import {
    getMissions,
    getMission,
    getMissionTelemetry,
    getMissionReplay,
} from "./services/api";
import type {
    MissionItem,
    MissionSummary,
    TelemetryData,
    MissionReplayResponse,
} from "./types/api";
import TelemetryChart from "./components/analysis/TelemetryChart";
import { getEngineHealthHistory } from "./services/api";
import type { HealthHistoryPoint } from "./types/api";
import HealthTrendChart from "./components/analysis/HealthTrendChart";
import MissionReplay from "./components/analysis/MissionReplay";''
export default function AnalysisPage() {
    const [replayIndex, setReplayIndex] = useState(0);
    const [healthHistory, setHealthHistory] = useState<HealthHistoryPoint[]>([]);
    const [missions, setMissions] = useState<MissionItem[]>([]);
    const [selectedMission, setSelectedMission] = useState("");
    const [mission, setMission] = useState<MissionSummary | null>(null);
    const [telemetry, setTelemetry] = useState<TelemetryData[]>([]);
    const [replay, setReplay] = useState<MissionReplayResponse | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadMissions() {
            try {
                setLoading(true);
                setError(null);

                const result = await getMissions();

                setMissions(result.missions);

                if (result.missions.length > 0) {
                    setSelectedMission(result.missions[0].mission_id);
                }
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load missions"
                );
            } finally {
                setLoading(false);
            }
        }

        loadMissions();
    }, []);

    useEffect(() => {
        if (!selectedMission) return;

        async function loadMissionData() {
            try {
                setLoading(true);
                setError(null);

                const missionData = await getMission(selectedMission);

                const [
                    telemetryData,
                    replayData,
                    healthHistoryData,
                ] = await Promise.all([
                    getMissionTelemetry(selectedMission),
                    getMissionReplay(selectedMission),
                    getEngineHealthHistory(
                        missionData.engine_id,
                        selectedMission
                    ),
                ]);

                setMission(missionData);
                setTelemetry(telemetryData);
                setReplay(replayData);
                setReplayIndex(0);
                setHealthHistory(healthHistoryData.history);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load mission data"
                );
            } finally {
                setLoading(false);
            }
        }

        loadMissionData();
    }, [selectedMission]);

    if (loading && !mission) {
        return (
            <div
                className="min-h-screen flex items-center justify-center"
                style={{
                    background: "#050505",
                    color: "#C6FF3D",
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >
                LOADING MISSION DATA...
            </div>
        );
    }

    return (
        <div
            className="min-h-screen"
            style={{
                background: "#050505",
                color: "#e8e8e8",
                fontFamily: "'Space Grotesk', sans-serif",
            }}
        >
            {/* Header */}
            <header
                className="flex items-center justify-between px-6 md:px-10 py-5"
                style={{
                    borderBottom: "1px solid #3a3a3a",
                    background: "#080808",
                }}
            >
                <div className="flex items-center gap-3">
                    <span
                        className="w-3 h-3 inline-block"
                        style={{ background: "#C6FF3D" }}
                    />

                    <span
                        className="font-bold text-xl"
                        style={{ color: "#fff" }}
                    >
                        SKOPEO
                    </span>

                    <span style={{ color: "#555" }}>/</span>

                    <span
                        className="text-sm"
                        style={{
                            color: "#C6FF3D",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        MISSION_ANALYSIS
                    </span>
                </div>

                <a
                    href="/"
                    className="flex items-center gap-2 px-3 py-2 text-sm transition hover:bg-white/10"
                    style={{
                        border: "1px solid #444",
                        color: "#ccc",
                        fontFamily: "'JetBrains Mono', monospace",
                    }}
                >
                    <ArrowLeft size={14} />
                    LIVE TWIN
                </a>
            </header>

            <main className="px-6 md:px-10 py-8">
                {/* Page heading */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
                    <div>
                        <div
                            className="text-xs mb-2"
                            style={{
                                color: "#C6FF3D",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            HISTORICAL ENGINE DATA
                        </div>

                        <h1
                            className="font-bold"
                            style={{
                                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                                color: "#fff",
                                lineHeight: 1,
                            }}
                        >
                            MISSION ANALYSIS
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <span
                            className="text-sm"
                            style={{
                                color: "#888",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            MISSION
                        </span>

                        <select
                            value={selectedMission}
                            onChange={(e) =>
                                setSelectedMission(e.target.value)
                            }
                            className="px-4 py-2 outline-none"
                            style={{
                                background: "#111",
                                border: "1px solid #555",
                                color: "#fff",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            {missions.map((item) => (
                                <option
                                    key={item.mission_id}
                                    value={item.mission_id}
                                >
                                    {item.mission_id}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div
                        className="mb-6 p-4"
                        style={{
                            border: "1px solid #e8543f",
                            background: "rgba(232,84,63,0.08)",
                            color: "#e8543f",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Mission summary */}
                {mission && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div
                            className="p-4"
                            style={{
                                border: "1px solid #3a3a3a",
                                background: "#0e0e0e",
                            }}
                        >
                            <div
                                className="text-xs mb-2"
                                style={{
                                    color: "#777",
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                ENGINE
                            </div>

                            <div
                                className="text-lg font-bold"
                                style={{ color: "#fff" }}
                            >
                                {mission.engine_id}
                            </div>
                        </div>

                        <div
                            className="p-4"
                            style={{
                                border: "1px solid #3a3a3a",
                                background: "#0e0e0e",
                            }}
                        >
                            <div
                                className="text-xs mb-2"
                                style={{
                                    color: "#777",
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                SAMPLES
                            </div>

                            <div
                                className="text-lg font-bold"
                                style={{ color: "#fff" }}
                            >
                                {mission.sample_count.toLocaleString()}
                            </div>
                        </div>

                        <div
                            className="p-4"
                            style={{
                                border: "1px solid #3a3a3a",
                                background: "#0e0e0e",
                            }}
                        >
                            <div
                                className="text-xs mb-2"
                                style={{
                                    color: "#777",
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                TIME RANGE
                            </div>

                            <div
                                className="flex items-center gap-2 text-sm"
                                style={{
                                    color: "#fff",
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                <Clock3 size={14} />
                                {new Date(mission.start_time).toLocaleTimeString()}
                                {" — "}
                                {new Date(mission.end_time).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Temporary sections */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div
                                className="text-xs mb-1"
                                style={{
                                    color: "#C6FF3D",
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                TELEMETRY HISTORY
                            </div>

                            <h2
                                className="text-2xl font-bold"
                                style={{ color: "#fff" }}
                            >
                                HISTORICAL TELEMETRY
                            </h2>
                        </div>

                        <div
                            className="text-xs"
                            style={{
                                color: "#666",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            {telemetry.length.toLocaleString()} SAMPLES
                        </div>
                    </div>

                    <div className="grid xl:grid-cols-2 gap-5">
                        <ThermalChart
                            data={telemetry}
                            replayIndex={replayIndex}
                        />

                        <EnginePerformanceChart
                            data={telemetry}
                            replayIndex={replayIndex}
                        />

                        <div className="xl:col-span-2 xl:w-1/2 xl:justify-self-center">
                            <LubricationChart
                                data={telemetry}
                                replayIndex={replayIndex}
                            />
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <div className="mb-4">
                        <div
                            className="text-xs mb-1"
                            style={{
                                color: "#C6FF3D",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            ENGINE CONDITION HISTORY
                        </div>

                        <h2
                            className="text-2xl font-bold"
                            style={{ color: "#fff" }}
                        >
                            HEALTH TRENDS
                        </h2>
                    </div>
                    <HealthTrendChart
                        data={healthHistory}
                        replayIndex={replayIndex}
                    />
                </section>

                <section className="mb-8">
                    <MissionReplay
                        points={replay?.points ?? []}
                        currentIndex={replayIndex}
                        onIndexChange={setReplayIndex}
                    />
                </section>
            </main>
        </div>
    );
}