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
    // Simulink simulation clock (null for telemetry recorded before it existed)
    sim_time?: number | null;              // s since the run started
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
    anomaly_score: number;          // 1.0 = the detector's threshold
    is_anomaly: boolean;
    fault_id?: number | null;       // 0 healthy, 1-9 faults
    fault: string | null;           // null when healthy
    confidence: number;             // 0-1
    rul_seconds: number | null;     // time to failure; 600 = "10 min or more"
    rul_low?: number | null;
    rul_high?: number | null;
    top_features?: [string, number][];   // signals behind the fault call
    source?: string | null;         // e.g. "rules+health-trend" or a model name
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

// Maintenance advisory from the digital twin (backend/twin/advisory.py).
export interface AdvisoryData {
    level: "MONITOR" | "CAUTION" | "WARNING" | "CRITICAL";
    fault_family: string;
    title: string;
    eta_seconds: number | null;    // estimated time to failure (s)
    evidence: string[];
    do_now: string[];
    maintenance: string[];
}

export interface DashboardResponse {
    engine_id: string;
    mission_id: string;
    latest_telemetry: TelemetryData | null;
    health: SubsystemHealth | null;
    prediction: PredictionData;
    operating_state: "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL";
    advisory?: AdvisoryData | null;
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

// Mission-wise health report (GET /missions/{id}/report).
export interface MissionReport {
    mission_id: string;
    engine_id: string;
    profile: string | null;
    start_time: string;
    end_time: string;
    duration_s: number;
    samples: number;
    max_altitude_m: number;
    ambient_min_c: number;
    ambient_max_c: number;
    mean_throttle: number;
    efficiency_mean: number | null;
    efficiency_min: number | null;
    outcome: "NOMINAL" | "DEGRADED" | "FAILURE" | "NO HEALTH DATA";
    failure_at_s: number | null;
    final_health: number | null;
    min_health: number | null;
    min_health_at_s: number | null;
    weakest_subsystem: string | null;
    weakest_subsystem_health: number | null;
    weakest_subsystem_at_s: number | null;
    min_time_to_failure_s: number | null;
    faults: { fault: string; first_detected_at_s: number; seconds_detected: number }[];
    advisories: {
        at_s: number;
        level: string;
        title: string;
        eta_seconds: number | null;
        do_now: string[];
    }[];
    maintenance: string[];
}

// Expected healthy readings per mission sample (GET /missions/{id}/baseline).
export interface MissionBaseline {
    mission_id: string;
    signals: string[];                       // empty without a fitted baseline
    expected: Record<string, number>[];      // one per telemetry sample
    roughness_window: number;
    vibration_rms_limit: number;
    rpm_roughness_limit: number;
    cht_roughness_limit: number;
}

export interface WebSocketUpdateMessage {
    type: "engine_update";
    engine_id: string;
    mission_id: string;
    telemetry: TelemetryData;
    health: SubsystemHealth | null;
    prediction: PredictionData;
    operating_state: "NOMINAL" | "WARNING" | "DEGRADED" | "CRITICAL";
    advisory?: AdvisoryData | null;
}
