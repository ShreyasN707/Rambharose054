# Rambharose054 — Aero-Piston Engine Digital Twin

An AI-enabled, real-time digital twin of a single-cylinder aero-piston (drone) engine. A Simulink model simulates the engine and its sensors. The model streams telemetry over MQTT into a time-series database, where rule-based health indices and ML models (anomaly detection, fault classification, remaining useful life) assess the engine. A live dashboard shows the engine's state and lets you inject faults while the simulation runs.

## Architecture

```
┌──────────────────────┐   engine/{id}/telemetry    ┌─────────────┐
│ Simulink model       │ ─────────────────────────► │  Mosquitto  │
│ (MATLAB -batch)      │                            │  MQTT :1883 │
└──────────▲───────────┘                            └──────┬──────┘
           │ fault_state.txt                               │
┌──────────┴───────────┐   engine/{id}/fault               ▼
│ mqtt_fault_bridge.py │ ◄──────────────────  ┌────────────────────────┐
└──────────────────────┘                      │ telemetry service      │
┌──────────────────────┐                      │ validate → store →     │
│ simulation_controller│ ◄── start / stop ──┐ │ health indices + ML    │
│ (:9000)              │                    │ └───────────┬────────────┘
└──────────────────────┘                    │             ▼
                                            │ ┌────────────────────────┐
┌──────────────────────┐  REST + WebSocket  │ │ TimescaleDB :5432      │
│ React dashboard      │ ◄────────────────► │ └───────────▲────────────┘
│ (:5173)              │                ┌───┴─────────────┴──┐
└──────────────────────┘                │ FastAPI :8000      │
                                        └────────────────────┘
```

| Component | Location | Role |
|---|---|---|
| Engine model | `simulation/AeroPistonEngineSimulator.slx`, `engine_params.m` | Engine core, fuel, thermal, lubrication, vibration, electrical and injection models with sensor dynamics and 10 fault modes |
| Stream script | `simulation/simulink_mqtt_stream.m` | Steps the model and publishes one telemetry message per second; applies fault commands |
| Fault bridge | `simulation/mqtt_fault_bridge.py` | Relays fault commands from MQTT to the running simulation |
| Simulation controller | `simulation/simulation_controller.py` | Small HTTP service that starts/stops the MATLAB simulation |
| Telemetry service | `backend/telemetry/` | MQTT subscriber: validates, stores, and runs the digital twin analysis |
| Digital twin | `backend/twin/` | Subsystem health indices, autoencoder anomaly score, XGBoost fault classifier, GRU RUL estimate |
| API | `backend/api/` | REST endpoints and a live WebSocket feed |
| Dashboard | `frontend/` | Live overview, 3D engine view, fault injection, mission analysis and replay |
| Model training | `anomalyModel/`, `ai/RUL/`, `data/` | Training code and data for the ML models |

## Prerequisites

- Docker with Docker Compose
- MATLAB with Simulink (developed on R2026a), configured to use a Python environment (`pyenv`) that has `paho-mqtt` installed
- Python 3 on the host with `paho-mqtt`, `fastapi` and `uvicorn` (for the fault bridge and simulation controller)
- Node.js, only to run the frontend outside Docker

## Getting started

1. Create the environment file and set database credentials:

   ```bash
   cp .env.example .env
   ```

2. Start everything:

   ```bash
   ./start.sh
   ```

   This starts Mosquitto, TimescaleDB, the telemetry service, the API and the frontend in Docker, plus the fault bridge and simulation controller on the host. Database migrations run automatically when the backend containers start.

3. Open the dashboard at <http://localhost:5173> and start the simulation from there. You can also run it directly with `simulation/start_simulation.sh`.

| Service | URL |
|---|---|
| Dashboard | http://localhost:5173 |
| API (interactive docs at `/docs`) | http://localhost:8000 |
| Simulation controller | http://localhost:9000 |

> The full stack plus MATLAB needs a fair amount of memory. On machines with about 8 GB of RAM, run only one MATLAB instance.

## Telemetry

The simulator publishes to `engine/{engine_id}/telemetry` once per second. Each message carries:
- **Engine signals:** RPM, torque, fuel flow, cylinder head and exhaust gas temperatures, oil pressure and temperature, vibration.
- **Operating conditions:** throttle, load, altitude, ambient temperature.
- **Electrical:** bus voltage, alternator current.
- **Injection:** timing and pulse width.
- **Simulation clock:** time since the run started.

The field list, units, sensor models and an example payload are in [`docs/telemetry-schema.md`](docs/telemetry-schema.md).

## Fault modes

Faults are injected from the dashboard (or `POST /api/engines/{engine_id}/fault?fault_id=N`). Each fault grows from no effect at injection to full severity after 300 s.

| ID | Fault | What it does at full severity |
|---|---|---|
| 0 | Healthy | — |
| 1 | Misfire | Up to 35 % of combustion events miss: rough, lower RPM, lower EGT, vibration ×2 |
| 2 | Overheating | Cylinder heat input ×4: CHT, EGT and oil temperature rise |
| 3 | Oil pressure failure | Oil pressure drops to 20 %, oil temperature rises |
| 4 | Fuel starvation | Fuel flow drops to 20 %: RPM, temperatures, oil pressure and bus voltage fall |
| 5 | Injector abnormality | Injector delivers 70 % of the fuel the ECU commands |
| 6 | Cooling degradation | Cooling drops to 20 %: CHT creeps up, EGT unchanged |
| 7 | CHT sensor drift | Reported CHT reads +40 °C high and noisy; engine unaffected |
| 8 | Combustion instability | 30 % cycle-to-cycle torque variation: rough RPM |
| 9 | Abnormal vibration | Vibration ×4 (imbalance / bearing wear) |

## API overview

All REST routes are under `/api`.

| Endpoint | Purpose |
|---|---|
| `GET /engines`, `GET /engines/{id}` | Engines and their summary |
| `GET /engines/{id}/telemetry/latest` | Latest telemetry sample |
| `GET /engines/{id}/health`, `/health/history`, `/alerts` | Digital twin health state, history and alerts |
| `POST /engines/{id}/fault` | Inject a fault |
| `POST /engines/{id}/simulation/start`, `/stop`, `GET /simulation/status` | Control the simulation |
| `GET /dashboard/{id}` | Everything the dashboard needs in one call |
| `GET /missions`, `/missions/{id}/telemetry`, `/missions/{id}/replay` | Mission history and replay |
| `WS /ws/engines/{id}?mission_id=…` | Live telemetry and health stream |

## Development

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build

# Database migrations (run automatically on container start)
docker exec telemetry alembic upgrade head
```

In MATLAB, from `simulation/`:

```matlab
engine_params;                                            % load model parameters
r = run_telemetry_scenarios('AeroPistonEngineSimulator', 300);   % simulate every fault
check_signal_regression(baseline, candidate);             % compare two model versions
generate_ml_dataset;                                      % build the ML training dataset
```

When adding a telemetry field, update the backend schema before the simulator starts publishing it: the backend rejects unknown fields. The full checklist is in [`CLAUDE.md`](CLAUDE.md).
