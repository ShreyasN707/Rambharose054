from main import EngineTelemetry, predict
import json

def test():
    # Create sample dummy engine telemetry data
    sample_data = EngineTelemetry(
        Signal1_RPM=1274.2598,
        Signal2_FuelFlow=0.6647,
        Signal3_Torque=4.6828,
        Signal4_OilTemp=25.5716,
        Signal5_OilPressure=19.8175,
        Signal6_CHT=15.3324,
        Signal8_EGT=151.0801,
        Signal9_Vibration=0.9323,
        Throttle=0.6386,
        EngineLoad=0.3528,
        Altitude_m=942.0506,
        AmbientTemp_C=34.3420
    )


    print("--- Input Telemetry Data ---")
    print(sample_data.model_dump_json(indent=2))
    
    print("\n--- Running Prediction ---")
    try:
        result = predict(sample_data)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Prediction failed with error: {e}")

if __name__ == "__main__":
    test()
