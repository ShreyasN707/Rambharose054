from fastapi import FastAPI, HTTPException
import subprocess
import os
import signal
import paho.mqtt.client as mqtt

app = FastAPI(title="Simulink Controller")

SIMULINK_DIR = "/home/vedanth/Projects/Rambharose054/simulink"
START_COMMAND = ["./start_simulation.sh"]

MQTT_BROKER = "127.0.0.1"
MQTT_PORT = 1883
FAULT_TOPIC = "engine/engine_001/fault"

simulation_process = None


def reset_fault():
    client = mqtt.Client()

    try:
        client.connect(
            MQTT_BROKER,
            MQTT_PORT,
            60,
        )

        client.loop_start()

        message = client.publish(
            FAULT_TOPIC,
            "0",
            qos=1,
        )

        message.wait_for_publish()

        client.loop_stop()
        client.disconnect()

    except Exception:
        client.loop_stop()
        client.disconnect()
        raise


@app.get("/simulation/status")
def simulation_status():
    global simulation_process

    if simulation_process is None:
        return {
            "status": "stopped"
        }

    if simulation_process.poll() is None:
        return {
            "status": "running",
            "pid": simulation_process.pid
        }

    simulation_process = None

    return {
        "status": "stopped"
    }


@app.post("/simulation/start")
def start_simulation():
    global simulation_process

    # Already running
    if (
        simulation_process is not None
        and simulation_process.poll() is None
    ):
        return {
            "status": "already_running",
            "pid": simulation_process.pid
        }

    # Reset engine to healthy before starting
    try:
        reset_fault()

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to reset engine fault: {exc}",
        )

    try:
        simulation_process = subprocess.Popen(
            START_COMMAND,
            cwd=SIMULINK_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start simulation: {exc}",
        )

    return {
        "status": "started",
        "pid": simulation_process.pid,
        "fault_id": 0,
    }


@app.post("/simulation/stop")
def stop_simulation():
    global simulation_process

    if (
        simulation_process is None
        or simulation_process.poll() is not None
    ):
        simulation_process = None

        return {
            "status": "not_running"
        }

    try:
        os.killpg(
            os.getpgid(simulation_process.pid),
            signal.SIGINT,
        )

        simulation_process = None

        return {
            "status": "stopped"
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to stop simulation: {exc}",
        )