#!/usr/bin/env bash
#
# run.sh — start Bug Bounty OS (API + web client)
#
set -euo pipefail
cd "$(dirname "$0")"

# First run? install dependencies automatically.
if [ ! -d node_modules ]; then
  echo "› node_modules missing — running ./install.sh first…"
  ./install.sh
fi

# The SQLite database is created + seeded automatically on first launch.
echo "› Starting Bug Bounty OS"
echo "    App  → http://localhost:5173"
echo "    API  → http://localhost:5177"
echo "    (Ctrl+C to stop)"
echo ""

exec npm run dev
