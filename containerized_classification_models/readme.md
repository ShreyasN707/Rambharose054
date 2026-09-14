# Aero Engine ML Models

Machine learning models for the **AI-Enabled Real-Time Digital Twin System for Health Monitoring, Fault Prediction and Mission Reliability Enhancement of Aero Piston Engines used in MALE UAVs**.

This directory contains two complementary ML models:

1. **XGBoost Fault Classifier** — identifies the specific known fault type.
2. **Isolation Forest Anomaly Detector** — detects abnormal engine behavior, including potentially unseen/unknown anomalies.

The two models are designed to work together rather than replace each other.

---

# 1. System Overview

The ML pipeline is designed around two questions:

### Question 1 — Is the engine behaving abnormally?

Handled by:

**Isolation Forest**

```text
Sensor Data
     ↓
Normal-behavior model
     ↓
Anomaly Score
     ↓
Threshold
     ↓
Healthy / Anomaly
```

### Question 2 — If it is a known fault, what fault is it?

Handled by:

**XGBoost**

```text
Sensor Data
     ↓
XGBoost Classifier
     ↓
Fault Probabilities
     ↓
Most Probable Fault
```

Together:

```text
                    Engine Telemetry
                           │
                           ▼
                 ┌───────────────────┐
                 │ Feature Extraction│
                 └─────────┬─────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────────┐       ┌─────────────────┐
     │ Isolation Forest│       │     XGBoost     │
     │                 │       │                 │
     │ Anomaly         │       │ Fault           │
     │ Detection       │       │ Classification  │
     └────────┬────────┘       └────────┬────────┘
              │                         │
              ▼                         ▼
       Healthy / Anomaly         Specific Fault
```

---

# 2. Models Included

| Model            | Purpose                    | Learning Type | Output                          |
| ---------------- | -------------------------- | ------------- | ------------------------------- |
| XGBoost          | Known fault classification | Supervised    | Fault ID + probabilities        |
| Isolation Forest | Anomaly detection          | Unsupervised  | Anomaly score + Healthy/Anomaly |

---

# 3. Common Input Features

Both models use the same **12 input features**.

The feature order must be preserved during inference.

```text
1. Signal1_RPM
2. Signal2_FuelFlow
3. Signal3_Torque
4. Signal4_OilTemp
5. Signal5_OilPressure
6. Signal6_CHT
7. Signal8_EGT
8. Signal9_Vibration
9. Throttle
10. EngineLoad
11. Altitude_m
12. AmbientTemp_C
```

### Feature descriptions

| Feature               | Description                  | Unit                |
| --------------------- | ---------------------------- | ------------------- |
| `Signal1_RPM`         | Engine rotational speed      | RPM                 |
| `Signal2_FuelFlow`    | Engine fuel-flow measurement | Simulator-dependent |
| `Signal3_Torque`      | Engine output torque         | Simulator units     |
| `Signal4_OilTemp`     | Engine oil temperature       | °C                  |
| `Signal5_OilPressure` | Engine oil pressure          | Simulator units     |
| `Signal6_CHT`         | Cylinder Head Temperature    | °C                  |
| `Signal8_EGT`         | Exhaust Gas Temperature      | °C                  |
| `Signal9_Vibration`   | Engine vibration measurement | Simulator units     |
| `Throttle`            | Throttle command             | 0–1                 |
| `EngineLoad`          | Engine load                  | 0–1                 |
| `Altitude_m`          | Operating altitude           | m                   |
| `AmbientTemp_C`       | Ambient temperature          | °C                  |

### Important

The following columns/features must **NOT** be provided to either model:

```text
Signal7_FaultID
FaultID
FaultName
RunID
ScenarioID
RepeatID
SimulationID
```

These contain target information or dataset-identification information and would cause **data leakage**.

`Time_s` is also not used as a direct feature in the current models.

---

# 4. Model 1 — XGBoost Fault Classifier

## Purpose

The XGBoost model performs **known fault classification**.

It answers:

> "Which of the known fault categories is most likely responsible for the current engine behavior?"

Unlike the Isolation Forest, this model was trained using labeled examples from all five classes.

---

# 5. XGBoost Fault Classes

The current simulator contains five classes:

| Fault ID | Fault Name            | Meaning                               |
| -------: | --------------------- | ------------------------------------- |
|      `0` | Healthy               | Normal engine operation               |
|      `1` | Torque Reduction      | Engine performance/torque degradation |
|      `2` | Overheat              | Excessive thermal behavior            |
|      `3` | Low Oil Pressure      | Lubrication/oil-system abnormality    |
|      `4` | Fuel Flow Restriction | Fuel-system/fuel-flow abnormality     |

These are the **simulator fault categories**.

They should not automatically be interpreted as covering every real-world aero-engine failure mode.

---

# 6. XGBoost Model File

```text
xgboost_fault_classifier-v2.json
```

This is the trained XGBoost model.

It can be loaded directly using XGBoost.

Example:

```python
from xgboost import XGBClassifier

model = XGBClassifier()

model.load_model(
    "xgboost_fault_classifier-v2.json"
)
```

No StandardScaler is required for this model.

---

# 7. XGBoost Model Configuration

The trained model uses:

```text
n_estimators       = 600
max_depth          = 5
learning_rate      = 0.10
min_child_weight   = 5
subsample          = 1.0
colsample_bytree   = 1.0
gamma              = 0
reg_alpha          = 0.01
reg_lambda         = 2
objective          = multi:softprob
num_class          = 5
eval_metric        = mlogloss
random_state       = 42
n_jobs             = -1
```

---

# 8. XGBoost Input

The model expects a matrix with **12 columns** in exactly this order:

```python
features = [
    "Signal1_RPM",
    "Signal2_FuelFlow",
    "Signal3_Torque",
    "Signal4_OilTemp",
    "Signal5_OilPressure",
    "Signal6_CHT",
    "Signal8_EGT",
    "Signal9_Vibration",
    "Throttle",
    "EngineLoad",
    "Altitude_m",
    "AmbientTemp_C"
]
```

Example:

```python
sample = df[features].iloc[[0]]

prediction = model.predict(sample)

probabilities = model.predict_proba(sample)[0]
```

---

# 9. XGBoost Output

The classifier produces two useful outputs.

## Predicted Fault

```python
prediction = model.predict(sample)
```

Example:

```text
[2]
```

This means:

```text
Fault ID = 2
Fault = Overheat
```

---

## Fault Probabilities

```python
probabilities = model.predict_proba(sample)[0]
```

Example:

```text
[
    0.01,
    0.02,
    0.94,
    0.01,
    0.02
]
```

The probability order is:

```text
[Healthy,
 Torque Reduction,
 Overheat,
 Low Oil Pressure,
 Fuel Flow Restriction]
```

The highest probability is the model's predicted fault.

---

# 10. XGBoost Performance

The model was evaluated using a **scenario-based split** rather than randomly splitting individual sensor rows.

This is important because consecutive rows from the same simulation are highly correlated.

The split was approximately:

```text
70% scenarios → Training
15% scenarios → Validation
15% scenarios → Test
```

### Final Test Performance

```text
Accuracy : ~96.61%
Macro-F1 : ~96.60%
```

Per-class test performance:

| Fault                 | Precision | Recall |   F1 |
| --------------------- | --------: | -----: | ---: |
| Healthy               |      0.93 |   0.91 | 0.92 |
| Torque Reduction      |      0.98 |   1.00 | 0.99 |
| Overheat              |      1.00 |   1.00 | 1.00 |
| Low Oil Pressure      |      1.00 |   1.00 | 1.00 |
| Fuel Flow Restriction |      0.92 |   0.92 | 0.92 |

The small train/validation/test performance gap indicates good generalization on the simulated scenarios.

---

# 11. Model 2 — Isolation Forest Anomaly Detector

## Purpose

The Isolation Forest is designed for **anomaly detection**.

It answers:

> "Does the current engine behavior look significantly different from healthy engine behavior?"

This model is fundamentally different from XGBoost.

It does **not** need to know every possible fault in advance.

---

# 12. How Isolation Forest Was Trained

The Isolation Forest was trained using **healthy engine samples only**.

Training data:

```text
FaultID = 0
```

Faulty samples were not used to train the anomaly detector.

Therefore, the model learns the distribution of normal engine operation.

Conceptually:

```text
Healthy Engine Data
        ↓
Isolation Forest
        ↓
Learn normal operating behavior
```

During inference:

```text
New Engine Data
        ↓
Isolation Forest
        ↓
Anomaly Score
        ↓
Threshold
        ↓
Healthy / Anomaly
```

This makes the model suitable for detecting behavior that was not explicitly included as a training fault category, provided the new behavior is sufficiently different from healthy behavior.

---

# 13. Isolation Forest Model Files

Two files are required.

## Main Model

```text
isolation_forest_final.pkl
```

This contains the trained Isolation Forest.

Load it with:

```python
import joblib

model = joblib.load(
    "isolation_forest_final.pkl"
)
```

---

## Decision Threshold

```text
isolation_forest_final_threshold.pkl
```

This contains:

```text
0.450956
```

The threshold converts the continuous anomaly score into a binary decision.

Load it with:

```python
threshold = joblib.load(
    "isolation_forest_final_threshold.pkl"
)
```

Both files should be kept together.

---

# 14. Isolation Forest Configuration

The final model uses:

```text
n_estimators = 700
max_samples  = 0.8
max_features = 0.8
bootstrap    = True
random_state = 42
n_jobs       = -1
```

The decision threshold is:

```text
0.450956
```

---

# 15. Isolation Forest Input

The anomaly detector uses the same 12 features:

```python
features = [
    "Signal1_RPM",
    "Signal2_FuelFlow",
    "Signal3_Torque",
    "Signal4_OilTemp",
    "Signal5_OilPressure",
    "Signal6_CHT",
    "Signal8_EGT",
    "Signal9_Vibration",
    "Throttle",
    "EngineLoad",
    "Altitude_m",
    "AmbientTemp_C"
]
```

Example:

```python
X_new = df[features]
```

---

# 16. Isolation Forest Output

The model produces a continuous anomaly score.

The implementation uses:

```python
scores = -model.score_samples(X_new)
```

A **larger score means more anomalous**.

The score is then compared with:

```text
0.450956
```

Decision rule:

```text
score < 0.450956
        ↓
     Healthy

score >= 0.450956
        ↓
     Anomaly
```

---

# 17. Isolation Forest Inference Example

```python
import joblib

# Load model
model = joblib.load(
    "isolation_forest_final.pkl"
)

# Load threshold
threshold = joblib.load(
    "isolation_forest_final_threshold.pkl"
)

# Required feature order
features = [
    "Signal1_RPM",
    "Signal2_FuelFlow",
    "Signal3_Torque",
    "Signal4_OilTemp",
    "Signal5_OilPressure",
    "Signal6_CHT",
    "Signal8_EGT",
    "Signal9_Vibration",
    "Throttle",
    "EngineLoad",
    "Altitude_m",
    "AmbientTemp_C"
]

# New telemetry
X_new = df[features]

# Calculate anomaly score
anomaly_scores = -model.score_samples(X_new)

# Convert score to binary decision
anomaly_prediction = (
    anomaly_scores >= threshold
).astype(int)
```

Output:

```text
0 = Healthy
1 = Anomaly/Fault
```

---

# 18. Isolation Forest Final Evaluation

The final model was evaluated on previously unseen validation and test scenarios.

## Validation

```text
Accuracy    : 0.8401
Precision   : 0.8982
Recall      : 0.9023
F1          : 0.9003
ROC-AUC     : 0.8769
PR-AUC      : 0.9614
Healthy FAR : 0.4089
```

## Test

```text
Accuracy    : 0.8401
Precision   : 0.8897
Recall      : 0.9134
F1          : 0.9014
ROC-AUC     : 0.8603
PR-AUC      : 0.9550
Healthy FAR : 0.4531
```

---

# 19. Isolation Forest Per-Fault Performance

The test set contains four simulated fault types.

| Fault                 |  Recall |
| --------------------- | ------: |
| Torque Reduction      |  97.92% |
| Overheat              | 100.00% |
| Low Oil Pressure      | 100.00% |
| Fuel Flow Restriction |  67.43% |

The anomaly detector performs very well for the first three fault types but has lower recall for Fuel Flow Restriction.

This limitation should be considered when interpreting the model.

---

# 20. Healthy False Alarm Rate

The current test Healthy False Alarm Rate is:

```text
45.31%
```

This means a significant number of individual healthy telemetry samples are classified as anomalous.

This is the primary weakness of the current anomaly detector.

The model should therefore be considered a **strong anomaly-detection baseline**, but not yet a final production-grade fault alarm system.

Future improvements can include:

* Temporal features
* Rolling statistics
* Sensor derivatives
* Operating-condition normalization
* Temporal anomaly aggregation
* Autoencoders
* Sequence models
* Simulation/event-level decision logic

---

# 21. Unknown Fault Detection

One of the major advantages of the Isolation Forest is that it is not trained with fault labels.

It only learns:

```text
Healthy behavior
```

Therefore, it can potentially detect a new fault that was not present during training.

For example:

```text
Training:
Healthy
        ↓
Isolation Forest

Future:
Healthy
Known Fault
New Fault
        ↓
Anomaly Detection
```

However, the current evaluation does **not completely prove unknown-fault detection**.

The current test set contains the same four fault mechanisms used during development, although the operating scenarios are unseen.

To formally demonstrate unknown-fault detection, a completely new simulated fault should be held out from all model development and introduced only during final evaluation.

For example:

```text
Training faults:
Torque Reduction
Overheat
Low Oil Pressure
Fuel Flow Restriction

Held-out unknown fault:
Sensor Drift
```

If the Isolation Forest successfully detects the held-out fault, this provides much stronger evidence of unknown-anomaly detection.

---

# 22. Recommended Combined Architecture

The two models should be treated as complementary.

A practical inference pipeline is:

```text
                 Engine Telemetry
                        │
                        ▼
                Feature Preparation
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
   Isolation Forest             XGBoost
           │                         │
           ▼                         ▼
   Anomaly Score              Fault Probabilities
           │                         │
           ▼                         ▼
    Healthy / Anomaly          Fault Classification
           │                         │
           └────────────┬────────────┘
                        ▼
                 Decision Layer
                        │
                        ▼
              Digital Twin Dashboard
```

A simple operational interpretation is:

### Case 1 — Isolation Forest says Healthy

```text
Anomaly = 0
```

The engine appears to be operating within the learned healthy behavior.

### Case 2 — Isolation Forest says Anomaly

```text
Anomaly = 1
```

Investigate the XGBoost classification.

### Case 3 — Both agree

Example:

```text
Isolation Forest → Anomaly
XGBoost           → Overheat
```

The system can report:

```text
Detected anomaly
Likely fault: Overheat
```

### Case 4 — Anomaly detected but XGBoost is uncertain

Example:

```text
Isolation Forest → Anomaly
XGBoost:
Healthy         0.18
Torque Reduction 0.20
Overheat         0.21
Oil Pressure     0.19
Fuel Restriction 0.22
```

This can be treated as:

```text
Potential unknown/unclassified anomaly
```

This is particularly useful for the digital-twin architecture.

---

# 23. Files in This Model Directory

A recommended structure is:

```text
ML-models/
│
├── xgboost_fault_classifier-v2.json
│
├── anomaly_search/
│   ├── isolation_forest_final.pkl
│   ├── isolation_forest_final_threshold.pkl
│   ├── isolation_forest_final_evaluation.csv
│   └── isolation_forest_final_per_fault.csv
│
└── README.md
```

---

# 24. File Purpose

| File                                    | Purpose                             |
| --------------------------------------- | ----------------------------------- |
| `xgboost_fault_classifier-v2.json`      | Trained supervised fault classifier |
| `isolation_forest_final.pkl`            | Trained anomaly detector            |
| `isolation_forest_final_threshold.pkl`  | Frozen anomaly decision threshold   |
| `isolation_forest_final_evaluation.csv` | Validation/test evaluation metrics  |
| `isolation_forest_final_per_fault.csv`  | Per-fault anomaly detection results |
| `README.md`                             | Model documentation                 |

---

# 25. What Should Be Used in the Application?

For **known fault classification**:

```text
xgboost_fault_classifier-v2.json
```

For **anomaly detection**:

```text
isolation_forest_final.pkl
+
isolation_forest_final_threshold.pkl
```

The Isolation Forest model and threshold should always be deployed together.

---

# 26. Important Deployment Requirements

The inference system must provide exactly the same 12 features used during training.

The feature order must remain:

```python
[
    "Signal1_RPM",
    "Signal2_FuelFlow",
    "Signal3_Torque",
    "Signal4_OilTemp",
    "Signal5_OilPressure",
    "Signal6_CHT",
    "Signal8_EGT",
    "Signal9_Vibration",
    "Throttle",
    "EngineLoad",
    "Altitude_m",
    "AmbientTemp_C"
]
```

Do not:

* Add `FaultID`
* Add `FaultName`
* Add `Signal7_FaultID`
* Add `ScenarioID`
* Add `RunID`
* Add `RepeatID`
* Change feature order
* Apply a scaler that was not used during training
* Replace missing values with arbitrary values without defining a consistent preprocessing policy

---

# 27. Model Responsibilities

The models have different responsibilities.

### XGBoost

```text
Known fault → Identify the fault
```

Example:

```text
Input
  ↓
Engine telemetry
  ↓
XGBoost
  ↓
Fault ID = 2
  ↓
Overheat
```

### Isolation Forest

```text
Abnormal behavior → Detect the anomaly
```

Example:

```text
Input
  ↓
Engine telemetry
  ↓
Isolation Forest
  ↓
Anomaly Score = 0.73
  ↓
0.73 > 0.450956
  ↓
ANOMALY
```

The Isolation Forest does not need to know the name of the fault to identify that the behavior is abnormal.

---

# 28. Current Model Status

## XGBoost

**Status: Strong baseline / ready for integration**

* ~96.6% test accuracy
* ~96.6% test macro-F1
* Strong performance across the four simulated fault classes
* Suitable for known-fault classification

## Isolation Forest

**Status: Strong anomaly-detection baseline / requires further improvement**

* 91.34% test fault recall
* 90.14% test F1
* 95.50% test PR-AUC
* Excellent detection for Torque Reduction, Overheat and Low Oil Pressure
* Weaker Fuel Flow Restriction detection
* High healthy false-alarm rate
* Needs temporal/contextual improvements before claiming production readiness

---

# 29. Current Limitations

These models were trained and evaluated using simulated aero piston engine data.

Therefore:

1. High performance on simulation data does not automatically guarantee equivalent performance on real engine telemetry.
2. The simulator currently represents only a limited number of fault mechanisms.
3. The Isolation Forest has a relatively high healthy false-alarm rate.
4. Fuel Flow Restriction is harder for the anomaly detector to identify.
5. True unknown-fault detection has not yet been experimentally proven with a completely held-out fault mechanism.
6. Sensor noise, sensor drift, real-world environmental effects, and hardware-specific behavior may differ from the simulator.
7. Current evaluation is primarily sample-level; simulation/event-level evaluation should also be performed.

---

# 30. Recommended Future Improvements

The next improvements should focus on the anomaly detector rather than simply increasing the number of Isolation Forest trees.

### 1. Temporal Features

Add features such as:

```text
RPM delta
EGT delta
CHT delta
Oil-pressure delta
Rolling RPM mean
Rolling RPM standard deviation
Rolling EGT mean
Rolling vibration RMS
Temperature slope
Oil-pressure slope
```

These allow the model to understand how the engine is changing over time.

### 2. Operating-Condition Normalization

Engine behavior naturally changes with:

```text
Altitude
Ambient temperature
Throttle
Engine load
```

A healthy engine at high altitude should not automatically look anomalous simply because its RPM/torque differs from ground operation.

### 3. Temporal Anomaly Aggregation

Instead of:

```text
One abnormal sample → immediate fault alarm
```

use something such as:

```text
Several consecutive anomalous samples
              ↓
        Confirm anomaly
```

This can significantly reduce transient-related false alarms.

### 4. Unknown-Fault Evaluation

Generate a completely new fault type and hold it out from model development.

This provides a stronger demonstration of unknown anomaly detection.

### 5. Autoencoder / LSTM

If temporal behavior becomes important, sequence-based models can be evaluated against the Isolation Forest.

---

# 31. Quick Reference

## XGBoost

```text
File:
xgboost_fault_classifier-v2.json

Input:
12 engine/operating features

Output:
Fault ID
Fault probabilities

Classes:
0 = Healthy
1 = Torque Reduction
2 = Overheat
3 = Low Oil Pressure
4 = Fuel Flow Restriction

Test:
Accuracy ≈ 96.6%
Macro-F1 ≈ 96.6%
```

## Isolation Forest

```text
Model:
anomaly_search/isolation_forest_final.pkl

Threshold:
anomaly_search/isolation_forest_final_threshold.pkl

Input:
12 engine/operating features

Output:
Anomaly score
Healthy / Anomaly

Threshold:
0.450956

Test:
Fault Recall = 91.34%
F1 = 90.14%
PR-AUC = 95.50%
Healthy FAR = 45.31%
```

---

# 32. Final Summary

The two models serve different purposes:

```text
                 ENGINE TELEMETRY
                        │
                        ▼
              ┌───────────────────┐
              │   12 FEATURES      │
              └─────────┬─────────┘
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
       ISOLATION FOREST         XGBOOST
       "Is it abnormal?"       "What fault?"
             │                     │
             ▼                     ▼
       Healthy/Anomaly          Fault ID
             │                     │
             └──────────┬──────────┘
                        ▼
```
