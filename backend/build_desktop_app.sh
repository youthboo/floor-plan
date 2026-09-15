#!/usr/bin/env bash
# Builds the FloorPlan Interest Calculator as a standalone macOS app (.app bundle) —
# bundles the Flask backend + the built React frontend + a pywebview native window,
# so it can be double-clicked and run with no separate servers, Node, or Python setup.
#
# Usage: ./build_desktop_app.sh
# Output: backend/dist/FloorPlan Interest Calculator.app
#
# Windows: PyInstaller does not cross-compile — this must be re-run on an actual
# Windows machine (with `;` as the --add-data separator instead of `:`, and without
# --windowed's macOS .app bundling) to produce a .exe. Not covered by this script yet.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

# Adjust if your Python 3 interpreter lives elsewhere (must have the desktop
# requirements installed — see requirements-desktop.txt).
PYTHON_BIN="${PYTHON_BIN:-/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/bin/python3}"

echo "==> Building frontend (frontend/dist)..."
(cd "$FRONTEND_DIR" && pnpm build)

echo "==> Installing desktop packaging dependencies..."
"$PYTHON_BIN" -m pip install -r "$SCRIPT_DIR/requirements-desktop.txt"

echo "==> Running PyInstaller..."
cd "$SCRIPT_DIR"
rm -rf build dist ./*.spec
"$PYTHON_BIN" -m PyInstaller \
  --name "FloorPlan Interest Calculator" \
  --windowed \
  --onedir \
  --noconfirm \
  --add-data "config/Rental_Charge_Conditions_v2.xlsx:config" \
  --add-data "../frontend/dist:frontend_dist" \
  --hidden-import webview \
  --hidden-import webview.platforms.cocoa \
  app.py

echo ""
echo "==> Done."
echo "    App bundle: $SCRIPT_DIR/dist/FloorPlan Interest Calculator.app"
echo "    Run it:     open \"$SCRIPT_DIR/dist/FloorPlan Interest Calculator.app\""
echo ""
echo "    User data (campaigns, uploads, output files) is created NEXT TO wherever"
echo "    the .app is placed when it's run (AR_Outputs/, uploads/, data/, etc. as"
echo "    siblings of the .app) — move/copy the .app to its final folder before"
echo "    running it, since that's where its data folders will appear."
echo "    Note (macOS): if the .app is run straight out of a freshly-unzipped"
echo "    Downloads folder without being moved via Finder first, Gatekeeper's App"
echo "    Translocation runs it from a hidden read-only copy instead — drag the"
echo "    .app into its real folder once before the first run to avoid this."
