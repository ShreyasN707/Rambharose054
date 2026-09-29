from main import EngineTelemetry, predict
import json

def test():
    test_cases = [
    {
        "name": "Healthy",
        "expected_fault": "Healthy",
        "data": {
            "rpm": 3272.0286,
            "fuel_flow": 1.9987,
            "torque": 8.8713,
            "oil_temperature": 56.5001,
            "oil_pressure": 50.4907,
            "cht": 30.6931,
            "egt": 508.7748,
            "vibration": 3.5734,
            "throttle": 0.7755,
            "engine_load": 0.4526,
            "altitude": 765.5168,
            "ambient_temperature": 31.928
        }
    },
    {
        "name": "Fault 1 (Misfire / Torque Reduction)",
        "expected_fault": "Torque Reduction",
        "data": {
            "rpm": 2312.5605,
            "fuel_flow": 1.5045,
            "torque": 6.0483,
            "oil_temperature": 53.4822,
            "oil_pressure": 36.0953,
            "cht": 29.8569,
            "egt": 396.6332,
            "vibration": 2.628,
            "throttle": 0.6449,
            "engine_load": 0.6138,
            "altitude": 291.5703,
            "ambient_temperature": 29.053
        }
    },
    {
        "name": "Fault 2 (Overheating)",
        "expected_fault": "Overheat",
        "data": {
            "rpm": 3073.1126,
            "fuel_flow": 1.8909,
            "torque": 8.2587,
            "oil_temperature": 73.9234,
            "oil_pressure": 47.4912,
            "cht": 35.8949,
            "egt": 604.9052,
            "vibration": 2.0516,
            "throttle": 0.6366,
            "engine_load": 0.5459,
            "altitude": 10.9791,
            "ambient_temperature": 28.5989
        }
    },
    {
        "name": "Fault 3 (Oil pressure failure)",
        "expected_fault": "Low Oil Pressure",
        "data": {
            "rpm": 3062.0191,
            "fuel_flow": 1.863,
            "torque": 8.1595,
            "oil_temperature": 83.0251,
            "oil_pressure": 43.7115,
            "cht": 30.3952,
            "egt": 479.9418,
            "vibration": 2.9638,
            "throttle": 0.6333,
            "engine_load": 0.4847,
            "altitude": 30.389,
            "ambient_temperature": 31.298
        }
    },
    {
        "name": "Fault 4 (Fuel starvation)",
        "expected_fault": "Fuel Flow Restriction",
        "data": {
            "rpm": 3001.7593,
            "fuel_flow": 1.6996,
            "torque": 7.9379,
            "oil_temperature": 97.2889,
            "oil_pressure": 46.4452,
            "cht": 30.0002,
            "egt": 454.9595,
            "vibration": 2.1071,
            "throttle": 0.7193,
            "engine_load": 0.4986,
            "altitude": 889.9042,
            "ambient_temperature": 27.5212
        }
    }
]

    for tc in test_cases:
        d = tc["data"]
        telemetry = EngineTelemetry(
            Signal1_RPM=d["rpm"],
            Signal2_FuelFlow=d["fuel_flow"],
            Signal3_Torque=d["torque"],
            Signal4_OilTemp=d["oil_temperature"],
            Signal5_OilPressure=d["oil_pressure"],
            Signal6_CHT=d["cht"],
            Signal8_EGT=d["egt"],
            Signal9_Vibration=d["vibration"],
            Throttle=d["throttle"],
            EngineLoad=d["engine_load"],
            Altitude_m=d["altitude"],
            AmbientTemp_C=d["ambient_temperature"]
        )

        print(f"--- Running Test Case: {tc['name']} ---")
        try:
            result = predict(telemetry)
            print(f"Expected: {tc['expected_fault']}")
            print(f"Actual:   {result['fault_name']} (ID: {result['fault_id']})")
            print(f"Anomaly Score: {result['anomaly_score']:.4f} (Is Anomaly: {result['is_anomaly']})")
            print("-" * 50)
        except Exception as e:
            print(f"Prediction failed with error: {e}")

if __name__ == "__main__":
    test()

