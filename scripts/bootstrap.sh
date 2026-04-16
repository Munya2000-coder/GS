#!/usr/bin/env bash
# One-shot: install dependencies, seed demo data, and start the API on :8000.
# Use after cloning the repo for a working local environment.
set -euo pipefail

cd "$(dirname "$0")/.."

python -m pip install -e ".[dev]"
python -m app.cli init
python -m app.cli seed
python -m app.cli summary

echo
echo "Starting API on http://127.0.0.1:8000 (UI at /ui/, docs at /docs)"
echo "Seed users: admin, alice (accountant), bob (controller), charlie (IR)"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
