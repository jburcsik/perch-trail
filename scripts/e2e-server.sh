#!/usr/bin/env bash
#
# E2E test server: a production build served with `next start`, so the suite
# is deterministic and matches deployed behaviour. Loads .env.local line by
# line (dotenv files may hold unquoted spaces and angle brackets).
#
# Usage:  npm run test:server     (or invoked automatically by playwright.config webServer)
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env.local (KEY=VALUE lines) into the environment. Parsed line by
# line, NOT shell-sourced: dotenv files legally hold unquoted spaces and
# angle brackets (e.g. EMAIL_FROM=Name <a@b>), which are bash syntax errors.
if [[ -f .env.local ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^[A-Za-z_][A-Za-z_0-9]*= ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    # Strip one pair of surrounding double quotes, like dotenv does.
    if [[ "$val" == \"*\" ]]; then val="${val%\"}"; val="${val#\"}"; fi
    export "$key=$val"
  done < .env.local
fi

# Export the service-role key under the name the server checks first.
export SUPABASE_SECRET_KEY="${SUPABASE_SECRET_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

# Build only if there's no production build yet (next dev leaves .next/dev, not BUILD_ID).
if [[ ! -f .next/BUILD_ID ]]; then
  echo "[e2e-server] No production build found, building..."
  npm run build
fi

echo "[e2e-server] Serving production build on http://localhost:3000"
exec npm run start
