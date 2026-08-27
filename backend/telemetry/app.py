import paho.mqtt.client as mqtt

BROKER_HOST = "localhost"
BROKER_PORT = 1883
TOPIC = "engine/+/telemetry"


def on_connect(client, userdata, flags, reason_code, properties):
    print("Connected to MQTT broker")

    client.subscribe(TOPIC)

    print(f"Subscribed to: {TOPIC}")


def on_message(client, userdata, msg):
    print(f"Topic: {msg.topic}")
    print(f"Payload: {msg.payload.decode()}")


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

client.on_connect = on_connect
client.on_message = on_message

client.connect(BROKER_HOST, BROKER_PORT)

print("Waiting for telemetry...")

client.loop_forever()