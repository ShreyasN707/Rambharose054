# Anomaly Detection & Fault Identification — Training Guide

This guide is for whoever trains the anomaly / fault model of the aero-piston engine digital twin. It covers what the model must do for the SIH problem statement, how the simulated engine and its faults behave, the dataset, which algorithms to use, how to evaluate, and how to hand the model back so the live system can run it.

The RUL (remaining useful life) model has its own guide. The two models share the same dataset.

All numbers below were measured from the current Simulink model (commit `7c0528f`, October 2026). They are simulator values, not certified engine limits.

---

## 1. What the model has to do

The problem statement asks the system to move from threshold alarms to predictive diagnostics. That means it must:

- detect abnormal operating conditions;
- detect and identify misfire, injector abnormalities, cooling degradation, lubrication issues, sensor drift/failure, combustion instability, overheating trends and abnormal vibration;
- **predict probable failures before they occur.**

For this model, "before they occur" means:

> Every fault in the simulator starts invisible and grows over several minutes until the engine fails (a subsystem's health stays below 30/100). **Your model must raise the alarm, and name the right fault, while the fault is still small — long before failure.**

So the most important number you report is **lead time**: how many seconds before failure the model correctly identified the fault. A model that only recognises fully developed faults scores high on accuracy but is useless for the PS.

The job splits into two parts:

| Part | Question | Output |
|---|---|---|
| **A. Anomaly detector** | Is the engine behaving differently from a healthy engine in the same flight conditions? | Anomaly score + anomalous yes/no |
| **B. Fault classifier** | Which of the 9 faults is developing? | Fault ID (0 = healthy, 1–9) + confidence |

Part A also catches problems the classifier was never trained on. Part B makes the alarm actionable.

---

## 2. The engine and the simulator

- **Engine:** a single-cylinder, four-stroke, naturally aspirated ~100 cc aero-piston engine with electronic fuel injection, a 28 V electrical system and an alternator. It's modelled in Simulink (`simulation/AeroPistonEngineSimulator.slx`, parameters in `simulation/engine_params.m`).
- **Physics:**
  - Torque scales with throttle × air density. Air density follows the standard atmosphere, so the engine loses about half its power at 6 km.
  - CHT and oil temperature come from heat balances, so they lag power changes by minutes.
  - Oil pressure follows RPM and oil temperature.
  - The alternator only carries the 10 A avionics load above ~2600 RPM. Below that, the bus drops to battery voltage (~26 V).
- **Sensors:** every signal passes through a realistic sensor chain: lag → slow drift → noise → sampling → range limits. So expect noise, and some signals clip at their range limits.
- **Live system:** Simulink publishes one sample per second over MQTT. The backend stores it, computes health, and calls your model. **Train at 1 Hz.**
- **Time scale:** compressed. Real faults develop over hours; here they develop over 1–15 minutes, so a whole fault fits into a demo. Say so if judges ask.

### 2.1 Inputs the engine receives (flight conditions)

These four come from the mission profile. They are **causes**, not symptoms:

| Field | Unit | Meaning |
|---|---|---|
| `throttle` | 0–1 | Throttle position |
| `engine_load` | 0–1 | Propeller / payload load on the engine |
| `altitude` | m | Altitude above sea level |
| `ambient_temperature` | °C | Outside air temperature **at the aircraft's altitude** (drops ~6.5 °C per km climbed) |

### 2.2 Signals the engine produces (12)

| Field | Unit | Notes |
|---|---|---|
| `rpm` | RPM | Engine speed. Very low noise when healthy (±0.5 RPM), so any jitter means something |
| `torque` | N·m | Very noisy (healthy cruise 8.7–12.0 N·m). Average over windows |
| `fuel_flow` | kg/h | Fuel actually delivered |
| `cht` | °C | Cylinder head temperature. Slow; noise ~±1 °C |
| `egt` | °C | Exhaust gas temperature. Fast |
| `oil_pressure` | psi | Follows RPM |
| `oil_temperature` | °C | Slow; sensor range 0–200 °C |
| `vibration` | model units | A sampled **oscillation** around 0 (±2.5). Its mean is meaningless, so **use its RMS over a window** (healthy ≈ 1.5) |
| `battery_voltage` | V | 28 V bus. Healthy 27.9–28.1, unless at low RPM (see above) |
| `alternator_current` | A | Wanders 10–15 A when healthy (battery charging) |
| `injection_timing` | ° BTDC | ECU start-of-injection, from an RPM × throttle map |
| `injection_duration` | ms | ECU injector pulse width. It tells you how much fuel the ECU *commanded* (§5.3) |

---

## 3. Mission profiles: how the drone flies and what a healthy engine reads

`simulation/mission_profile.m` defines five profiles, the conditions the PS asks for. Each has a nominal version, used by the live demo, and random variations, used in the dataset.

| Profile | What the drone does | Dataset variation range |
|---|---|---|
| **Cruise** | Steady level flight | Throttle 70–100 %, load 40–60 %, altitude 0–1500 m, ground temperature 10–35 °C |
| **High altitude** | Full-throttle climb, then cruise at altitude in thin, cold air | Target 3000–7500 m, climb at 3–8 m/s, cruise throttle 70–95 % |
| **Hot weather** | Low-altitude flight on a hot day | Ground temperature 40–50 °C, altitude 0–1500 m |
| **Endurance** | Long loiter at medium altitude; power, load and altitude drift slowly | 2000–4500 m, throttle 60–85 % ± 5 % |
| **Rapid throttle** | Throttle steps between low and high power every 15–45 s, each step taking 1–3 s | Low 30–50 %, high 85–100 % |

### 3.1 Healthy engine readings per profile

Nominal profiles, after warm-up. These are 5th–95th percentile ranges:

| Signal | Cruise | High altitude (climb to 4500 m) | Hot weather (45 °C) | Endurance (~3000 m) | Rapid throttle |
|---|---|---|---|---|---|
| Throttle | 100 % | 85–100 % | 100 % | 70–80 % | 40–100 % |
| Altitude (m) | 0 | 1044–4500 | 500 | 2700–3300 | 500 |
| Ambient (°C) | 25 | −4 to 18 | 42 | 4–7 | 22 |
| RPM | 3993–3994 | 2830–3779 | 3742–3743 | 2743–3034 | 2315–3891 |
| Torque (N·m) | 8.7–12.0 | 5.0–9.7 | 7.7–10.9 | 4.2–7.7 | 3.1–11.0 |
| Fuel flow (kg/h) | 2.74–3.05 | 1.12–2.54 | 2.32–2.63 | 1.11–1.53 | 0.84–2.82 |
| CHT (°C) | 78.6–81.3 | 29–70 | 95.2–98.2 | 33.9–41.0 | 63.3–69.4 |
| EGT (°C) | 707–711 | 371–636 | 653–657 | 366–416 | 330–674 |
| Oil pressure (psi) | 58.3–60.6 | 41.0–56.6 | 54.5–56.8 | 40.4–45.3 | 33.5–58.7 |
| Oil temperature (°C) | 104.0–107.3 | 75.5–98.9 | 128.8–132.0 | 70.6–85.6 | 100.8–104.0 |
| Vibration RMS | ~1.5 | ~1.5 | ~1.5 | ~1.5 | ~1.5 |
| Bus voltage (V) | 27.9–28.1 | 27.9–28.1 | 27.9–28.1 | 27.9–28.1 | **25.3**–28.1 |
| Injection timing (°) | 14.5–14.8 | 12.0–14.1 | 13.8–14.1 | 12.4–13.0 | 12.4–14.5 |
| Injection duration (ms) | 10.4–10.5 | 6.6–9.7 | 9.6–9.7 | 6.6–7.2 | 6.3–10.2 |

**The key lesson:** a healthy engine at high altitude reads 2800 RPM and a 30 °C CHT. A healthy engine on a hot day reads 130 °C oil. If you train on raw values, the model will call healthy flights faulty and miss real faults. **You must compare against what a healthy engine should read in the same conditions** (§5.1).

Other things to know:
- **Warm-up:** the first 2–5 minutes of every run are an engine warm-up from cold (CHT and oil from 25 °C). That's normal, not a fault. The backend only starts scoring at the 60th sample.
- **Low CHT at altitude:** in cold, high, low-power flight, CHT can sit at 6–40 °C. That's a simulator quirk (its CHT scale runs low), but it's consistent, so the model can learn it.
- **Rapid throttle:** RPM swings 2300 ↔ 3900 and EGT swings 330 ↔ 670 °C every few tens of seconds while healthy. This profile is the false-alarm stress test.

---

## 4. The faults

### 4.1 How a fault unfolds

1. **Injection:** a fault is switched on at an *onset* time. At that moment it has **zero effect**.
2. **Ramp:** its strength (`severity`) grows linearly from 0 to 1 over a *ramp time*, then stays at 1.
3. **Failure:** at some point the weakest engine subsystem's health (0–100, computed by the backend from the signals, averaged over 90 s) drops below 30 and stays there. That moment is labelled failure (`backend/twin/failure.py`). Sensor health doesn't count: a broken sensor isn't a broken engine.

The dataset uses different ramp times per fault, so faults that are dangerous in reality also develop quickly here:

| Speed | Faults | Ramp time |
|---|---|---|
| Fast | 3 oil pressure, 4 fuel starvation | 1–3 min |
| Medium | 1 misfire, 2 overheating | 3–6 min |
| Slow | 5 injector, 6 cooling, 7 CHT sensor, 8 instability, 9 vibration | 8–15 min |

### 4.2 What each fault does, at full strength

| ID | Fault | What physically happens (model) | PS category |
|---|---|---|---|
| 0 | Healthy | — | — |
| 1 | Misfire | Up to 35 % of 50 ms combustion windows produce no torque; engine vibration ×2 | Misfire conditions |
| 2 | Overheating | Combustion heat into the head ×4, EGT +300 °C, oil heat ×1.5 | Overheating trends |
| 3 | Oil pressure failure | Oil pressure ×0.2; oil heat ×2 | Lubrication issues |
| 4 | Fuel starvation | Fuel flow and torque ×0.2 | (extra) |
| 5 | Injector abnormality | Injector delivers 70 % of the fuel the ECU commands; torque ×0.84 | Injector abnormalities |
| 6 | Cooling degradation | Head cooling ×0.4; oil heat ×1.3 | Cooling degradation |
| 7 | CHT sensor drift/failure | **Sensor only:** reported CHT +40 °C, plus noise σ 6 °C. The engine is unaffected and the engine never "fails" | Sensor drift/failure |
| 8 | Combustion instability | Cycle-to-cycle torque variation σ 20 %; torque ×0.96 | Combustion instability |
| 9 | Abnormal vibration | Vibration ×4 (imbalance / bearing wear); torque ×0.98 | Abnormal vibration patterns |

### 4.3 What the signals show: early, mid and full strength

Measured at cruise: fault injected at 120 s, 5-minute ramp. "→" means healthy value → faulty value, compared over the same time window. *Roughness* = median |x[i] − (x[i−1]+x[i+1])/2| over 30 samples (healthy RPM ≈ 0.2–0.35, healthy CHT ≈ 0.5–0.8).

| Fault | At 25 % strength (**early — where prediction happens**) | At 50 % | At 100 % |
|---|---|---|---|
| 1 Misfire | RPM 3994→3796, **RPM roughness 0.35→52**, EGT 709→684, vibration RMS 1.50→1.71 | RPM →3591, roughness →78, EGT →661, oil pressure 59.5→53.5 | RPM →3195, torque 10.1→6.8, EGT →613, oil pressure →47.5, vibration RMS →2.66, roughness →69 |
| 2 Overheating | **CHT 79→101**, EGT 709→782, oil temperature 105→113 | CHT →139, EGT →857, oil temperature →123 | CHT →243, EGT →1009, oil temperature →145 |
| 3 Oil pressure | **Oil pressure 59.7→47.8**, oil temperature 105→122 | Oil pressure →35.7, oil temperature →141 | Oil pressure →11.5, oil temperature →185 |
| 4 Fuel starvation | **Fuel 2.90→2.16**, RPM →3549, EGT →578, CHT 79→75, injector pulse 10.47→8.87 ms | Fuel →1.44, RPM →3030, EGT →448, oil pressure →45 | Fuel →0.27, RPM →1524, EGT →195, CHT →42, oil pressure →22, **bus 28.0→24.8 V**, alternator 13.9→3.5 A |
| 5 Injector | **Fuel 2.90→2.64 while the pulse stays the same**, EGT 709→666 | Fuel →2.37, RPM →3820, EGT →625, CHT →74 | Fuel →1.89, RPM →3633, EGT →542, CHT →65, pulse 10.47→**10.79** ms (rises: the ECU asks for more) |
| 6 Cooling | **CHT 79→84**, oil temperature 105→110 (EGT unchanged) | CHT →94, oil temperature →116 | CHT →155 (still rising), oil temperature →129 |
| 7 CHT sensor | **CHT 79→89**, CHT roughness 0.79→1.08 (nothing else changes) | CHT →100, roughness →1.74 | CHT →120, **roughness →4.79** |
| 8 Instability | **RPM roughness 0.35→10.3** (averages unchanged) | Roughness →16.4 | Roughness →38.8, torque 10.1→9.6 |
| 9 Vibration | **Vibration RMS 1.50→2.43** (nothing else) | RMS →2.43 | RMS →4.68 |

Every fault is visible by 25 % strength, if you look at the right feature. That's what makes early detection achievable.

### 4.4 When the engine fails (time from injection)

Health replay with a 5-minute ramp:

| Fault | Cruise | Endurance (low power) |
|---|---|---|
| 1 Misfire | 98 s (at 33 % strength) | 119 s |
| 2 Overheating | 167 s (56 %) | 210 s |
| 3 Oil pressure | 182 s (61 %) | 219 s |
| 4 Fuel starvation | 258 s (86 %) | 315 s |
| 5 Injector | 273 s (91 %) | 346 s |
| 6 Cooling | 408 s (after full strength) | **never** |
| 7 CHT sensor | never (sensor fault, not engine failure) | never |
| 8 Instability | 267 s (89 %) | **never** |
| 9 Vibration | 271 s (90 %) | **never** |

At low power, faults 6, 8 and 9 stay below failure level. Physically reasonable: less heat, less vibration. The **anomaly** model must still detect them. Only the RUL label differs.

### 4.5 Pairs that are hard to tell apart, and what separates them

| Confusable | Separating feature |
|---|---|
| 4 Fuel starvation (early) vs 5 Injector | **Measured ÷ commanded fuel** (§5.3): healthy 0.99, fuel starvation 0.94, injector **0.69**. Also bus voltage falls only with fuel starvation |
| 1 Misfire vs 8 Instability | Both make RPM rough. Misfire also drops mean RPM, EGT and oil pressure and raises vibration; instability barely moves averages |
| 2 Overheating vs 6 Cooling vs 7 Sensor | All raise CHT. Overheating also raises **EGT**; cooling raises **oil temperature** but not EGT; the sensor fault raises **CHT roughness** and nothing else |
| 9 Vibration vs 1 Misfire | Both raise vibration RMS. Misfire also has RPM roughness and RPM drop |
| Any fault vs a healthy flight transient | Residuals (§5.1). During rapid throttle, raw RPM and EGT swing more than many faults do |

---

## 5. Features

### 5.1 Residuals: the most important idea

For each signal the backend has an **expected healthy value** from a baseline model that knows the flight conditions (`backend/twin/baseline.py`). It predicts RPM, EGT, CHT, oil pressure, oil temperature, bus voltage and alternator current. Its held-out accuracy (RMSE / 99th-percentile error) is:

| Signal | RPM | EGT | CHT | Oil pressure | Oil temperature | Bus voltage | Alternator current |
|---|---|---|---|---|---|---|---|
| RMSE | 9 | 3.3 °C | 0.8 °C | 0.7 psi | 1.0 °C | 0.44 V | 0.8 A |
| p99 | 35 | 9.4 °C | 1.9 °C | 1.8 psi | 2.5 °C | 1.5 V | 2.9 A |

Use **residual = measured − expected** as features. Healthy residuals hover near zero in every profile; faults push them away. This one step makes the model work across all five profiles. The dataset includes the `expected_*` columns, and the live backend computes the same values, so the feature is available in production.

### 5.2 Window features

The backend gives your model the **last 60 samples (60 s)**. Compute per window:

- for each residual and each raw signal without a baseline (torque, fuel flow, injection timing/duration): **mean, std, slope** (least-squares over the window), **min, max**;
- **roughness** (§4.3) of `rpm`, `cht` and `torque`;
- **vibration RMS** (never the mean);
- the **fuel ratio** (§5.3);
- the window mean of the four flight conditions, as context.

Slopes matter for early detection: at 10–25 % strength a fault often shows as a steady drift before the level is clearly abnormal.

### 5.3 Commanded fuel (physics feature)

The ECU's injector pulse tells you how much fuel it asked for:

```
commanded_fuel_kgph = max(0, injection_duration_ms − 0.8) × 2.5 / 1000 × (rpm / 120) × 3.6
fuel_ratio          = fuel_flow / commanded_fuel_kgph        (ignore when rpm < 300)
```

(0.8 ms injector dead time, 2.5 g/s injector flow, 1 cylinder, 4-stroke. These are the same constants as `backend/twin/service.py`.)

### 5.4 Health scores

The dataset also has the backend's subsystem health scores (`health_thermal`, `health_combustion`, `health_lubrication`, `health_mechanical`, `health_electrical`, `health_injection`, `health_sensor`, 0–100). They're rule-based summaries computed live, so you may use them as features. But don't let the model become a copy of them: it should detect faults *earlier* than the rules (they're tuned to reach 30 at failure).

### 5.5 Never use as features

`sim_time`, `severity`, `failed`, `rul_seconds`, `fault_id`, run or mission IDs, the profile name or seed. These leak the answer or don't exist live.

---

## 6. Dataset

Generated by the dataset generator (`simulation/`, not yet written at the time of this guide). It's written to `data/sim_v2/`. A **pilot** of ~50 runs (1 per profile × fault) comes first so you can build the pipeline; the **full** set of ~300 runs (6 per profile × fault) follows.

### 6.1 Structure

- `data/sim_v2/runs.csv`: one row per run, with columns `run_id, profile, profile_seed, fault_id, onset_s, ramp_s, failure_s (empty if never), duration_s, split`.
- `data/sim_v2/runs/<run_id>.csv`: one row per second.

| Group | Columns |
|---|---|
| Time | `sim_time` (s since engine start; ground truth only) |
| Flight conditions | `throttle, engine_load, altitude, ambient_temperature` |
| Signals | the 12 in §2.2 |
| Expected healthy values | `expected_rpm, expected_egt, expected_cht, expected_oil_pressure, expected_oil_temperature, expected_battery_voltage, expected_alternator_current` |
| Health | `health_thermal … health_sensor` |
| Labels | `fault_id` (0 before onset, then the fault's ID), `severity` (0–1), `failed` (0/1), `rul_seconds` (capped at 600) |

### 6.2 Run timeline

```
0 s ──── warm-up (healthy) ──── onset (random 120–300 s) ──── ramp (per §4.1) ──── failure ── +60 s end
                                                                                  └─ or, if it never fails: hold 5 min, then end
```

Fault 0 runs are healthy throughout.

### 6.3 Splits

`runs.csv` assigns each run to `train`, `val` or `test` by seed: seeds 1–4 train, 5 val, 6 test. **Split by run, never by row.** Neighbouring seconds of one flight are nearly identical; mixing them across splits inflates every metric.

### 6.4 Class balance

Most rows are healthy: warm-up, pre-onset, fault 0 runs. Use class weights or balanced sampling for the classifier, and report per-class metrics, not plain accuracy.

---

## 7. Algorithms (recommended)

### 7.1 Part A — anomaly detector

| Option | What | Why / when |
|---|---|---|
| **A1. Residual Mahalanobis (baseline, build first)** | Fit mean and covariance of the healthy window-feature vectors; score = Mahalanobis distance | Ten lines of numpy, explainable, strong because residuals are already condition-independent. Your yardstick |
| **A2. Dense autoencoder on window features (recommended main)** | Encoder 64→32→8, mirrored decoder, trained **only on healthy windows**; score = reconstruction error | Learns correlations between features (e.g. EGT vs fuel). Small enough for edge/onboard use (a PS innovation point) |
| A3. LSTM / 1D-CNN autoencoder on the raw 60 × N sequence | Same idea on sequences | Only if A2 misses roughness-type faults; slower and heavier |

**Training data:** healthy windows only. That's fault 0 runs, plus every run's samples before onset, excluding the first 60 s of warm-up.

**Threshold:** the 99.5th percentile of the score on healthy **validation** windows. Then add **persistence**: alarm only when, say, 5 of the last 10 windows exceed it. This suppresses one-off spikes during rapid throttle without delaying real faults much.

**Don't** use Isolation Forest or one-class SVM as the main model. They work, but they're harder to threshold and explain than A1/A2, and give no benefit here.

### 7.2 Part B — fault classifier

| Option | What | Why / when |
|---|---|---|
| **B1. XGBoost / LightGBM on window features (recommended)** | 10-class softmax on §5 features, class weights | Fast to train, strong on tabular features, and explainable: **SHAP values show which signals drove each diagnosis**, the PS's "explainable AI for fault diagnosis" |
| B2. 1D-CNN or GRU on the raw 60 × N window | Learns its own features | Only if B1 confuses pairs from §4.5 after you've added the features listed there |

**Labels:** `fault_id` of the window's last sample.

**Early samples:** drop windows where 0 < severity < 0.05 from **training**. They're physically indistinguishable from healthy and only teach noise. Keep them in **evaluation**.

**Post-processing:** smooth the predicted class over the last ~10 s (majority or averaged probabilities) so the dashboard doesn't flicker.

**Optional bonus:** add a second output, "fault will reach failure within 5 min" (yes/no, from `rul_seconds < 300`). It turns the classifier into an explicit early-warning model, and it's a nice bridge to the RUL model.

### 7.3 How A and B work together live

```
every second:
  anomaly_score = A(window)
  fault, confidence = B(window)
  if anomaly persists or (fault != 0 and confidence high for ~10 s):
      alert "<fault name> developing"            ← early warning
```

---

## 8. Evaluation (what to report)

Evaluate on the **test** runs. Report everything **per mission profile** as well as overall.

| Metric | Definition | Target to aim for |
|---|---|---|
| **Lead time before failure** | failure time − time the fault was first correctly identified *and stayed* identified (≥ 10 s) | As large as possible; ≥ 60 % of the onset-to-failure window |
| **Detection delay** | Seconds after onset until detected | Report per fault |
| **Severity at detection** | Fault strength at that moment | ≤ 0.25 for most faults |
| **False alarm rate** | Anomaly or fault alarms per hour on healthy test runs (fault 0 + pre-onset) | < 1 per hour, especially in rapid throttle |
| **Per-class precision / recall / F1** | On windows with severity ≥ 0.25 | ≥ 0.9 |
| **Confusion matrix** | 10 × 10 | Check the §4.5 pairs |
| **Missed faults** | Runs where the fault is never correctly identified | 0 |

Include one plot per fault showing anomaly score and class probability over time, with onset and failure marked. That's the picture that convinces judges you "predict before it occurs".

---

## 9. Pitfalls

- **Raw-value thresholds don't transfer between profiles.** Use residuals.
- **Vibration mean is noise.** Use RMS.
- **Torque is very noisy.** Use window means and roughness, not single samples.
- **The first minute is warm-up.** Don't train the anomaly detector on t < 60 s, and don't count alarms there.
- **Fault 7 is a sensor fault.** CHT looks hot, but the engine is fine. The classifier should call it 7, not overheating. EGT and oil temperature tell them apart.
- **Low-power runs have weaker faults** (§4.4). Make sure the test set covers endurance and high altitude.
- **Electrical sag at low RPM is healthy** in rapid throttle (bus down to ~25.3 V). The baseline expects it, so trust the residual.
- **Leakage:** never feed time, severity, labels or run identifiers (§5.5), and never split by row.
- **Simulator randomness:** the Simulink noise and misfire generators have fixed seeds, so the live demo always replays the same noise. The dataset generator gives every run its own noise seeds, so no two runs share a noise pattern, and the splits keep each profile seed in one split only.

---

## 10. Handing the model back

The live backend (`backend/twin/ml_predictor.py`) will call your model once per second with a window of recent samples. Each sample is a dict with the column names of §6.1, minus the labels.

**Deliver:**

1. `predict(window: list[dict]) -> dict`, returning
   ```python
   {"anomaly_score": float, "is_anomaly": bool,
    "fault_id": int, "fault_confidence": float,          # 0-1
    "probabilities": {fault_id: float, ...},
    "top_features": [(name, contribution), ...]}        # optional, from SHAP
   ```
2. **Model files:**
   - XGBoost / LightGBM: `save_model("*.json")`
   - PyTorch: `state_dict` `.pt`
   - Keras: `.keras`
3. **Feature scaling** as **JSON** (means / stds), not sklearn pickles. The backend runs scikit-learn 1.6.1, and pickles break between versions.
4. **The threshold and persistence settings** as JSON.
5. **A short results note** with the §8 metrics.

**Constraints:**
- **Speed:** under 50 ms per call on a laptop CPU.
- **Size:** ideally under 10 MB. Lightweight models suit onboard / edge deployment, which the PS lists as an innovation area.

The current files in `backend/twin/ml_models/anomaly/` and `anomalyModel/` were trained on an older 20-run dataset (faults 0–4 only, no mission profiles). Treat them as references for the interface, not as models to keep.
