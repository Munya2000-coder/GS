###
# Stage 1 — build the React SPA with Node
###
FROM node:22-alpine AS frontend

WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
# Vite emits to ../app/static; create the target dir
RUN mkdir -p /out && npx vite build --outDir /out

###
# Stage 2 — Python runtime
###
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml README.md alembic.ini ./
COPY app ./app
COPY migrations ./migrations

RUN pip install --no-cache-dir -e ".[prod]"

COPY --from=frontend /out ./app/static

# Non-root user
RUN useradd --create-home --shell /bin/bash gs \
    && chown -R gs:gs /app
USER gs

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Gunicorn with uvicorn workers — sensible defaults for a multi-core box.
# Override GUNICORN_WORKERS / GUNICORN_TIMEOUT via env.
CMD ["sh", "-c", "gunicorn app.entrypoint:app \
    --workers ${GUNICORN_WORKERS:-4} \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout ${GUNICORN_TIMEOUT:-60} \
    --access-logfile - \
    --forwarded-allow-ips=* \
    --proxy-allow-from=*"]
