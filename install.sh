#!/usr/bin/env bash
#
# install.sh — set up Bug Bounty OS
# Checks the Node.js version and installs dependencies.
#
set -euo pipefail
cd "$(dirname "$0")"

echo "› Bug Bounty OS — install"

# --- Node.js check ---------------------------------------------------------
# The backend uses Node's built-in SQLite (node:sqlite), which needs Node 22.5+.
# Node 22 LTS or Node 24 is recommended.
if ! command -v node >/dev/null 2>&1; then
  cat <<'MSG'
✗ Node.js not found.

Install Node.js 22 LTS or 24 first:
  • https://nodejs.org            (official installer)
  • or via nvm:  nvm install 22 && nvm use 22

Then re-run ./install.sh
MSG
  exit 1
fi

NODE_VER="$(node -v)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "✗ Node $NODE_VER found, but this app needs Node >= 22.5 (built-in node:sqlite)."
  echo "  Install Node 22 LTS or 24 and re-run."
  exit 1
fi
echo "✓ Node $NODE_VER"

# --- dependencies ----------------------------------------------------------
if [ -f package-lock.json ]; then
  echo "› Installing dependencies (npm ci)…"
  npm ci
else
  echo "› Installing dependencies (npm install)…"
  npm install
fi

echo ""
echo "✓ Done. Start the app with:  ./run.sh"
echo "  App → http://localhost:5173   API → http://localhost:5177"
