#!/bin/bash
# Double-click this ONLY if the .app shows no window (shows errors in Terminal).
cd "$(dirname "$0")"
APP="./FloorPlan Interest Calculator.app/Contents/MacOS/FloorPlan Interest Calculator"
if [[ ! -x "$APP" ]]; then
  echo "Missing .app next to this file. Unzip FloorPlan-mac and run from that folder."
  read -r -p "Press Enter to close..."
  exit 1
fi
exec "$APP"
