#!/usr/bin/env bash
set -euo pipefail

url="${1:-http://localhost:5001/api/auth/login}"
payload='{"email":"a@a.com","password":"bad"}'

codes=()
for i in {1..30}; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url" \
    -H 'content-type: application/json' \
    --data "$payload")"
  codes+=("$code")
done

printf '%s\n' "${codes[@]}" | tail -n 10

