# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/main.py .

COPY --from=frontend-builder /build/dist ./static/

RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
