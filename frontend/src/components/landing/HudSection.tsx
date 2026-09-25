import { useEffect, useState } from "react";
import {
    AlertTriangle,
    RefreshCw,
    Wifi,
} from "lucide-react";

import {
    startSimulation,
    stopSimulation,
    getSimulationStatus,
    injectFault,
} from "../../services/api";

import { useEngineData } from "../../hooks/useEngineData";


function useClock(): Date {
    const [t, setT] = useState<Date>(new Date());
    useEffect(() => {
        const id = setInterval(() => setT(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return t;
}
const pad = (n: number): string => n.toString().padStart(2, "0");

function RadialHealth({ value }: { value: number }) {
    const r = 42;
    const c = 2 * Math.PI * r;
    const offset = c - (value / 100) * c;
    return (
        <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} stroke="#2a2a2a" strokeWidth="6" fill="none" />
            <circle
                cx="50" cy="50" r={r} stroke="#ffffff" strokeWidth="6" fill="none"
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(-90 50 50)"
            />
            <text x="50" y="47" textAnchor="middle" fontSize="20" fontWeight="600" fill="#fff" fontFamily="'Space Grotesk', sans-serif">
                {value}%
            </text>
            <text x="50" y="63" textAnchor="middle" fontSize="8" fill="#888" fontFamily="'JetBrains Mono', monospace">
                HEALTH
            </text>
        </svg>
    );
}

export default function HudSection({
    engineData,
}: {
    engineData: ReturnType<typeof useEngineData>;
}) {
    const time = useClock();
    const [simulationStatus, setSimulationStatus] = useState<
        "stopped" | "starting" | "running" | "stopping"
    >("stopped");

    useEffect(() => {
    const checkSimulationStatus = async () => {
        try {
            const result = await getSimulationStatus(
                engineData.selectedEngine
            );

            setSimulationStatus(
                result.status === "running"
                    ? "running"
                    : "stopped"
            );
        } catch {
            setSimulationStatus("stopped");
        }
    };

    checkSimulationStatus();
}, [engineData.selectedEngine]);

    const [isInjectingFault, setIsInjectingFault] = useState(false);
    const [controlStatus, setControlStatus] = useState<string | null>(null);

    const handleStartSimulation = async () => {
        setSimulationStatus("starting");
        setControlStatus(null);

        try {
            const result = await startSimulation(engineData.selectedEngine);
            engineData.setSimulationRunning(true);
            setSimulationStatus("running");
            setControlStatus(
                result.fault_id === 0
                    ? "SIMULATION STARTED — ENGINE HEALTHY"
                    : "SIMULATION STARTED"
            );
        } catch (err: any) {
            setSimulationStatus("stopped");
            setControlStatus(`START FAILED: ${err.message}`);
        }
    };

    const handleStopSimulation = async () => {
        setSimulationStatus("stopping");
        setControlStatus(null);

        try {
            await stopSimulation(engineData.selectedEngine);

            engineData.resetTelemetry();

            setSimulationStatus("stopped");
            setControlStatus("SIMULATION STOPPED");
        } catch (err: any) {
            setSimulationStatus("running");
            setControlStatus(`STOP FAILED: ${err.message}`);
        }
    };

    const handleInjectFault = async (faultId: number) => {
        setIsInjectingFault(true);
        setControlStatus(null);

        try {
            await injectFault(
                engineData.selectedEngine,
                faultId
            );

            const label =
                faultId === 0
                    ? "HEALTHY"
                    : `FAULT ${faultId}`;

            setControlStatus(`FAULT COMMAND SENT — ${label}`);
        } catch (err: any) {
            setControlStatus(`FAULT FAILED: ${err.message}`);
        } finally {
            setIsInjectingFault(false);
        }
    };

    const subsystems = [
        { name: "THERMAL", score: engineData.health.thermal, status: engineData.health.thermal < 80 ? "warn" : "ok" },
        { name: "COMBUSTION", score: engineData.health.combustion, status: engineData.health.combustion < 80 ? "warn" : "ok" },
        { name: "LUBRICATION", score: engineData.health.lubrication, status: engineData.health.lubrication < 80 ? "warn" : "ok" },
        { name: "MECHANICAL", score: engineData.health.mechanical, status: engineData.health.mechanical < 80 ? "warn" : "ok" },
    ];

    const statusColor: Record<string, string> = { ok: "#7fe0a0", warn: "#e8c34a", critical: "#e8543f" };

    return (
        <section style={{ background: "#0b0b0b", color: "#d8d8d8", fontFamily: "'Space Grotesk', sans-serif" }} className="relative overflow-hidden">
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.5]"
                style={{ backgroundImage: "linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)", backgroundSize: "100% 64px" }}
            />

            <div className="relative z-10 px-6 md:px-10 py-16 md:py-20">
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div>
                        <h2 className="mt-2 font-bold" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "#fff" }}>
                            TEST AND FAULT CONTROL
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-sm" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded" style={{ border: "1px solid #555", background: "#151515" }}>
                            <span style={{ color: "#ccc" }}>ENGINE:</span>
                            <select
                                value={engineData.selectedEngine}
                                onChange={(e) => engineData.setSelectedEngine(e.target.value)}
                                style={{ background: "transparent", color: "#fff", border: "none", outline: "none", cursor: "pointer" }}
                            >
                                {engineData.engines.map((eng) => (
                                    <option key={eng} value={eng} style={{ background: "#111", color: "#fff" }}>
                                        {eng}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => engineData.refreshDashboard()}
                            className="px-3 py-2 rounded hover:bg-white/10 transition"
                            title="Refresh live telemetry"
                            style={{ border: "1px solid #555", color: "#ddd" }}
                        >
                            <RefreshCw size={15} />
                        </button>

                        <span
                            className="flex items-center gap-1.5 px-3 py-2 rounded font-semibold"
                            style={{
                                border: engineData.isConnected ? "1px solid #22c55e" : "1px solid #eab308",
                                background: engineData.isConnected ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                                color: engineData.isConnected ? "#22c55e" : "#eab308",
                            }}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: engineData.isConnected ? "#22c55e" : "#eab308" }} />
                            {engineData.isConnected ? "WS LIVE" : "POLLING"}
                        </span>

                       
                    </div>
                </div>

                <div
                    className="mb-6 p-5"
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
                        <span className="text-base font-bold" style={{ color: "#fff" }}>
                            SIMULATION CONTROL
                        </span>

                        <span
                            className="text-sm font-semibold"
                            style={{
                                color:
                                    simulationStatus === "running"
                                        ? "#7fe0a0"
                                        : simulationStatus === "starting" ||
                                        simulationStatus === "stopping"
                                        ? "#e8c34a"
                                        : "#bbb",
                            }}
                        >
                            ● {simulationStatus.toUpperCase()}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={handleStartSimulation}
                            disabled={
                                simulationStatus === "running" ||
                                simulationStatus === "starting"
                            }
                            className="px-6 py-3 text-sm font-bold transition"
                            style={{
                                background:
                                    simulationStatus === "running"
                                        ? "#222"
                                        : "#C6FF3D",
                                color:
                                    simulationStatus === "running"
                                        ? "#555"
                                        : "#050505",
                                cursor:
                                    simulationStatus === "running"
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                        >
                            {simulationStatus === "starting"
                                ? "STARTING..."
                                : "START SIMULATION"}
                        </button>

                        <button
                            onClick={handleStopSimulation}
                            disabled={
                                simulationStatus === "stopped" ||
                                simulationStatus === "stopping"
                            }
                            className="px-6 py-3 text-sm font-bold transition"
                            style={{
                                border: "1px solid #666",
                                background: "#151515",
                                color: "#fff",
                                cursor:
                                    simulationStatus === "stopped"
                                        ? "not-allowed"
                                        : "pointer",
                            }}
                        >
                            {simulationStatus === "stopping"
                                ? "STOPPING..."
                                : "STOP SIMULATION"}
                        </button>
                    </div>

                    {controlStatus && (
                        <div
                            className="mt-4 text-sm font-semibold"
                            style={{
                                color: "#7fd4ff",
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        >
                            {controlStatus}
                        </div>
                    )}
                </div>

                <div
                    className="mb-6 p-5"
                    style={{ border: "1px solid #5a1a1a", background: "#0e0808" }}
                >
                    <div
                        className="flex items-center justify-between mb-4"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                        <span className="text-sm font-bold flex items-center gap-2" style={{ color: "#e8543f" }}>
                            <AlertTriangle size={14} />
                            FAULT INJECTION
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* Clear / Healthy */}
                        <button
                            onClick={() => handleInjectFault(0)}
                            disabled={isInjectingFault || simulationStatus !== "running"}
                            className="px-4 py-2.5 text-sm font-bold transition hover:brightness-110"
                            title="Inject fault_id=0 — clears any active fault, sets engine to healthy"
                            style={{
                                border: "1.5px solid #358452",
                                background: "rgba(34,197,94,0.22)",
                                color: "#ffffff",
                                cursor: isInjectingFault || simulationStatus !== "running" ? "not-allowed" : "pointer",
                                fontFamily: "'JetBrains Mono', monospace",
                                letterSpacing: "0.02em",
                            }}
                        >
                             HEALTHY
                        </button>

                        {/* Fault buttons */}
                        {[
                            { id: 1, label: "MISFIRE",          desc: "Reduced combustion performance" },
                            { id: 2, label: "OVERHEATING",       desc: "Elevated CHT, EGT and oil temperature" },
                            { id: 3, label: "OIL PRESSURE",      desc: "Progressive lubrication pressure loss" },
                            { id: 4, label: "FUEL STARVATION",   desc: "Reduced fuel supply causing engine power loss" },
                        ].map(({ id, label, desc }) => (
                            <button
                                key={id}
                                onClick={() => handleInjectFault(id)}
                                disabled={isInjectingFault || simulationStatus !== "running"}
                                title={desc}
                                className="px-4 py-2.5 text-sm font-bold transition hover:brightness-110"
                                style={{
                                    border: "1.5px solid #e8543f",
                                    background: "rgba(168, 59, 44, 0.22)",
                                    color: "#ffffff",
                                    cursor:
                                        isInjectingFault || simulationStatus !== "running"
                                            ? "not-allowed"
                                            : "pointer",
                                    fontFamily: "'JetBrains Mono', monospace",
                                    letterSpacing: "0.02em",
                                }}
                            >
                                {isInjectingFault ? "INJECTING…" : label}
                            </button>
                        ))}
                    </div>

                </div>


                {engineData.isWarmup && (
                    <div className="mb-6 px-4 py-2 text-xs rounded" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid #eab308", color: "#eab308", fontFamily: "'JetBrains Mono', monospace" }}>
                        WARM-UP IN PROGRESS: Health &amp; prediction models calibrating until 60 samples accumulate.
                    </div>
                )}

                <div className="grid md:grid-cols-5 gap-8">
                    <div className="md:col-span-2 flex flex-col gap-6">
                        <div style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }}>
                            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #3a3a3a", fontFamily: "'JetBrains Mono', monospace" }}>
                                <span className="text-base font-bold" style={{ color: "#fff" }}>UNIT &mdash; {engineData.selectedEngine}</span>
                                <span className="text-sm font-semibold" style={{ color: statusColor[engineData.operatingState === "NOMINAL" ? "ok" : "warn"] }}>
                                    {engineData.operatingState}
                                </span>
                            </div>

                            <div className="p-5 flex gap-4 items-center">
                                <RadialHealth value={Math.round(engineData.health.overall)} />
                                <div className="flex-1">
                                    <div className="font-bold text-base tracking-tight" style={{ color: "#fff" }}>
                                        {engineData.health.overall > 90 ? "NOMINAL" : engineData.health.overall > 75 ? "GOOD" : "DEGRADED"}
                                    </div>
                                    <div className="text-sm mt-2" style={{ color: "#c0c0c0", fontFamily: "'JetBrains Mono', monospace" }}>
                                        FAULT: <span style={{ color: "#fff" }}>{engineData.prediction.fault ?? "NONE DETECTED"}</span>
                                    </div>
                                    <div className="text-xs mt-2" style={{ color: "#888", fontFamily: "'JetBrains Mono', monospace" }}>
                                        ANOMALY SCORE {engineData.prediction.anomaly_score.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 pb-4 grid grid-cols-2 gap-y-2 text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#c0c0c0" }}>
                                <span>EST. RUL</span>
                                <span style={{ color: "#fff", fontWeight: 700 }}>
                                    {engineData.prediction.rul_hours !== null ? `${engineData.prediction.rul_hours} hrs` : "N/A"}
                                </span>
                            </div>

                            <div className="px-4 py-3 text-sm flex justify-between" style={{ borderTop: "1px solid #3a3a3a", fontFamily: "'JetBrains Mono', monospace", color: "#c0c0c0" }}>
                                <span>LAST UPDATED</span>
                                <span style={{ color: "#fff" }}>{pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}</span>
                            </div>
                        </div>

                        <div style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }} className="p-4">
                            <div className="mb-3 flex items-center justify-between" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                <span className="text-base font-bold" style={{ color: "#fff" }}>SUBSYSTEM HEALTH SCORES</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {subsystems.map((sub, idx) => (
                                    <div key={idx} className="text-sm">
                                        <div className="flex justify-between items-center mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                            <span style={{ color: "#e0e0e0", fontWeight: 600 }}>{sub.name}</span>
                                            <span style={{ color: sub.status === "warn" ? "#e8c34a" : "#fff", fontWeight: 700 }}>{sub.score}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full" style={{ background: "#333" }}>
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${sub.score}%`,
                                                    background: sub.status === "warn" ? "#e8c34a" : "#7fe0a0",
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-3 flex flex-col gap-6">
                        

                        <div style={{ border: "1px solid #3a3a3a", background: "#0e0e0e" }} className="p-4">
                            <div className="flex items-center justify-between mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                <span className="text-base font-bold" style={{ color: "#fff" }}>ACTIVE ALERTS</span>
                                <span className="text-sm font-semibold" style={{ color: "#e8c34a" }}>{engineData.alerts.length} DETECTED</span>
                            </div>
                            <div
                                className="flex flex-col gap-2 overflow-y-auto"
                                style={{
                                    maxHeight: "468px",
                                    scrollbarWidth: "thin",
                                }}
                            >
                                {engineData.alerts.map((al, idx) => {
                                    const isEngine = al.source === "operating_state";
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-start justify-between gap-3 p-3 rounded"
                                            style={{
                                                border: isEngine ? "1px solid rgba(232,84,63,0.4)" : "1px solid rgba(127,212,255,0.4)",
                                                background: isEngine ? "rgba(232,84,63,0.08)" : "rgba(127,212,255,0.08)",
                                            }}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                {isEngine ? (
                                                    <AlertTriangle size={16} className="shrink-0 mt-0.5" color="#e8543f" />
                                                ) : (
                                                    <Wifi size={16} className="shrink-0 mt-0.5" color="#7fd4ff" />
                                                )}
                                                <div>
                                                    <div className="font-bold text-sm" style={{ color: isEngine ? "#fff" : "#7fd4ff" }}>
                                                        {al.message}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#b0b0b0" }}>
                                                {al.timestamp}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className="relative z-10 px-6 md:px-10 py-6 flex items-center justify-center text-sm"
                style={{
                    borderTop: "1px solid #3a3a3a",
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "#c0c0c0"
                }}
            >
                <span>SKOPEO • TEAM RAMBHAROSE</span>
            </div>
        </section>
    );
}
