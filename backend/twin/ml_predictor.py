from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from xgboost import XGBClassifier

from twin.ml import MLPredictor
from twin.ml_models.rul.predictor import predict_rul
from twin.schemas import MLPrediction


# ---------------------------------------------------------------------------
# Model paths
# ---------------------------------------------------------------------------

_MODEL_DIR = Path(__file__).parent / "ml_models" / "anomaly"

_AUTOENCODER_PATH = _MODEL_DIR / "autoencoder_anomaly_model.h5"
_SCALER_PATH = _MODEL_DIR / "autoencoder_scaler.pkl"
_THRESHOLD_PATH = _MODEL_DIR / "autoencoder_threshold.pkl"
_XGBOOST_PATH = _MODEL_DIR / "xgboost_fault_classifier_realistic.json"


# ---------------------------------------------------------------------------
# Feature definitions
# ---------------------------------------------------------------------------

FEATURES = [
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
    "AmbientTemp_C",
]

FAULT_NAMES = {
    0: "Healthy",
    1: "Misfire",
    2: "Overheating",
    3: "Oil Pressure Failure",
    4: "Fuel Starvation",
}


# ---------------------------------------------------------------------------
# Load models once
# ---------------------------------------------------------------------------

_autoencoder_scaler = joblib.load(_SCALER_PATH)
_autoencoder_threshold = joblib.load(_THRESHOLD_PATH)

_autoencoder_model = tf.keras.models.load_model(
    _AUTOENCODER_PATH,
    compile=False,
)

_xgboost_model = XGBClassifier()
_xgboost_model.load_model(_XGBOOST_PATH)


# ---------------------------------------------------------------------------
# Predictor
# ---------------------------------------------------------------------------

class ModelPredictor(MLPredictor):

    @staticmethod
    def _clamp(
        value: float,
        minimum: float = 0.0,
        maximum: float = 1.0,
    ) -> float:
        return max(
            minimum,
            min(maximum, value),
        )

    def _adjust_rul(
        self,
        raw_rul: float | None,
        fault_id: int,
        telemetry: dict,
    ) -> float | None:

        if raw_rul is None:
            return None

        # Healthy engine:
        # Do not alter the GRU prediction.
        if fault_id == 0:
            return round(raw_rul, 2)

        rpm = telemetry["rpm"]
        torque = telemetry["torque"]
        fuel_flow = telemetry["fuel_flow"]
        oil_temperature = telemetry["oil_temperature"]
        oil_pressure = telemetry["oil_pressure"]
        cht = telemetry["cht"]
        egt = telemetry["egt"]

        severity = 0.0

        # ---------------------------------------------------------------
        # Fault 1: Misfire
        #
        # Healthy:
        #   RPM    ~3994
        #   Torque ~9-10
        #   EGT    ~708
        #
        # Fault:
        #   RPM    ~3150
        #   Torque ~5-7
        #   EGT    ~605
        # ---------------------------------------------------------------
        if fault_id == 1:

            rpm_loss = self._clamp(
                (4000.0 - rpm) / 1000.0
            )

            torque_loss = self._clamp(
                (10.0 - torque) / 5.0
            )

            egt_loss = self._clamp(
                (700.0 - egt) / 150.0
            )

            severity = (
                0.40 * rpm_loss
                + 0.35 * torque_loss
                + 0.25 * egt_loss
            )

        # ---------------------------------------------------------------
        # Fault 2: Overheating
        #
        # Healthy:
        #   CHT       ~75
        #   EGT       ~708
        #   Oil temp  ~105
        #
        # Fault:
        #   CHT       ~115+
        #   EGT       ~1000+
        #   Oil temp  ~130+
        # ---------------------------------------------------------------
        elif fault_id == 2:

            cht_rise = self._clamp(
                (cht - 75.0) / 45.0
            )

            egt_rise = self._clamp(
                (egt - 710.0) / 350.0
            )

            oil_temp_rise = self._clamp(
                (oil_temperature - 105.0) / 40.0
            )

            severity = (
                0.30 * cht_rise
                + 0.45 * egt_rise
                + 0.25 * oil_temp_rise
            )

        # ---------------------------------------------------------------
        # Fault 3: Oil pressure failure
        #
        # Healthy:
        #   Oil pressure ~60 psi
        #
        # Fault:
        #   Oil pressure ~10-13 psi
        #   Oil temperature rises substantially
        # ---------------------------------------------------------------
        elif fault_id == 3:

            pressure_loss = self._clamp(
                (60.0 - oil_pressure) / 50.0
            )

            oil_temp_rise = self._clamp(
                (oil_temperature - 105.0) / 40.0
            )

            severity = (
                0.75 * pressure_loss
                + 0.25 * oil_temp_rise
            )

        # ---------------------------------------------------------------
        # Fault 4: Fuel starvation
        #
        # Healthy:
        #   Fuel flow ~3
        #   RPM      ~4000
        #   Torque   ~10
        #
        # Fault:
        #   Fuel flow ~0.3-0.5
        #   RPM      ~1700-3000
        #   Torque   ~1-6
        # ---------------------------------------------------------------
        elif fault_id == 4:

            fuel_loss = self._clamp(
                (3.0 - fuel_flow) / 2.7
            )

            rpm_loss = self._clamp(
                (4000.0 - rpm) / 2500.0
            )

            torque_loss = self._clamp(
                (10.0 - torque) / 9.0
            )

            severity = (
                0.45 * fuel_loss
                + 0.35 * rpm_loss
                + 0.20 * torque_loss
            )

        severity = self._clamp(severity)

        # ---------------------------------------------------------------
        # Convert telemetry severity into an RUL reduction.
        #
        # The GRU remains the base prediction.
        # At maximum severity we retain 15% of the raw RUL.
        # ---------------------------------------------------------------

        MAX_RUL_REDUCTION = 0.85

        corrected_rul = raw_rul * (
            1.0
            - MAX_RUL_REDUCTION * severity
        )

        return round(
            max(0.1, corrected_rul),
            2,
        )

    def predict(
        self,
        telemetry_window: list[dict],
    ) -> MLPrediction:

        if not telemetry_window:
            raise ValueError("telemetry_window cannot be empty")

        # The anomaly/fault models predict from the latest telemetry sample.
        # The RUL model uses the full telemetry window.
        telemetry = telemetry_window[-1]

        # -------------------------------------------------------------------
        # Map Backend telemetry -> model input
        # -------------------------------------------------------------------

        rpm = telemetry["rpm"]
        fuel_flow = telemetry["fuel_flow"]
        torque = telemetry["torque"]
        oil_temperature = telemetry["oil_temperature"]
        oil_pressure = telemetry["oil_pressure"]
        cht = telemetry["cht"]
        egt = telemetry["egt"]
        vibration = telemetry["vibration"]

        throttle = telemetry["throttle"]
        engine_load = telemetry["engine_load"]
        altitude = telemetry["altitude"]
        ambient_temperature = telemetry["ambient_temperature"]

        # -------------------------------------------------------------------
        # Derived features used by the trained models
        # -------------------------------------------------------------------

        cht_above_ambient = cht - ambient_temperature

        cht_oiltemp_ratio = (
            cht / (oil_temperature + 1e-6)
        )

        # -------------------------------------------------------------------
        # Autoencoder input
        #
        # The new autoencoder still expects the original 14 features.
        # -------------------------------------------------------------------

        autoencoder_feature_names = [
            "RPM",
            "FuelFlow",
            "Torque",
            "OilTemperature",
            "OilPressure",
            "CHT",
            "EGT",
            "Vibration",
            "CHT_above_Ambient",
            "CHT_OilTemp_Ratio",
            "Throttle",
            "EngineLoad",
            "Altitude",
            "AmbientTemp",
        ]

        autoencoder_features = pd.DataFrame(
            [[
                rpm,
                fuel_flow,
                torque,
                oil_temperature,
                oil_pressure,
                cht,
                egt,
                vibration,
                cht_above_ambient,
                cht_oiltemp_ratio,
                throttle,
                engine_load,
                altitude,
                ambient_temperature,
            ]],
            columns=autoencoder_feature_names,
        )

        # -------------------------------------------------------------------
        # Anomaly detection
        # -------------------------------------------------------------------

        input_scaled = _autoencoder_scaler.transform(
            autoencoder_features
        )

        reconstruction = _autoencoder_model.predict(
            input_scaled,
            verbose=0,
        )

        anomaly_score = float(
            np.mean(
                np.power(
                    input_scaled - reconstruction,
                    2,
                )
            )
        )

        is_anomaly = bool(
            anomaly_score > _autoencoder_threshold
        )

        # -------------------------------------------------------------------
        # Additional features required by the NEW 19-feature XGBoost model
        # -------------------------------------------------------------------

        oilt_above_ambient = (
            oil_temperature - ambient_temperature
        )

        egt_minus_cht = (
            egt - cht
        )

        fuelflow_per_rpm = (
            fuel_flow / (rpm + 1e-6)
        )

        torque_per_rpm = (
            torque / (rpm + 1e-6)
        )

        expected_power = (
            throttle * engine_load
        )

        # -------------------------------------------------------------------
        # XGBoost fault classification
        #
        # New model expects 19 features.
        # -------------------------------------------------------------------

        xgb_feature_names = [
            "RPM",
            "FuelFlow",
            "Torque",
            "OilTemperature",
            "OilPressure",
            "CHT",
            "EGT",
            "Vibration",
            "Throttle",
            "EngineLoad",
            "Altitude",
            "AmbientTemp",
            "CHT_above_Ambient",
            "CHT_OilTemp_Ratio",
            "OilT_above_Ambient",
            "EGT_minus_CHT",
            "FuelFlow_per_RPM",
            "Torque_per_RPM",
            "Expected_Power",
        ]

        xgb_features = pd.DataFrame(
            [[
                rpm,
                fuel_flow,
                torque,
                oil_temperature,
                oil_pressure,
                cht,
                egt,
                vibration,
                throttle,
                engine_load,
                altitude,
                ambient_temperature,
                cht_above_ambient,
                cht_oiltemp_ratio,
                oilt_above_ambient,
                egt_minus_cht,
                fuelflow_per_rpm,
                torque_per_rpm,
                expected_power,
            ]],
            columns=xgb_feature_names,
        )

        fault_id = int(
            _xgboost_model.predict(xgb_features)[0]
        )

        probabilities = _xgboost_model.predict_proba(
            xgb_features
        )[0]

        fault_name = FAULT_NAMES.get(
            fault_id,
            "Unknown",
        )

        confidence = float(
            probabilities[fault_id]
        )

        # Healthy = no fault
        fault = (
            None
            if fault_id == 0
            else fault_name
        )

        # -------------------------------------------------------------------
        # RUL prediction
        # -------------------------------------------------------------------

        raw_rul_hours = predict_rul(
            telemetry_window,
        )

        rul_hours = self._adjust_rul(
            raw_rul_hours,
            fault_id,
            telemetry,
        )

        print(
            f"[ML] rul_hours={rul_hours}"
        )

        return MLPrediction(
            anomaly_score=anomaly_score,
            fault=fault,
            confidence=confidence,
            rul_hours=rul_hours,
        )