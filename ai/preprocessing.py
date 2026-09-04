import numpy as np
import pandas as pd
import torch


FEATURES = [
    "RPM",
    "FuelFlow",
    "Torque",
    "OilTemperature",
    "OilPressure",
    "CHT",
    "EGT",
    "Vibration",
]


def load_dataset(path):
    df = pd.read_csv(path)

    df = df.replace(
        [np.inf, -np.inf],
        np.nan
    )

    df = df.dropna(
        subset=FEATURES + ["Fault_ID"]
    )

    return df


def make_sequences(x, seq_len=50, stride=5):
    x = np.asarray(
        x,
        dtype=np.float32
    )

    if len(x) < seq_len:
        return np.empty(
            (0, seq_len, x.shape[1]),
            dtype=np.float32
        )

    sequences = []

    for i in range(
        0,
        len(x) - seq_len + 1,
        stride
    ):
        sequences.append(
            x[i:i + seq_len]
        )

    return np.stack(sequences).astype(
        np.float32
    )


def device():
    return torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )
