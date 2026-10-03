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
    torque?: number;
    power?: number;
    // Operating conditions
    throttle?: number | null;              // 0-1
    engine_load?: number | null;           // 0-1
    altitude?: number | null;              // m
    ambient_temperature?: number | null;   // °C
    // Electrical system (null for telemetry recorded before it existed)
    battery_voltage?: number | null;       // V
    alternator_current?: number | null;    // A
    // ECU injection parameters
    injection_timing?: number | null;      // degrees crank angle BTDC
    injection_duration?: number | null;    // ms per injection event
}

export interface SubsystemHealth {
    overall: number;
    thermal: number;
    combustion: number;
    lubrication: number;
    mechanical: number;
    // Rule-based battery/alternator and ECU injection health; included in
    // `overall` when present, null for telemetry without these signals.
    electrical?: number | null;
    injection?: number | null;
    // Instrumentation health (CHT sensor); not part of `overall`.
    sensor?: number | null;
}

export interface PredictionData {

    anomaly_score: number;

    is_anomaly: boolean;

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

    prediction: PredictionData | null;

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
