"""Starts and stops the live MATLAB simulation for the API (port 9000).

Uses only the Python standard library and runs on Linux, Windows and macOS.
MATLAB is found through the MATLAB_PATH environment variable, then PATH, then
the default install folders (newest release first).
"""

import glob
import json
import os
import shutil
import signal
import subprocess
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

SIMULINK_DIR = os.path.dirname(os.path.abspath(__file__))
SIM_SCRIPT = "simulink_mqtt_stream"
SIM_LOG = os.path.join(SIMULINK_DIR, "simulation.log")
PORT = 9000

# Mission profiles defined in simulation/mission_profile.m.
MISSION_PROFILES = (
    "cruise",
    "high_altitude",
    "hot_weather",
    "endurance",
    "rapid_throttle",
)

IS_WINDOWS = sys.platform == "win32"

simulation_process = None
current_run = {}


def find_matlab():
    configured = os.environ.get("MATLAB_PATH", "").strip()
    if configured:
        if os.path.isdir(configured):
            configured = os.path.join(
                configured, "bin", "matlab.exe" if IS_WINDOWS else "matlab"
            )
        return configured if os.path.isfile(configured) else None

    on_path = shutil.which("matlab")
    if on_path:
        return on_path

    if IS_WINDOWS:
        patterns = [
            os.path.join(
                os.environ.get(var, "C:\\Program Files"),
                "MATLAB", "R*", "bin", "matlab.exe",
            )
            for var in ("ProgramFiles", "ProgramW6432")
        ]
    elif sys.platform == "darwin":
        patterns = ["/Applications/MATLAB_R*.app/bin/matlab"]
    else:
        patterns = [
            "/usr/local/MATLAB/R*/bin/matlab",
            "/opt/MATLAB/R*/bin/matlab",
            os.path.expanduser("~/MATLAB/R*/bin/matlab"),
        ]

    # Release folders (R2025b, R2026a, ...) sort by age.
    found = sorted({p for pattern in patterns for p in glob.glob(pattern)})
    return found[-1] if found else None


def running():
    global simulation_process

    if simulation_process is not None and simulation_process.poll() is not None:
        simulation_process = None

    return simulation_process is not None


def simulation_status():
    if running():
        return 200, {
            "status": "running",
            "pid": simulation_process.pid,
            **current_run,
        }

    return 200, {"status": "stopped"}


def start_simulation(profile):
    global simulation_process, current_run

    if profile not in MISSION_PROFILES:
        return 422, {
            "detail": (
                f"Unknown mission profile '{profile}'. "
                f"Valid: {', '.join(MISSION_PROFILES)}"
            )
        }

    if running():
        return 200, {
            "status": "already_running",
            "pid": simulation_process.pid,
            **current_run,
        }

    matlab = find_matlab()
    if matlab is None:
        return 500, {
            "detail": (
                "MATLAB not found. Put it on PATH or set MATLAB_PATH in .env "
                "to the MATLAB install folder."
            )
        }

    # Every run is its own mission, named after its start time and profile.
    mission_id = (
        "mission_"
        + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        + "_"
        + profile
    )

    # Own process group, so stop can end MATLAB and all its children.
    if IS_WINDOWS:
        group = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    else:
        group = {"start_new_session": True}

    try:
        log = open(SIM_LOG, "w")
        simulation_process = subprocess.Popen(
            [matlab, "-batch", SIM_SCRIPT],
            cwd=SIMULINK_DIR,
            stdout=log,
            stderr=subprocess.STDOUT,
            env={
                **os.environ,
                "SIM_PROFILE": profile,
                "SIM_MISSION_ID": mission_id,
            },
            **group,
        )
        log.close()

    except Exception as exc:
        return 500, {"detail": f"Failed to start simulation: {exc}"}

    print(f"Started {mission_id} with {matlab} (pid {simulation_process.pid})")

    current_run = {
        "profile": profile,
        "mission_id": mission_id,
    }

    return 200, {
        "status": "started",
        "pid": simulation_process.pid,
        **current_run,
        "fault_id": 0,
    }


def stop_simulation():
    global simulation_process

    if not running():
        return 200, {"status": "not_running"}

    try:
        if IS_WINDOWS:
            subprocess.run(
                ["taskkill", "/PID", str(simulation_process.pid), "/T", "/F"],
                capture_output=True,
            )
        else:
            os.killpg(os.getpgid(simulation_process.pid), signal.SIGINT)

        simulation_process = None
        return 200, {"status": "stopped"}

    except Exception as exc:
        return 500, {"detail": f"Failed to stop simulation: {exc}"}


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/simulation/status":
            self.reply(*simulation_status())
        else:
            self.reply(404, {"detail": "Not Found"})

    def do_POST(self):
        url = urlparse(self.path)
        if url.path == "/simulation/start":
            profile = parse_qs(url.query).get("profile", ["cruise"])[0]
            self.reply(*start_simulation(profile))
        elif url.path == "/simulation/stop":
            self.reply(*stop_simulation())
        else:
            self.reply(404, {"detail": "Not Found"})


if __name__ == "__main__":
    matlab = find_matlab()
    print(f"MATLAB: {matlab or 'NOT FOUND (set MATLAB_PATH in .env)'}")
    print(f"Simulation controller listening on :{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
