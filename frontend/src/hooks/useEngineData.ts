import { useState, useEffect, useRef, useCallback } from "react";
import type {
    TelemetryData,
    SubsystemHealth,
    PredictionData,
    AlertData,
    HealthHistoryPoint,
    WebSocketUpdateMessage,
} from "../types/api";
import {
    getEngines,
    getMissions,
    getDashboard,
    getEngineWebSocketUrl,
} from "../services/api";

const DEFAULT_HEALTH: SubsystemHealth = {
    overall: 82.0,
    thermal: 97.5,
    combustion: 76.2,
    lubrication: 94.8,
    mechanical: 88.0,
    electrical: 99.4,
};

const DEFAULT_PREDICTION: PredictionData = {
    anomaly_score: 0.28,
    fault: "Misfire detected",
    confidence: 94,
    rul_hours: 18.4,
};

const DEFAULT_ALERTS: AlertData[] = [
    {
        engine_id: "ENG-TEST",
        mission_id: "MISSION-1",
        severity: "DEGRADED",
        message: "Combustion efficiency dropped below 80%",
        source: "operating_state",
        timestamp: "03:25:00Z",
    },
    {
        engine_id: "ENG-TEST",
        mission_id: "MISSION-1",
        severity: "WARNING",
        message: "Ingestion event: TELEMETRY_GAP (2 dropped packets)",
        source: "ingestion_event",
        timestamp: "03:26:00Z",
    },
];

export function useEngineData() {
    const [engines, setEngines] = useState<string[]>(["ENG-TEST"]);
    const [missions, setMissions] = useState<string[]>(["MISSION-1"]);
    const [selectedEngine, setSelectedEngine] = useState<string>("ENG-TEST");
    const [selectedMission, setSelectedMission] = useState<string>("MISSION-1");

    const [telemetry, setTelemetry] = useState<TelemetryData>({
        timestamp: new Date().toISOString(),
        engine_id: "ENG-TEST",
        mission_id: "MISSION-1",
        rpm: 2340,
        cht: 218,
        egt: 812,
        oil_pressure: 54,
        oil_temperature: 97,
        fuel_flow: 11.2,
        vibration: 4.8,
        battery_voltage: 24.6,
        alternator_current: 38,
        injection_timing: 18.5,
        torque: 12.4,
        power: 0.18,
        altitude: 150,
        ambient_temp: 28.0,
        throttle: 5,
        engine_load: 8,
    });

    const [health, setHealth] = useState<SubsystemHealth>(DEFAULT_HEALTH);
    const [prediction, setPrediction] = useState<PredictionData>(DEFAULT_PREDICTION);
    const [operatingState, setOperatingState] = useState<"NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL">("WARNING");
    const [alerts, setAlerts] = useState<AlertData[]>(DEFAULT_ALERTS);
    const [healthHistory, setHealthHistory] = useState<HealthHistoryPoint[]>([
        { timestamp: "03:20:00Z", health: { ...DEFAULT_HEALTH, overall: 99.1 } },
        { timestamp: "03:21:00Z", health: { ...DEFAULT_HEALTH, overall: 96.5 } },
        { timestamp: "03:22:00Z", health: { ...DEFAULT_HEALTH, overall: 91.0 } },
        { timestamp: "03:23:00Z", health: { ...DEFAULT_HEALTH, overall: 86.1 } },
        { timestamp: "03:24:00Z", health: { ...DEFAULT_HEALTH, overall: 83.9 } },
        { timestamp: "03:25:00Z", health: { ...DEFAULT_HEALTH, overall: 82.0 } },
    ]);

    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isWarmup, setIsWarmup] = useState<boolean>(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let mounted = true;
        async function fetchLists() {
            try {
                const [engRes, missRes] = await Promise.allSettled([
                    getEngines(),
                    getMissions(),
                ]);
                if (!mounted) return;
                if (engRes.status === "fulfilled" && engRes.value.engines?.length > 0) {
                    const ids = engRes.value.engines.map(e => e.engine_id);
                    setEngines(ids);
                    if (!ids.includes(selectedEngine)) setSelectedEngine(ids[0]);
                }
                if (missRes.status === "fulfilled" && missRes.value.missions?.length > 0) {
                    const ids = missRes.value.missions.map(m => m.mission_id);
                    setMissions(ids);
                    if (!ids.includes(selectedMission)) setSelectedMission(ids[0]);
                }
            } catch {}
        }
        fetchLists();
        return () => { mounted = false; };
    }, []);

    const fetchInitialDashboard = useCallback(async () => {
        try {
            const data = await getDashboard(selectedEngine, selectedMission);
            if (data.latest_telemetry) {
                setTelemetry(prev => ({
                    ...prev,
                    ...data.latest_telemetry,
                }));
            }
            if (data.health) {
                setHealth(data.health);
                setIsWarmup(false);
            } else {
                setIsWarmup(true);
            }
            if (data.prediction) {
                setPrediction(data.prediction);
            }
            if (data.operating_state) {
                setOperatingState(data.operating_state);
            }
            if (Array.isArray(data.alerts)) {
                setAlerts(data.alerts);
            }
            if (Array.isArray(data.recent_health_history) && data.recent_health_history.length > 0) {
                setHealthHistory(data.recent_health_history);
            }
        } catch {}
    }, [selectedEngine, selectedMission]);

    useEffect(() => {
        fetchInitialDashboard();
    }, [fetchInitialDashboard]);

    useEffect(() => {
        if (!selectedEngine) return;
        const wsUrl = getEngineWebSocketUrl(selectedEngine, selectedMission);
        let socket: WebSocket;
        try {
            socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            socket.onopen = () => {
                setIsConnected(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data: WebSocketUpdateMessage = JSON.parse(event.data);
                    if (data.type === "engine_update") {
                        if (data.telemetry) {
                            setTelemetry(prev => ({ ...prev, ...data.telemetry }));
                        }
                        if (data.health) {
                            setHealth(data.health);
                            setIsWarmup(false);
                        } else {
                            setIsWarmup(true);
                        }
                        if (data.prediction) {
                            setPrediction(data.prediction);
                        }
                        if (data.operating_state) {
                            setOperatingState(data.operating_state);
                        }
                    }
                } catch {}
            };

            socket.onerror = () => {
                setIsConnected(false);
            };

            socket.onclose = () => {
                setIsConnected(false);
            };
        } catch {
            setIsConnected(false);
        }

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [selectedEngine, selectedMission]);

    return {
        engines,
        missions,
        selectedEngine,
        selectedMission,
        setSelectedEngine,
        setSelectedMission,
        telemetry,
        health,
        prediction,
        operatingState,
        alerts,
        healthHistory,
        isConnected,
        isWarmup,
        refreshDashboard: fetchInitialDashboard,
    };
}
