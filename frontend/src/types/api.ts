export interface EngineItem {
    engine_id: string;
}

export interface MissionItem {
    mission_id: string;
}

export interface MissionSummary {
    mission_id: string;
    engine_id: string;
    start_time: string;
    end_time: string;
    sample_count: number;
}

export interface TelemetryData {
    timestamp: string;
    engine_id: string;
    mission_id: string;
    rpm: number;
    cht: number;
    egt: number;
    oil_pressure: number;
    oil_temperature: number;
    fuel_flow: number;
    vibration: number;
    battery_voltage?: number;
    alternator_current?: number;
    injection_timing?: number;
    torque?: number;
    power?: number;
    altitude?: number;
    ambient_temp?: number;
    throttle?: number;
    engine_load?: number;
}

export interface SubsystemHealth {
    overall: number;
    thermal: number;
    combustion: number;
    lubrication: number;
    mechanical: number;
    electrical: number;
}

export interface PredictionData {
    anomaly_score: number;
    fault: string | null;
    confidence: number;
    rul_hours: number | null;
}

export interface EngineHealthResponse {
    engine_id: string;
    mission_id: string;
    operating_state: "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL";
    health: SubsystemHealth | null;
    prediction: PredictionData;
}

export interface HealthHistoryPoint {
    timestamp: string;
    health: SubsystemHealth;
}

export interface HealthHistoryResponse {
    engine_id: string;
    mission_id: string;
    history: HealthHistoryPoint[];
}

export interface AlertData {
    engine_id: string;
    mission_id: string;
    severity: "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL";
    message: string;
    source: "operating_state" | "ingestion_event";
    timestamp: string;
}

export interface DashboardResponse {
    engine_id: string;
    mission_id: string;
    latest_telemetry: TelemetryData | null;
    health: SubsystemHealth | null;
    prediction: PredictionData;
    operating_state: "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL";
    alerts: AlertData[];
    recent_health_history: HealthHistoryPoint[];
}

export interface ReplayPoint {
    timestamp: string;
    telemetry: TelemetryData;
    health: SubsystemHealth | null;
}

export interface MissionReplayResponse {
    mission_id: string;
    engine_id: string;
    points: ReplayPoint[];
}

export interface WebSocketUpdateMessage {
    type: "engine_update";
    engine_id: string;
    mission_id: string;
    telemetry: TelemetryData;
    health: SubsystemHealth | null;
    prediction: PredictionData;
    operating_state: "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL";
}
