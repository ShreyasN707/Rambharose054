import os
import paho.mqtt.client as mqtt

BROKER = "127.0.0.1"
PORT = 1883
TOPIC = "engine/engine_001/fault"
STATE_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "fault_state.txt"
)


def on_connect(client, userdata, flags, rc):
    print(f"[MQTT] Connected with result code {rc}")
    client.subscribe(TOPIC, qos=1)
    print(f"[MQTT] Listening on {TOPIC}")


def on_message(client, userdata, message):
    try:
        fault_id = int(message.payload.decode().strip())

        if fault_id in (0, 1, 2, 3, 4):
            with open(STATE_FILE, "w") as f:
                f.write(str(fault_id))

            print(f"[MQTT] Fault changed to {fault_id}")

    except (ValueError, UnicodeDecodeError) as e:
        print(f"[MQTT] Invalid fault command: {e}")


client = mqtt.Client()

client.on_connect = on_connect
client.on_message = on_message

# Start with healthy state
with open(STATE_FILE, "w") as f:
    f.write("0")

client.connect(BROKER, PORT, 60)

print("========================================")
print("FAULT LISTENER STARTED")
print("========================================")

client.loop_forever()