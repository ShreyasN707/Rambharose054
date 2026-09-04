import pandas as pd
import numpy as np
import torch

from ai.fault_classifier import GRUClassifier, train


TRAIN_FILE = "/home/skm/Downloads/chess/ai/aero_engine_ai_pytorch_readable/data/train.csv"
VAL_FILE = "/home/skm/Downloads/chess/ai/aero_engine_ai_pytorch_readable/data/val.csv"
MODEL_FILE = "/home/skm/Downloads/chess/ai/aero_engine_ai_pytorch_readable/data/fault_classifier.pt"

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

SEQUENCE_LENGTH = 50
STRIDE = 5


def make_sequences(df):

    X = []
    y = []

    # IMPORTANT: never create sequences across different runs
    for run_id, run_df in df.groupby("RunID"):

        data = run_df[FEATURES].values.astype(np.float32)
        labels = run_df["FaultID"].values

        for start in range(
            0,
            len(data) - SEQUENCE_LENGTH + 1,
            STRIDE
        ):

            end = start + SEQUENCE_LENGTH

            X.append(data[start:end])

            # Label the sequence using its fault ID
            y.append(int(labels[start]))

    return np.array(X), np.array(y)


# =========================
# LOAD DATA
# =========================

train_df = pd.read_csv(TRAIN_FILE)
val_df = pd.read_csv(VAL_FILE)

print("Train rows:", len(train_df))
print("Validation rows:", len(val_df))


# =========================
# CREATE SEQUENCES
# =========================

X_train, y_train = make_sequences(train_df)
X_val, y_val = make_sequences(val_df)

print("\nTraining sequences:", X_train.shape)
print("Validation sequences:", X_val.shape)

print("\nTraining classes:")
print(np.bincount(y_train))

print("\nValidation classes:")
print(np.bincount(y_val))


# =========================
# CREATE MODEL
# =========================

model = GRUClassifier(
    n_features=len(FEATURES),
    hidden=96,
    n_classes=5
)


# =========================
# TRAIN
# =========================

print("\nStarting classifier training...\n")

model = train(
    model,
    X_train,
    y_train,
    epochs=25,
    batch_size=128,
    learning_rate=1e-3
)


# =========================
# SAVE
# =========================

torch.save(
    {
        "model_state_dict": model.state_dict(),
        "features": FEATURES,
        "sequence_length": SEQUENCE_LENGTH
    },
    MODEL_FILE
)

print("\n==============================")
print("CLASSIFIER TRAINING COMPLETE")
print("==============================")

print("Model saved to:")
print(MODEL_FILE)