#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"

wait_for_api() {
  local retries=30
  local wait_s=1
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$wait_s"
  done
  echo "API did not become ready at $API_URL within ${retries}s." >&2
  return 1
}

ingest() {
  local alias="$1"
  local type="$2"
  local sentiment="$3"
  local summary="$4"

  curl -sS -X POST "$API_URL/api/ingest" \
    -H "Content-Type: application/json" \
    -d "{\"alias\":\"$alias\",\"events\":[{\"interaction_type\":\"$type\",\"sentiment\":$sentiment,\"intent\":\"check_in\",\"summary\":\"$summary\",\"metadata\":{\"source\":\"demo_script\"}}]}" >/dev/null
}

wait_for_api

echo "Seeding demo interactions..."
ingest "Alex" "ignored_message" -0.7 "No response after follow-up check-in."
ingest "Maya" "call" 0.8 "Had a warm call and aligned on weekend plans."
ingest "Jordan" "text" 0.2 "Shared quick updates and acknowledged schedule conflict."
ingest "Priya" "missed_call" -0.4 "Attempted a call but could not connect."
ingest "Sam" "auto_nudge" 0.1 "Automated reminder issued to reconnect."

echo "Dashboard snapshot:"
curl -sS "$API_URL/api/dashboard"

printf "\n\nAudit chain snapshot:\n"
curl -sS "$API_URL/api/audit/chain"

printf "\n\nDone. Open http://localhost:3000 for UI.\n"
