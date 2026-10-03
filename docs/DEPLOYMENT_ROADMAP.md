# Deployment Roadmap

How the aero-piston engine digital twin moves from this simulation-based prototype to engine test rigs, the MALE UAV Ground Control Station (GCS) and fleet-level health monitoring, as the problem statement asks. The current architecture is described in [`ARCHITECTURE.md`](ARCHITECTURE.md).

The design choice that makes this possible: **the twin only sees MQTT telemetry**. Every phase below changes what produces that telemetry, or where the twin runs. The core logic (baseline, health, failure definition, predictors, advisory) carries over unchanged.

---

## Phase 0 — Prototype (current)

**Status:** working end to end on simulated data.

- Simulink engine model with physics, sensor dynamics, 10 fault modes and 5 mission profiles.
- Live pipeline: MQTT → TimescaleDB → digital twin → API/WebSocket → dashboard.
- Healthy baseline, health indices, failure definition, rule-based fault and RUL predictors, maintenance advisory, efficiency index, mission replay and reports.
- ML dataset: 300 simulated flights, labelled with the twin's own failure definition.

## Phase 1 — Trained models (immediate)

- Train the anomaly/fault and RUL models on the dataset (`ANOMALY_MODEL_GUIDE.md`, `RUL_MODEL_GUIDE.md`).
- Plug them in through `create_predictors()` in `backend/twin/predictor.py`. The dashboard, advisory and reports already consume that interface.
- Report detection lead time, false-alarm rate and RUL error per fault and per mission profile.
- **Exit criteria:** every fault identified before failure in held-out flights; fewer than 1 false alarm per hour on healthy flights.

## Phase 2 — Engine test rig (hardware in the loop)

Replace the simulator with a real engine on a test stand.

1. **Data acquisition:** read the ECU/FADEC and sensor data over **CAN bus (SocketCAN on Linux)**. A small gateway decodes CAN frames (DBC definitions) into the existing telemetry JSON and publishes it to `engine/{id}/telemetry`. Nothing downstream changes.
2. **Operating conditions:** take throttle and load from the ECU, and altitude and ambient from the rig's environmental sensors (or an altitude chamber).
3. **Calibration:**
   - refit the healthy baseline (`ai/baseline/fit_baseline.py`) on healthy rig runs;
   - re-tune the health-index limits;
   - fine-tune the ML models on rig data (transfer learning from the simulated dataset).
4. **Fault validation:** seed safe, controlled faults on the rig (restricted cooling air, injector flow restriction, sensor offset injection) to validate detection and RUL on real signatures.
5. **Twin fidelity:** update the Simulink model parameters from rig data, so the simulator remains a reliable source of rare or dangerous fault data that can't be produced on real hardware.

## Phase 3 — Ground Control Station deployment

Run the twin alongside the UAV's GCS.

- **Telemetry link:** UAV downlink → GCS → MQTT broker on the GCS network. Handle link dropouts with store-and-forward buffering (gaps are already detected as ingestion events).
- **Packaging:** the containerised services (broker, database, telemetry service, API, UI) run on a GCS server or a rugged edge box. Models are exported to ONNX or another light format for CPU inference.
- **Security (defence-grade requirements):**
  - MQTT over TLS with client certificates, and no anonymous access;
  - authenticated, role-based API access (operator, maintenance engineer);
  - signed model and configuration artefacts;
  - audit logging of advisories and operator actions;
  - deployment on an isolated network.
- **Operator workflow:** advisories integrate with GCS alerting, and mission reports go to the maintenance team after each sortie.

## Phase 4 — Onboard / edge analytics

Move lightweight detection onto the aircraft for when the datalink is degraded.

- **Onboard detection:** run a quantised anomaly detector and the advisory rules on a companion computer, and downlink only alerts and summaries when bandwidth is limited.
- **Ground-side models:** keep the heavier RUL and diagnosis models on the ground.

## Phase 5 — Fleet-level health monitoring

- **Many engines:** many engines publish to one platform (`engine_id` is already in every topic, table and route).
- **Fleet views:** per-engine maintenance schedules from RUL trends, and fleet dashboards (healthiest and at-risk engines).
- **Storage at scale:** TimescaleDB retention policies and continuous aggregates for long-term history.
- **Federated learning:** train models across sites without moving raw (classified) engine data.
- **Life-cycle management:** link to maintenance records, so recorded repairs close the loop on predictions.

---

## Risks and how they are addressed

| Risk | Mitigation |
|---|---|
| Real fault data is classified or scarce | Physics-based twin generates labelled fault data; transfer learning to rig data; federated learning across sites |
| Simulation-to-reality gap | Rig calibration of baseline, health limits and models (phase 2) before operational use |
| False alarms erode operator trust | Baseline-relative health, persistence rules, per-profile false-alarm metrics, explainable evidence on every advisory |
| Link loss | Store-and-forward; onboard detection (phase 4) |
| Cyber security | TLS, authentication, isolated deployment, signed artefacts (phase 3) |
| Certification | Advisories are decision support with evidence; validation reports per fault and profile; human in the loop |
