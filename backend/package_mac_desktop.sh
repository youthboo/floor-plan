#!/usr/bin/env bash
# Creates a Mac distribution zip safe to send to other Macs (preserves .app symlinks).
#
# Prerequisite: run ./build_desktop_app.sh first (or omit SKIP_BUILD to build automatically).
#
# Usage:
#   ./package_mac_desktop.sh
# Output:
#   backend/dist/FloorPlan-Interest-Calculator-mac.zip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="FloorPlan Interest Calculator"
APP_PATH="$SCRIPT_DIR/dist/${APP_NAME}.app"
README="$SCRIPT_DIR/macos/DISTRIBUTE_README.txt"
OUT_ZIP="$SCRIPT_DIR/dist/FloorPlan-Interest-Calculator-mac.zip"
BUNDLE_DIR="FloorPlan-mac"
STAGE="$SCRIPT_DIR/dist/_package_stage/$BUNDLE_DIR"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building desktop app..."
  "$SCRIPT_DIR/build_desktop_app.sh"
else
  echo "==> SKIP_BUILD=1 — using existing dist/"
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "error: missing $APP_PATH — run ./build_desktop_app.sh first" >&2
  exit 1
fi

ARCH="$(file "$APP_PATH/Contents/MacOS/$APP_NAME" | grep -o 'arm64\|x86_64' | head -1 || true)"
echo "==> App binary: ${ARCH:-unknown} (Apple Silicon Macs need arm64)"

if [[ "${SKIP_SMOKE:-0}" != "1" ]]; then
  echo "==> Smoke test: start app for 3s..."
  "$APP_PATH/Contents/MacOS/$APP_NAME" &
  SMOKE_PID=$!
  sleep 3
  if ! kill -0 "$SMOKE_PID" 2>/dev/null; then
    echo "error: app exited within 3s — fix build before distributing" >&2
    echo "       (or re-run with SKIP_SMOKE=1 if you already verified open .app works)" >&2
    exit 1
  fi
  kill "$SMOKE_PID" 2>/dev/null || true
  wait "$SMOKE_PID" 2>/dev/null || true
else
  echo "==> SKIP_SMOKE=1 — skipping launch check"
fi

echo "==> Staging..."
rm -rf "$SCRIPT_DIR/dist/_package_stage"
mkdir -p "$STAGE"
ditto "$APP_PATH" "$STAGE/${APP_NAME}.app"
cp "$README" "$STAGE/DISTRIBUTE_README.txt"
CMD="$SCRIPT_DIR/macos/Open-with-Terminal-if-no-window.command"
cp "$CMD" "$STAGE/"
chmod +x "$STAGE/$(basename "$CMD")"

echo "==> Zipping with ditto (preserves symlinks in .app)..."
rm -f "$OUT_ZIP"
# --keepParent preserves the FloorPlan-mac/ folder inside the zip.
# Do not use plain zip -r on .app (breaks symlinks).
ditto -c -k --keepParent "$STAGE" "$OUT_ZIP"

echo ""
echo "==> Done."
echo "    Send: $OUT_ZIP"
echo "    Recipient unzips folder \"$BUNDLE_DIR\" → uses ${APP_NAME}.app"
echo ""
echo "    Avoid: manual 'zip -r' on .app, or sending dist/${APP_NAME}/ (no .app wrapper)."
