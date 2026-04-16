#!/usr/bin/env bash
# Apply Alembic migrations. Safe to run on startup.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python -m alembic upgrade head "$@"
