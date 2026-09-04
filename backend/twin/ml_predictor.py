"""
ML predictor for BE-2 Digital Twin — LSTM autoencoder anomaly scoring.

Architecture and feature-order details reverse-engineered from state_dict
inspection (ML teammate did not supply a model class or training script).
NOT confirmed by the ML team — see inline notes.
"""
import os
from pathlib import Path

import joblib
import numpy as np
import torch
import torch.nn as nn

from twin.schemas import MLPrediction  # adjust import path if your interface lives elsewhere
from twin.ml import MLPredictor

# --- paths -------------------------------------------------------------
_ARTIFACT_DIR = Path(__file__).parent.parent / "ml_artifacts"
_MODEL_PATH = _ARTIFACT_DIR / "anomaly_model.pth"
_SCALER_PATH = _ARTIFACT_DIR / "scaler.pkl"

# --- calibration constants (UNCALIBRATED GUESSES — no reference stats from ML team) ---
# Sigmoid: anomaly_score = 1 / (1 + exp(-K * (mse - MIDPOINT)))
# MIDPOINT is a guessed "typical healthy MSE" center point; K controls steepness.
# These need tuning once real healthy/faulty telemetry streams are observed in the demo.
_SIGMOID_K = 5.0
_SIGMOID_MIDPOINT = 1.0

# Scaler was fit on 8 features; model only takes 7 (torque excluded — see handoff doc).
_SCALER_FEATURE_ORDER = [
    "RPM", "FuelFlow", "Torque", "OilTemperature",
    "OilPressure", "CHT", "EGT", "Vibration",
]
_TORQUE_INDEX = _SCALER_FEATURE_ORDER.index("Torque")  # = 2

# Map from scaler's feature name -> telemetry_window dict key (per twin/service.py)
_FEATURE_TO_DICT_KEY = {
    "RPM": "rpm",
    "FuelFlow": "fuel_flow",
    "Torque": "torque",
    "OilTemperature": "oil_temperature",
    "OilPressure": "oil_pressure",
    "CHT": "cht",
    "EGT": "egt",
    "Vibration": "vibration",
}


class AnomalyAutoencoder(nn.Module):
    """
    LSTM autoencoder matching the state_dict shapes in anomaly_model.pth.
    encoder(7->64) -> to_latent(64->32) -> from_latent(32->64) -> decoder(64->64) -> output(64->7)
    """

    def __init__(self, input_size: int = 7, hidden_size: int = 64, latent_size: int = 32):
        super().__init__()
        self.encoder = nn.LSTM(input_size, hidden_size, num_layers=1, batch_first=True)
        self.to_latent = nn.Linear(hidden_size, latent_size)
        self.from_latent = nn.Linear(latent_size, hidden_size)
        self.decoder = nn.LSTM(hidden_size, hidden_size, num_layers=1, batch_first=True)
        self.output = nn.Linear(hidden_size, input_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, 7)
        seq_len = x.size(1)
        _, (h_n, _) = self.encoder(x)          # h_n: (1, batch, 64)
        latent = self.to_latent(h_n.squeeze(0))  # (batch, 32)
        expanded = self.from_latent(latent)      # (batch, 64)
        decoder_input = expanded.unsqueeze(1).repeat(1, seq_len, 1)  # (batch, seq_len, 64)
        decoder_out, _ = self.decoder(decoder_input)  # (batch, seq_len, 64)
        reconstruction = self.output(decoder_out)     # (batch, seq_len, 7)
        return reconstruction


# --- module-level singletons (loaded once at import, per existing pattern) ---
_model = AnomalyAutoencoder()
_state_dict = torch.load(_MODEL_PATH, map_location="cpu", weights_only=False)
_model.load_state_dict(_state_dict)
_model.eval()

_scaler = joblib.load(_SCALER_PATH)


def _sigmoid_score(mse: float) -> float:
    return float(1.0 / (1.0 + np.exp(-_SIGMOID_K * (mse - _SIGMOID_MIDPOINT))))


class ModelPredictor(MLPredictor):
    """Implements the MLPredictor interface (twin/ml.py) using the LSTM autoencoder."""

    def predict(self, telemetry_window: list[dict]) -> MLPrediction:
        # 1. Build (60, 8) array in scaler's exact fitted column order, mapping by key name.
        raw = np.array(
            [
                [sample[_FEATURE_TO_DICT_KEY[feat]] for feat in _SCALER_FEATURE_ORDER]
                for sample in telemetry_window
            ],
            dtype=np.float64,
        )  # shape (60, 8)

        # 2. Scale all 8 columns (StandardScaler requires the exact fitted feature count/order).
        scaled = _scaler.transform(raw)  # (60, 8)

        # 3. Drop Torque column (index 2) from the SCALED output -> (60, 7).
        scaled_7 = np.delete(scaled, _TORQUE_INDEX, axis=1)

        # 4. To tensor, add batch dim -> (1, 60, 7)
        input_tensor = torch.tensor(scaled_7, dtype=torch.float32).unsqueeze(0)

        # 5. Forward pass, no grad needed at inference.
        with torch.no_grad():
            reconstruction = _model(input_tensor)  # (1, 60, 7)

        # 6. Reconstruction MSE.
        mse = torch.mean((input_tensor - reconstruction) ** 2).item()

        # 7. Sigmoid calibration -> [0, 1].
        anomaly_score = _sigmoid_score(mse)

        # No classifier head, no RUL head in this state_dict -> honestly None, not faked.
        # confidence also has no basis from this model — flagged, left at 0.0.
        return MLPrediction(
            anomaly_score=anomaly_score,
            fault=None,
            confidence=0.0,
            rul_hours=None,
        )