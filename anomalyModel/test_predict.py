import numpy as np
import joblib
from tensorflow.keras.models import load_model
from xgboost import XGBClassifier
import os
import warnings

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings("ignore")

current_dir = os.path.dirname(os.path.abspath(__file__))

# Load models and scalers directly for testing
try:
    autoencoder_scaler = joblib.load(os.path.join(current_dir, "autoencoder_scaler_v2.pkl"))
    # Load threshold if present, else default to 1.11 as seen in training
    try:
        autoencoder_threshold = float(joblib.load(os.path.join(current_dir, "autoencoder_threshold.pkl")))
    except:
        autoencoder_threshold = 1.11
    
    autoencoder_model = load_model(os.path.join(current_dir, "autoencoder_anomaly_model-v3.h5"), compile=False)
    
    xgboost_model = XGBClassifier()
    xgboost_model.load_model(os.path.join(current_dir, "xgboost_new_classifier.json"))
except Exception as e:
    print(f"Warning: Failed to load models: {e}")

FAULT_NAMES = {
    0: "Healthy",
    1: "Torque Reduction",
    2: "Overheat",
    3: "Low Oil Pressure",
    4: "Fuel Flow Restriction",
    5: "Spark Plug Degradation",
    6: "Air Filter Clogged",
    7: "Fuel Injector Partial Block",
    8: "Combustion Instability",
    9: "Bearing Wear (Vibration)"
}

def predict(features_dict):
    feature_names = [
        'rpm_res', 'egt_res', 'cht_res', 'oil_press_res', 'oil_temp_res', 'battery_res',
        'fuel_ratio', 'rpm_res_smooth', 'cht_diff_10s',
        'rpm_res_diff_60s', 'egt_res_diff_60s', 'oil_press_res_diff_60s', 'vibration_diff_60s', 'throttle_diff_60s',
        'rpm_res_mean_60s', 'egt_res_mean_60s', 'oil_press_res_mean_60s',
        'vibration_rms', 'rpm_roughness', 'cht_roughness', 'torque_roughness',
        'throttle', 'injection_duration'
    ]
    
    import pandas as pd
    input_data_df = pd.DataFrame([features_dict], columns=feature_names)
    input_data_array = input_data_df.values
    
    # Autoencoder predict (expects array)
    input_scaled = autoencoder_scaler.transform(input_data_array)
    reconstruction = autoencoder_model.predict(input_scaled, verbose=0)
    anomaly_score = float(np.mean(np.power(input_scaled - reconstruction, 2)))
    
    # XGBoost predict (expects DataFrame if trained with feature names)
    fault_id = int(xgboost_model.predict(input_data_df)[0])
    fault_name = FAULT_NAMES.get(fault_id, f"Fault {fault_id}")
    
    is_anomaly = bool(anomaly_score > autoencoder_threshold)
    
    return {
        "anomaly_score": anomaly_score,
        "is_anomaly": is_anomaly,
        "fault_id": fault_id,
        "fault_name": fault_name
    }

def test():
    test_cases = [
        {
            "name": "Healthy",
            "expected_fault": "Healthy",
            "data": {
                "rpm_res": -0.33,
                "egt_res": 0.439,
                "cht_res": -0.369,
                "oil_press_res": 0.267,
                "oil_temp_res": 0.598,
                "battery_res": 0.132,
                "fuel_ratio": 0.266,
                "rpm_res_smooth": -0.794,
                "cht_diff_10s": -1.435,
                "rpm_res_diff_60s": -0.58,
                "egt_res_diff_60s": 0.313,
                "oil_press_res_diff_60s": 1.492,
                "vibration_diff_60s": -0.174,
                "throttle_diff_60s": 0.0,
                "rpm_res_mean_60s": -0.843,
                "egt_res_mean_60s": 1.096,
                "oil_press_res_mean_60s": -0.08,
                "vibration_rms": 1.378,
                "rpm_roughness": 0.207,
                "cht_roughness": 0.71,
                "torque_roughness": 0.712,
                "throttle": 0.948,
                "injection_duration": 9.546
            }
        },
        {
            "name": "Fault 1 (Torque Reduction)",
            "expected_fault": "Torque Reduction",
            "data": {
                "rpm_res": -355.36,
                "egt_res": -33.846,
                "cht_res": 1.642,
                "oil_press_res": -6.1,
                "oil_temp_res": -0.119,
                "battery_res": 0.018,
                "fuel_ratio": 0.199,
                "rpm_res_smooth": -332.842,
                "cht_diff_10s": -0.441,
                "rpm_res_diff_60s": -276.21,
                "egt_res_diff_60s": -26.881,
                "oil_press_res_diff_60s": -5.027,
                "vibration_diff_60s": 1.209,
                "throttle_diff_60s": 0.0,
                "rpm_res_mean_60s": -217.01,
                "egt_res_mean_60s": -22.689,
                "oil_press_res_mean_60s": -3.347,
                "vibration_rms": 1.697,
                "rpm_roughness": 28.367,
                "cht_roughness": 0.496,
                "torque_roughness": 0.778,
                "throttle": 0.913,
                "injection_duration": 8.937
            }
        },
        {
            "name": "Fault 2 (Overheat)",
            "expected_fault": "Overheat",
            "data": {
                "rpm_res": -0.34,
                "egt_res": 97.898,
                "cht_res": 30.797,
                "oil_press_res": -0.588,
                "oil_temp_res": 12.951,
                "battery_res": -0.02,
                "fuel_ratio": 0.234,
                "rpm_res_smooth": -0.34,
                "cht_diff_10s": 2.225,
                "rpm_res_diff_60s": -0.39,
                "egt_res_diff_60s": 51.771,
                "oil_press_res_diff_60s": -1.075,
                "vibration_diff_60s": -3.683,
                "throttle_diff_60s": 0.0,
                "rpm_res_mean_60s": -0.369,
                "egt_res_mean_60s": 72.514,
                "oil_press_res_mean_60s": -0.112,
                "vibration_rms": 1.616,
                "rpm_roughness": 0.185,
                "cht_roughness": 0.817,
                "torque_roughness": 0.765,
                "throttle": 0.948,
                "injection_duration": 8.844
            }
        },
        {
            "name": "Fault 3 (Low Oil Pressure)",
            "expected_fault": "Low Oil Pressure",
            "data": {
                "rpm_res": 2.64,
                "egt_res": 0.239,
                "cht_res": -0.587,
                "oil_press_res": -38.122,
                "oil_temp_res": 60.484,
                "battery_res": 0.055,
                "fuel_ratio": 0.267,
                "rpm_res_smooth": 2.494,
                "cht_diff_10s": -1.125,
                "rpm_res_diff_60s": -0.59,
                "egt_res_diff_60s": -0.643,
                "oil_press_res_diff_60s": -25.694,
                "vibration_diff_60s": -3.344,
                "throttle_diff_60s": 0.0,
                "rpm_res_mean_60s": 2.556,
                "egt_res_mean_60s": 0.65,
                "oil_press_res_mean_60s": -25.134,
                "vibration_rms": 1.468,
                "rpm_roughness": 0.242,
                "cht_roughness": 0.664,
                "torque_roughness": 0.416,
                "throttle": 0.999,
                "injection_duration": 9.36
            }
        },
        {
            "name": "Fault 4 (Fuel Flow Restriction)",
            "expected_fault": "Fuel Flow Restriction",
            "data": {
                "rpm_res": -2322.52,
                "egt_res": -422.294,
                "cht_res": -22.1,
                "oil_press_res": -34.258,
                "oil_temp_res": 1.966,
                "battery_res": -3.061,
                "fuel_ratio": 0.078,
                "rpm_res_smooth": -2324.51,
                "cht_diff_10s": -4.622,
                "rpm_res_diff_60s": -1062.04,
                "egt_res_diff_60s": -134.035,
                "oil_press_res_diff_60s": -15.396,
                "vibration_diff_60s": 0.183,
                "throttle_diff_60s": 0.0,
                "rpm_res_mean_60s": -2094.488,
                "egt_res_mean_60s": -399.85,
                "oil_press_res_mean_60s": -31.551,
                "vibration_rms": 1.684,
                "rpm_roughness": 0.3,
                "cht_roughness": 0.882,
                "torque_roughness": 0.728,
                "throttle": 0.948,
                "injection_duration": 3.081
            }
        }
    ]

    for tc in test_cases:
        print(f"--- Running Test Case: {tc['name']} ---")
        try:
            result = predict(tc['data'])
            print(f"Expected: {tc['expected_fault']}")
            print(f"Actual:   {result['fault_name']} (ID: {result['fault_id']})")
            print(f"Anomaly Score: {result['anomaly_score']:.4f} (Is Anomaly: {result['is_anomaly']})")
            print("-" * 50)
        except Exception as e:
            print(f"Prediction failed with error: {e}")

def manual_mode():
    import json
    print("\n" + "="*50)
    print("MANUAL TESTING MODE")
    print("="*50)
    print("Paste your custom feature data as a JSON dictionary.")
    print("It can be multiple lines. Once valid JSON is formed, it will evaluate.")
    print("Type 'exit' or 'quit' on a new line to stop.")
    
    accumulated_input = ""
    while True:
        try:
            line = input()
            if line.strip().lower() in ['exit', 'quit']:
                break
            
            accumulated_input += line + "\n"
            
            if not accumulated_input.strip():
                continue
                
            try:
                features_dict = json.loads(accumulated_input)
                # If we get here, it parsed successfully!
                result = predict(features_dict)
                print("\n--- Prediction Results ---")
                print(f"Actual Fault:   {result['fault_name']} (ID: {result['fault_id']})")
                print(f"Anomaly Score:  {result['anomaly_score']:.4f} (Is Anomaly: {result['is_anomaly']})")
                print("-" * 50)
                # Reset for the next input
                accumulated_input = ""
                print("\nPaste next JSON data (or 'exit'): ")
                
            except json.JSONDecodeError:
                # Still incomplete JSON, wait for more lines
                pass
                
        except KeyError as e:
            print(f"Error: Missing feature key {e} in provided JSON.")
            accumulated_input = ""
        except Exception as e:
            print(f"Prediction failed with error: {e}")
            accumulated_input = ""

if __name__ == "__main__":
    print("1. Run predefined tests")
    print("2. Enter manual mode (copy/paste JSON)")
    choice = input("Select an option (1/2) [1]: ").strip()
    
    if choice == '2':
        manual_mode()
    else:
        test()

