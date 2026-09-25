#!/usr/bin/env bash
#
# install.sh — set up Bug Bounty OS
# Nothing to install: it runs on the Python 3 standard library (http.server + sqlite3).
# This just checks that Python 3.8+ is available.
#
set -euo pipefail
cd "$(dirname "$0")"

echo "› Bug Bounty OS — setup"

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "✗ Python 3 not found. Install Python 3.8+ (https://python.org) and re-run."
  exit 1
fi

VER="$("$PY" -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
MAJ="$("$PY" -c 'import sys;print(sys.version_info[0])')"
MIN="$("$PY" -c 'import sys;print(sys.version_info[1])')"
if [ "$MAJ" -lt 3 ] || { [ "$MAJ" -eq 3 ] && [ "$MIN" -lt 8 ]; }; then
  echo "✗ Python $VER found — need Python 3.8+."
  exit 1
fi

echo "✓ Python $VER — no dependencies needed (stdlib only)."
echo ""
echo "✓ Ready. Start with:  ./run.sh"
