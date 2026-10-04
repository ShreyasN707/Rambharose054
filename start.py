"""Start or stop the whole digital twin on Linux, Windows or macOS.

    python start.py          # start (python3 on Linux/macOS)
    python start.py stop     # stop the simulation, controller and containers

Needs Docker (with Compose) and Python 3.8+. MATLAB is only needed to run
the simulation; the controller finds it on PATH, in the default install
folder, or through MATLAB_PATH in .env.
"""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SIM_DIR = os.path.join(PROJECT_DIR, "simulation")
CONTROLLER = os.path.join(SIM_DIR, "simulation_controller.py")
CONTROLLER_LOG = os.path.join(SIM_DIR, "simulation_controller.log")
CONTROLLER_PID = os.path.join(SIM_DIR, ".controller.pid")
ENV_FILE = os.path.join(PROJECT_DIR, ".env")
IS_WINDOWS = sys.platform == "win32"


def step(text):
    print(f"\n==> {text}", flush=True)


def fail(text):
    print(f"\nERROR: {text}", file=sys.stderr)
    sys.exit(1)


def port_open(port):
    with socket.socket() as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


def read_env():
    values = {}
    if os.path.isfile(ENV_FILE):
        with open(ENV_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    values[key.strip()] = value.strip().strip("\"'")
    return values


def compose(*args):
    return subprocess.run(["docker", "compose", *args], cwd=PROJECT_DIR).returncode


def check_docker():
    if shutil.which("docker") is None:
        fail("Docker is not installed or not on PATH.")
    if subprocess.run(["docker", "info"], capture_output=True).returncode != 0:
        fail("Docker is installed but not running. Start Docker and try again.")
    if subprocess.run(["docker", "compose", "version"], capture_output=True).returncode != 0:
        fail("Docker Compose v2 ('docker compose') is not available.")


def start_controller(env):
    if port_open(9000):
        print("Simulation controller already running on :9000.")
        return

    if IS_WINDOWS:
        detach = {
            "creationflags": subprocess.DETACHED_PROCESS
            | subprocess.CREATE_NEW_PROCESS_GROUP
            | subprocess.CREATE_NO_WINDOW
        }
    else:
        detach = {"start_new_session": True}

    with open(CONTROLLER_LOG, "w") as log:
        process = subprocess.Popen(
            [sys.executable, "-u", CONTROLLER],
            cwd=SIM_DIR,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            env={**os.environ, **env},
            **detach,
        )

    with open(CONTROLLER_PID, "w") as f:
        f.write(str(process.pid))

    for _ in range(20):
        if port_open(9000):
            break
        if process.poll() is not None:
            fail(f"Simulation controller exited; see {CONTROLLER_LOG}")
        time.sleep(0.25)

    with open(CONTROLLER_LOG) as log:
        for line in log:
            if line.startswith("MATLAB:"):
                print(line.rstrip())


def wait_for_api(timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen("http://localhost:8000/docs", timeout=2)
            return True
        except Exception:
            time.sleep(2)
    return False


def start():
    step("Checking Docker")
    check_docker()

    if not os.path.isfile(ENV_FILE):
        shutil.copy(os.path.join(PROJECT_DIR, ".env.example"), ENV_FILE)
        print("Created .env from .env.example (default local credentials).")

    env = read_env()
    if env.get("MATLAB_PATH"):
        os.environ["MATLAB_PATH"] = env["MATLAB_PATH"]

    step("Starting Docker services (the first run builds images and takes a while)")
    if compose("up", "-d") != 0:
        fail("docker compose up failed.")

    step("Starting simulation controller")
    start_controller({"MATLAB_PATH": env.get("MATLAB_PATH", "")})

    step("Waiting for the API")
    if not wait_for_api():
        print("The API is not answering yet; check it with: docker compose logs api")

    print(
        "\n========================================\n"
        " Digital Twin started\n"
        "========================================\n"
        " Dashboard:  http://localhost:5173\n"
        " API:        http://localhost:8000/docs\n"
        " Controller: http://localhost:9000/simulation/status\n"
        "\n Stop with:  python start.py stop\n"
        "========================================"
    )


def stop():
    step("Stopping simulation")
    try:
        request = urllib.request.Request(
            "http://localhost:9000/simulation/stop", method="POST"
        )
        print(urllib.request.urlopen(request, timeout=5).read().decode())
    except Exception:
        print("Simulation controller not reachable.")

    step("Stopping simulation controller")
    if os.path.isfile(CONTROLLER_PID):
        with open(CONTROLLER_PID) as f:
            pid = int(f.read().strip() or 0)
        try:
            if IS_WINDOWS:
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True
                )
            else:
                os.kill(pid, signal.SIGTERM)
        except (OSError, ValueError):
            pass
        os.remove(CONTROLLER_PID)

    step("Stopping Docker services")
    compose("stop")


if __name__ == "__main__":
    if sys.version_info < (3, 8):
        fail("Python 3.8 or newer is required.")

    command = sys.argv[1] if len(sys.argv) > 1 else "start"
    if command == "start":
        start()
    elif command == "stop":
        stop()
    else:
        fail(f"Unknown command '{command}'. Use: start | stop")
