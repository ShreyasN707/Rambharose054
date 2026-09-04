FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .

COPY telemetry ./telemetry
COPY twin ./twin
COPY api ./api
COPY ml_artifacts ./ml_artifacts
ENV PYTHONPATH=/app:/app/telemetry
CMD ["python", "-u", "-m", "telemetry.app"]