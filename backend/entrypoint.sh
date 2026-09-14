#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting service..."
exec "$@"