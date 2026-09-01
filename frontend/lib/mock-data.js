export const ENGINES_LIST = [
  { id: "ENG-001", name: "Rotax 914 iS Twin", health: 92, state: "CRUISE", status: "NOMINAL" },
  { id: "ENG-002", name: "Limbach L275E Twin", health: 78, state: "LOITER", status: "WARNING" },
  { id: "ENG-003", name: "Rotax 915 iS Twin", health: 96, state: "STANDBY", status: "NOMINAL" },
];

export const CURRENT_TELEMETRY = {
  timestamp: new Date().toISOString(),
  engine_id: "ENG-001",
  mission_id: "MISSION-042",
  rpm: 2450,
  cht: 175, // Cylinder Head Temp (°C)
  egt: 680, // Exhaust Gas Temp (°C)
  oil_pressure: 52, // PSI
  oil_temperature: 91, // °C
  fuel_flow: 21.4, // L/h
  vibration: 0.31, // g-force
  battery_voltage: 27.8, // V
  alternator_current: 18.2, // A
  injection_timing: 14.5, // deg BTDC
};

export const SUBSYSTEM_HEALTH = [
  { name: "Thermal", health: 88, status: "NOMINAL" },
  { name: "Combustion", health: 79, status: "WARNING" },
  { name: "Lubrication", health: 91, status: "NOMINAL" },
  { name: "Mechanical", health: 76, status: "WARNING" },
  { name: "Electrical", health: 96, status: "NOMINAL" },
];

export const ACTIVE_ADVISORIES = [
  {
    id: "ADV-104",
    type: "ADVISORY",
    title: "Combustion Anomaly Developing",
    confidence: 94,
    subsystem: "Combustion",
    rul_impact: "18.4 h",
    timestamp: "14:22:10 UTC",
    severity: "amber",
  },
];

export const HISTORICAL_TRENDS = Array.from({ length: 20 }, (_, i) => ({
  time: `${i * 2}m`,
  rpm: 2400 + Math.floor(Math.sin(i * 0.5) * 50) + Math.floor(Math.random() * 20),
  cht: 170 + Math.floor(i * 0.3) + Math.floor(Math.random() * 2),
  egt: 675 + Math.floor(i * 0.4) + Math.floor(Math.random() * 5),
}));