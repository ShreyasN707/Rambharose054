import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib

INPUT_FILE = r"/home/skm/Downloads/chess/new matlab/Rambharose054/simulink/engine_digital_twin_dataset.csv"

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

df = pd.read_csv(INPUT_FILE)

rng = np.random.default_rng(42)

train_runs = []
val_runs = []
test_runs = []

# Stratified split: 4 train, 1 validation, 1 test per fault
for fault in sorted(df["FaultID"].unique()):

    fault_runs = df[df["FaultID"] == fault]["RunID"].unique()
    rng.shuffle(fault_runs)

    train_runs.extend(fault_runs[:4])
    val_runs.extend(fault_runs[4:5])
    test_runs.extend(fault_runs[5:6])

train_df = df[df["RunID"].isin(train_runs)].copy()
val_df = df[df["RunID"].isin(val_runs)].copy()
test_df = df[df["RunID"].isin(test_runs)].copy()

print("Split:")
print("Train:", len(train_df), "rows,", train_df["RunID"].nunique(), "runs")
print("Validation:", len(val_df), "rows,", val_df["RunID"].nunique(), "runs")
print("Test:", len(test_df), "rows,", test_df["RunID"].nunique(), "runs")

print("\nFault distribution:")

print("\nTrain:")
print(train_df["FaultID"].value_counts().sort_index())

print("\nValidation:")
print(val_df["FaultID"].value_counts().sort_index())

print("\nTest:")
print(test_df["FaultID"].value_counts().sort_index())

# Fit scaler ONLY on training data
scaler = StandardScaler()
scaler.fit(train_df[FEATURES])

train_df[FEATURES] = scaler.transform(train_df[FEATURES])
val_df[FEATURES] = scaler.transform(val_df[FEATURES])
test_df[FEATURES] = scaler.transform(test_df[FEATURES])

train_df.to_csv("../data/train.csv", index=False)
val_df.to_csv("../data/val.csv", index=False)
test_df.to_csv("../data/test.csv", index=False)

joblib.dump(scaler, "../data/scaler.pkl")

print("\nSaved:")
print("../data/train.csv")
print("../data/val.csv")
print("../data/test.csv")
print("../data/scaler.pkl")

print("\nDataset preparation complete.")