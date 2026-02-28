#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Validating docker-compose config..."
docker compose config >/dev/null
echo "ok"

echo "[2/4] Python static compile (ML service)..."
python3 -m py_compile services/ml/app/*.py services/ml/scripts/generate_synthetic_dataset.py
echo "ok"

echo "[3/4] ML unit tests..."
python3 -m pytest -q services/ml/tests/test_scoring.py
echo "ok"

echo "[4/4] Dataset generator smoke run..."
python3 services/ml/scripts/generate_synthetic_dataset.py \
  --output data/synthetic/chat_metadata_export.json \
  --seed 42 \
  --days 30 \
  --start-date 2026-01-01T00:00:00+00:00 >/dev/null
echo "ok"

echo "Verification complete."
