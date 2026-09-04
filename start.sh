#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIMULINK_DIR="$PROJECT_DIR/simulink"

echo "========================================"
echo " Starting Digital Twin"
echo "========================================"

echo "[1/3] Starting Docker services..."
docker compose up -d

echo "[2/3] Starting MQTT fault bridge..."
FAULT_BRIDGE_PID=$(pgrep -f "$SIMULINK_DIR/mqtt_fault_bridge.py" || true)

if [ -z "$FAULT_BRIDGE_PID" ]; then
    nohup python3 "$SIMULINK_DIR/mqtt_fault_bridge.py" \
        > "$SIMULINK_DIR/fault_bridge.log" 2>&1 &
fi

echo "[3/3] Starting simulation controller..."
CONTROLLER_PID=$(pgrep -f "$SIMULINK_DIR/simulation_controller.py" || true)

if [ -z "$CONTROLLER_PID" ]; then
    nohup python3 "$SIMULINK_DIR/simulation_controller.py" \
        > "$SIMULINK_DIR/simulation_controller.log" 2>&1 &
fi

echo ""
echo "========================================"
echo " Digital Twin started"
echo "========================================"
echo " API:        http://localhost:8000"
echo " Controller: http://localhost:9000"
echo " Frontend:   http://localhost:5173"
echo "========================================"
