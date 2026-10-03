# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A real-time digital twin of an aero-piston engine. A Simulink model generates engine telemetry, which flows over MQTT into TimescaleDB, gets health/ML analysis, and is shown live in a React dashboard. Faults can be injected from the dashboard while the simulation runs.

## Data flow

```
Simulink (simulation/simulink_mqtt_stream.m, MATLAB -batch)
  │ publishes 1 msg/s  ──►  MQTT engine/{engine_id}/telemetry   (mosquitto :1883)
  ▼
telemetry container (backend/telemetry/app.py)
  validate (TelemetryCreate) → store row → twin service (health indices + ML) → health_snapshots
  ▼
TimescaleDB (:5432)  ◄── api container (FastAPI, backend/api, :8000, REST under /api + WS /ws/engines/{id})
  ▼
frontend (Vite/React, :5173) — services/api.ts, hooks/useEngineData.ts

Fault injection:  dashboard → POST /api/engines/{id}/fault → MQTT engine/{id}/fault
  → simulation/mqtt_fault_bridge.py writes simulation/fault_state.txt
  → simulink_mqtt_stream.m polls the file each step and set_params Fault_ID + Degradation/Fault_Onset
Start/stop:  API → simulation/simulation_controller.py (:9000) → start_simulation.sh → matlab -batch
```

The simulator is not a container: the fault bridge and the simulation controller run on the host (`start.sh` launches them with nohup), and the controller spawns its own batch MATLAB process.

## Commands

```bash
./start.sh                                   # docker compose up -d + fault bridge + simulation controller
docker compose up -d mosquitto timescaledb telemetry api   # backend only (skip the frontend container)

# Frontend (frontend/)
npm run dev                                  # Vite on :5173
npm run build                                # tsc -b && vite build; tsc has noUnusedLocals, so dead code fails the build
npx tsc -b --noEmit                          # typecheck only

# Database migrations (Alembic, backend/telemetry/migrations). The entrypoint runs `alembic upgrade head` on container start.
docker exec telemetry alembic current
docker exec telemetry alembic upgrade head
```

There is no backend test suite and no linter config. Verify backend changes by publishing a payload and reading it back:

```bash
docker exec mosquitto mosquitto_pub -t engine/engine_verify/telemetry -m '{...}'   # see docs/telemetry-schema.md for an example payload
curl "localhost:8000/api/engines/engine_verify/telemetry/latest?mission_id=..."
```

Delete such test rows afterwards from `telemetry`, `health_snapshots` and `ingestion_events`. The telemetry table's time column is `time`, not `timestamp`.

### Simulink checks (run in MATLAB, from simulation/)

```matlab
engine_params;                                              % loads all model parameters into the base workspace; required before sim
set_param('AeroPistonEngineSimulator','SimulationCommand','update')   % compile check
r = run_telemetry_scenarios('AeroPistonEngineSimulator', 300, {'steady'}, 0:9);  % one sim per Fault_ID
report = check_signal_regression(baseline, candidate);      % prove a model edit left signals 1-9 bit-identical
```

`generate_ml_dataset.m` produces the ML training CSV.

## Things that span multiple files

- **Adding a telemetry field** touches, in order: `backend/telemetry/schemas.py` (TelemetryCreate uses `extra="forbid"`, so the backend must accept the field *before* the publisher sends it), `models.py`, a new Alembic migration (nullable column, so old rows stay valid), `repository.py`, `service.py`, `backend/api/schemas.py` (`TelemetryResponse.from_row`, which also feeds the WebSocket), `frontend/src/types/api.ts`, `ZERO_TELEMETRY` in `frontend/src/hooks/useEngineData.ts`, the `sprintf` in `simulation/simulink_mqtt_stream.m`, and `docs/telemetry-schema.md`.
- **ML models get fixed feature sets.** New telemetry fields must not be added to the autoencoder / XGBoost / RUL GRU inputs (`backend/twin/ml_predictor.py`, `backend/twin/ml_models/`). `backend/twin/service.py` builds those vectors explicitly. `anomalyModel/` and `ai/RUL/` are the standalone training/reference code for those models.
- **Rule-based health limits in `backend/twin/service.py` mirror Simulink parameters** in `simulation/engine_params.m` (`elec.*`, `inj.*`, the injection timing map). Change both together.
- **Faults.** `Fault_ID` 0–9 selects rows of 2-D lookup tables (fault ID × degradation) spread across the model's subsystems. Degradation ramps 0→1 over `fault_ramp_time` (300 s) from `Degradation/Fault_Onset`, so a freshly injected fault has no effect yet. The fault list and signatures are documented in `docs/telemetry-schema.md` and must be kept in sync with the valid fault IDs in `backend/api/routers/engines.py`, `simulink_mqtt_stream.m`, and the health indices.
- **Failure definition** (`backend/twin/failure.py`): the engine has failed when the weakest engine subsystem health (sensor health excluded), averaged over 90 s, drops below 30 and stays there. RUL labels come from the same `calculate_health()` the live twin uses. The penalty scales in `backend/twin/service.py` are calibrated so every fault fails, and a healthy cruise run never does. After changing them or the fault tables, re-run a fault sweep through the health code.
- **Sensor chain.** Every published signal passes lag → drift ramp → noise → ZOH → saturation, so reported values can clip. For example, oil temperature saturates at 200 °C, and vibration ratios read lower than the model multipliers because of the additive drift.
- `signal7` in `telemetry_log` is the Fault_ID ground-truth label: it is logged for datasets and never published.

## Environment constraints

- The machine has 7.5 GB RAM. The MATLAB desktop plus the api and telemetry containers can OOM. Prefer a single MATLAB process: don't start another MATLAB while the controller's batch simulation is running.
- `backend/` is bind-mounted into the containers, which run as root, so `__pycache__` dirs on the host are root-owned. Use `ast.parse` rather than `py_compile` for host-side syntax checks.
- The frontend container keeps `node_modules` in the named volume `frontend_node_modules`. After adding a dependency, rebuild the image and recreate that volume, or the container won't see the dependency.
- Only use files inside this repo; don't pull inputs from `~/Downloads` or elsewhere.
- Credentials come from `.env` (template: `.env.example`).
