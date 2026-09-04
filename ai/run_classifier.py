import torch
import numpy as np

from fault_classifier import GRUClassifier


MODEL_FILE = "fault_classifier.pt"

FEATURES = [
    "RPM",
    "FuelFlow",
    "Torque",
    "OilTemperature",
    "OilPressure",
    "CHT",
    "EGT",
    "Vibration"
]

FAULT_NAMES = {
    0: "HEALTHY",
    1: "MISFIRE",
    2: "OVERHEATING",
    3: "OIL_PRESSURE_FAILURE",
    4: "FUEL_STARVATION"
}

SEQUENCE_LENGTH = 50


# -------------------------
# Load model
# -------------------------

model = GRUClassifier(
    n_features=8,
    hidden=96,
    n_classes=5
)

checkpoint = torch.load(
    MODEL_FILE,
    map_location="cpu"
)

model.load_state_dict(
    checkpoint["model_state_dict"]
)

model.eval()


# -------------------------
# Predict
# -------------------------

def predict_engine(telemetry):

    """
    telemetry must contain 50 consecutive samples.

    Shape:
        50 samples × 8 features
    """

    X = np.array(
        [
            [
                row["RPM"],
                row["FuelFlow"],
                row["Torque"],
                row["OilTemperature"],
                row["OilPressure"],
                row["CHT"],
                row["EGT"],
                row["Vibration"]
            ]
            for row in telemetry
        ],
        dtype=np.float32
    )

    if X.shape != (50, 8):
        raise ValueError(
            f"Expected 50 samples × 8 features, got {X.shape}"
        )

    X = torch.tensor(
        X,
        dtype=torch.float32
    ).unsqueeze(0)

    with torch.no_grad():

        probabilities = torch.softmax(
            model(X),
            dim=1
        )

        confidence, fault_id = probabilities.max(
            dim=1
        )

    fault_id = int(fault_id.item())
    confidence = float(confidence.item())

    return {
        "is_anomaly": fault_id != 0,
        "fault_id": fault_id,
        "fault": FAULT_NAMES[fault_id],
        "confidence": confidence
    }


# -------------------------
# Example
# -------------------------

telemetry = [
    {
        "RPM": 3000,
        "FuelFlow": 2.4,
        "Torque": 8.5,
        "OilTemperature": 95,
        "OilPressure": 55,
        "CHT": 50,
        "EGT": 700,
        "Vibration": 1.2
    }
] * 50

print(telemetry)

result = predict_engine(telemetry)

print(result)