FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY telemetry ./telemetry

CMD ["sh", "-c", "cd /app/telemetry && python -u app.py"]