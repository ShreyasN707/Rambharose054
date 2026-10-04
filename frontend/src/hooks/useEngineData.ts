import { useState, useEffect, useRef, useCallback } from "react";
import type {
    TelemetryData,
    SubsystemHealth,
    PredictionData,
    AlertData,
    AdvisoryData,
    HealthHistoryPoint,
    WebSocketUpdateMessage,
} from "../types/api";
import {
    getMissions,
    getDashboard,
    getEngineWebSocketUrl,
} from "../services/api";
import { efficiencyIndex } from "../efficiency";

// Live efficiency: the WebSocket delivers every POLL_INTERVAL (2 s) sample,
// so 30 samples span about 60 s, like the analysis chart's window.
const EFFICIENCY_BUFFER = 30;

// Shown until the first real health data arrives (hasData is false
// meanwhile, and the dashboard renders "NO DATA" / "--").
const DEFAULT_HEALTH: SubsystemHealth = {
    overall: 0,
    thermal: 0,
    combustion: 0,
    lubrication: 0,
    mechanical: 0,
    electrical: null,
    injection: null,
    sensor: null,
};

const DEFAULT_PREDICTION: PredictionData = {
    anomaly_score: 0,
    is_anomaly: false,
    fault: null,
    confidence: 0,
    rul_seconds: null,
};


const ZERO_TELEMETRY: TelemetryData = {
    timestamp: new Date().toISOString(),
    engine_id: "ENG-TEST",
    mission_id: "MISSION-1",
    rpm: 0,
    cht: 0,
    egt: 0,
    oil_pressure: 0,
    oil_temperature: 0,
    fuel_flow: 0,
    vibration: 0,
    torque: 0,
    power: 0,
    altitude: 0,
    ambient_temperature: 0,
    throttle: 0,
    engine_load: 0,
    // Unknown until the simulator reports them (rendered as "--").
    battery_voltage: null,
    alternator_current: null,
    injection_timing: null,
    injection_duration: null,
    sim_time: null,
};

export function useEngineData() {
    const [missions, setMissions] = useState<string[]>(["MISSION-1"]);

    // The simulator publishes a single engine.
    const selectedEngine = "engine_001";

    const [selectedMission, setSelectedMission] =
        useState<string>("mission_001");

    const simulationRunningRef = useRef(false);

    const [telemetry, setTelemetry] =
        useState<TelemetryData>(ZERO_TELEMETRY);

    const [health, setHealth] =
        useState<SubsystemHealth>(DEFAULT_HEALTH);

    const [prediction, setPrediction] =
        useState<PredictionData>(DEFAULT_PREDICTION);

    const [operatingState, setOperatingState] =
        useState<
            "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL"
        >("NOMINAL");

    const [advisory, setAdvisory] =
        useState<AdvisoryData | null>(null);

    const [alerts, setAlerts] =
        useState<AlertData[]>([]);

    const [healthHistory, setHealthHistory] =
        useState<HealthHistoryPoint[]>([]);

    // Recent telemetry for the live efficiency index.
    const efficiencyBufferRef = useRef<TelemetryData[]>([]);
    const [efficiency, setEfficiency] =
        useState<number | null>(null);

    // True once real health data has arrived for the current mission.
    const [hasData, setHasData] =
        useState<boolean>(false);

    const [isWarmup, setIsWarmup] =
        useState<boolean>(false);

    const [simulationRunning, setSimulationRunning] =
        useState(false);

    const wsRef = useRef<WebSocket | null>(null);

    const setSimulationRunningState = useCallback(
        (running: boolean) => {
            simulationRunningRef.current = running;
            setSimulationRunning(running);
        },
        []
    );

    /*
     * Reset telemetry and simulation state when the
     * simulation is stopped.
     *
     * Important:
     * Keep the ref and React state synchronized.
     */
    const resetTelemetry = useCallback(() => {
        simulationRunningRef.current = false;
        setSimulationRunning(false);

        setTelemetry({
            ...ZERO_TELEMETRY,
            timestamp: new Date().toISOString(),
            engine_id: selectedEngine,
            mission_id: selectedMission,
        });
        setAdvisory(null);
        setHasData(false);
        efficiencyBufferRef.current = [];
        setEfficiency(null);
    }, [selectedEngine, selectedMission]);

    /*
     * Fetch available missions.
     */
    useEffect(() => {
        let mounted = true;

        async function fetchLists() {
            try {
                const [missRes] = await Promise.allSettled([
                    getMissions(),
                ]);

                if (!mounted) return;

                if (
                    missRes.status === "fulfilled" &&
                    missRes.value.missions?.length > 0
                ) {
                    const ids =
                        missRes.value.missions.map(
                            (m) => m.mission_id
                        );

                    setMissions(ids);

                    if (!ids.includes(selectedMission)) {
                        setSelectedMission(ids[0]);
                    }
                }
            } catch {
                // Keep fallback values.
            }
        }

        fetchLists();

        return () => {
            mounted = false;
        };
    }, []);

    /*
     * Fetch the initial dashboard state.
     *
     * This intentionally depends only on engine + mission.
     * Starting/stopping the simulator should not cause this
     * effect to repeatedly recreate/refetch the dashboard.
     */
    const fetchInitialDashboard = useCallback(async () => {
        try {
            const data = await getDashboard(
                selectedEngine,
                selectedMission
            );

            if (data.health) {
                setHealth(data.health);
                setHasData(true);
                setIsWarmup(false);
            } else {
                // New mission without health yet: don't keep showing
                // the previous mission's values.
                setHealth(DEFAULT_HEALTH);
                setHasData(false);
                setIsWarmup(true);
            }

            if (data.prediction) {
                setPrediction(data.prediction);
            }

            if (data.operating_state) {
                setOperatingState(data.operating_state);
            }

            setAdvisory(data.advisory ?? null);

            if (Array.isArray(data.alerts)) {
                setAlerts(data.alerts);
            }

            if (
                Array.isArray(
                    data.recent_health_history
                ) &&
                data.recent_health_history.length > 0
            ) {
                setHealthHistory(
                    data.recent_health_history
                );
            }
        } catch {
            // WebSocket can still provide live data.
        }
    }, [selectedEngine, selectedMission]);

    useEffect(() => {
        fetchInitialDashboard();
    }, [fetchInitialDashboard]);

    /*
     * WebSocket connection.
     */
    useEffect(() => {
        if (!selectedEngine) return;

        const wsUrl = getEngineWebSocketUrl(
            selectedEngine,
            selectedMission
        );

        let socket: WebSocket;

        try {
            socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            socket.onmessage = (event) => {
                console.log(
                    "[WS RECEIVED]",
                    event.data
                );

                try {
                    const data: WebSocketUpdateMessage =
                        JSON.parse(event.data);

                    if (data.type === "engine_update") {
                        /*
                         * Only update telemetry while the
                         * simulation is running.
                         */
                        if (
                            data.telemetry
                        ) {
                            setTelemetry((prev) => ({
                                ...prev,
                                ...data.telemetry,
                            }));

                            const buffer = efficiencyBufferRef.current;
                            if (
                                buffer.length === 0 ||
                                buffer[buffer.length - 1].timestamp !== data.telemetry.timestamp
                            ) {
                                buffer.push(data.telemetry);
                                if (buffer.length > EFFICIENCY_BUFFER) buffer.shift();
                                setEfficiency(
                                    buffer.length >= EFFICIENCY_BUFFER / 2
                                        ? efficiencyIndex(buffer)
                                        : null
                                );
                            }
                        }

                        /*
                         * Health is updated directly from
                         * the backend WebSocket.
                         */
                        if (data.health) {
                            setHealth(data.health);
                            setHasData(true);
                            setIsWarmup(false);
                        }

                        if (data.prediction) {
                            setPrediction(
                                data.prediction
                            );
                        }

                        if (data.operating_state) {
                            setOperatingState(
                                data.operating_state
                            );
                        }

                        // null when the engine is nominal, so a
                        // cleared advisory disappears.
                        setAdvisory(data.advisory ?? null);
                    }
                } catch (error) {
                    console.error(
                        "[WS ERROR]",
                        error
                    );
                }
            };

        } catch {
            // No live updates; the initial dashboard fetch still shows data.
        }

        return () => {
            if (socket) {
                socket.close();
            }

            if (wsRef.current === socket) {
                wsRef.current = null;
            }
        };
    }, [selectedEngine, selectedMission]);

    return {
        missions,

        selectedEngine,
        selectedMission,

        setSelectedMission,

        telemetry,
        resetTelemetry,

        simulationRunning,
        setSimulationRunning:
            setSimulationRunningState,

        health,
        prediction,
        operatingState,
        advisory,
        hasData,
        efficiency,
        alerts,
        healthHistory,

        isWarmup,
    };
}