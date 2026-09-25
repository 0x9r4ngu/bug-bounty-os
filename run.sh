#!/usr/bin/env bash
#
# run.sh — start Bug Bounty OS
#
set -euo pipefail
cd "$(dirname "$0")"

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then echo "Python 3 not found — run ./install.sh"; exit 1; fi

PORT="${PORT:-8787}"
echo "› Bug Bounty OS  →  http://localhost:${PORT}"
echo "  (Ctrl+C to stop · data is stored in data/bugbounty.db)"
echo ""
exec "$PY" app.py
