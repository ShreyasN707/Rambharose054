import paho.mqtt.client as mqtt
from pydantic import ValidationError

from database import SessionLocal, engine
from models import Base
from repository import TelemetryRepository
from schemas import TelemetryCreate
from service import TelemetryService


BROKER_HOST = "localhost"
BROKER_PORT = 1883
TOPIC = "engine/+/telemetry"


# Create database tables
Base.metadata.create_all(bind=engine)


repository = TelemetryRepository()
service = TelemetryService(repository)


def on_connect(
    client,
    userdata,
    flags,
    reason_code,
    properties,
):
    print("Connected to MQTT broker")

    client.subscribe(TOPIC)

    print(f"Subscribed to: {TOPIC}")


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode("utf-8")
        telemetry = TelemetryCreate.model_validate_json(payload)

    except UnicodeDecodeError:
        print("Invalid UTF-8 payload")
        return

    except ValidationError as error:
        print(f"Invalid telemetry: {error}")
        return

    try:
        with SessionLocal.begin() as session:
            service.process(session, telemetry)

        print(f"Telemetry stored: {telemetry.engine_id}")

    except Exception as error:
        print(f"Telemetry processing failed: {error}")


def main():
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2
    )

    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(
        BROKER_HOST,
        BROKER_PORT,
    )

    print("Waiting for telemetry...")

    try:
        client.loop_forever()
    finally:
        client.disconnect()

try:
    stored = service.process(session, telemetry)

    if stored:
        print(f"Telemetry stored: {telemetry.engine_id}")
    else:
        print(f"Duplicate telemetry ignored: {telemetry.engine_id}")

except Exception as error:
    print(f"Telemetry processing failed: {error}")

if __name__ == "__main__":
    main()