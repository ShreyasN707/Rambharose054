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
COPY entrypoint.sh .

ENV PYTHONPATH=/app:/app/telemetry
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/bin/sh", "entrypoint.sh"]
CMD ["python", "-u", "-m", "telemetry.app"]