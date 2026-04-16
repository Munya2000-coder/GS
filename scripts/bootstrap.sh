#!/usr/bin/env bash
# One-shot: install Python + frontend deps, seed demo data, build the SPA,
# and start the API (which serves the SPA at /app). Requires Python 3.11+
# and Node 18+.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> installing Python dependencies"
python -m pip install -e ".[dev]" > /dev/null

echo "==> initialising database"
python -m app.cli init

echo "==> seeding demo data"
python -m app.cli seed

if command -v npm > /dev/null 2>&1; then
  echo "==> installing frontend dependencies"
  (cd frontend && npm install --no-audit --no-fund > /dev/null)
  echo "==> building SPA → app/static/"
  (cd frontend && npm run build)
else
  echo "WARNING: npm not found; skipping SPA build. Install Node 18+ to get /app."
fi

echo "==> summary"
python -m app.cli summary

echo
echo "Starting API at http://127.0.0.1:8000"
echo "  SPA:       /app"
echo "  OpenAPI:   /docs"
echo "  Legacy UI: /ui/"
echo "  Seed users: admin, alice (accountant), bob (controller), charlie (IR)"
echo "  Dev user:   dev-admin (auto-provisioned)"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
