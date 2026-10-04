#!/bin/sh
# Linux/macOS shortcut for start.py; on Windows run: python start.py
exec python3 "$(dirname "$0")/start.py" "$@"
