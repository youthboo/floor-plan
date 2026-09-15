"""Filesystem paths. In dev mode these resolve relative to backend/ (unchanged
behavior). When packaged (PyInstaller), user-writable data (uploads, outputs,
campaigns.json) moves to sit alongside wherever the app itself is placed — e.g.
AR_Outputs/ next to the .app bundle on macOS — so the whole install stays one
movable folder, matching dev mode's own layout. Read-only bundled resources (the
config workbook, the built frontend) are read from the bundle's own extraction
dir instead, since that part must NOT be user-writable / persisted there.

macOS note: if the .app is run directly from a freshly-unzipped Downloads folder
without ever being moved via Finder, Gatekeeper's App Translocation silently runs
it from a randomized read-only mirror instead of its real location — breaking
"next to the app" writes. Dragging the .app (once, via Finder) into its final
folder before running it avoids this."""

from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = 'FloorPlan Interest Calculator'


def _is_frozen() -> bool:
    return bool(getattr(sys, 'frozen', False))


def _bundle_dir() -> Path:
    """Read-only bundled resources (config workbook, built frontend)."""
    if _is_frozen():
        return Path(getattr(sys, '_MEIPASS', Path(sys.executable).resolve().parent))
    return Path(__file__).resolve().parent.parent


def _app_data_dir() -> Path:
    """User-writable data root, kept next to wherever the app is placed."""
    if not _is_frozen():
        return Path(__file__).resolve().parent.parent
    exe_path = Path(sys.executable).resolve()
    if sys.platform == 'darwin':
        # exe_path = .../My App.app/Contents/MacOS/My App -> the folder the
        # .app bundle itself sits in (four levels up from the executable file).
        return exe_path.parents[3]
    # Windows/Linux onedir builds: exe_path = .../My App/My App(.exe) -> the
    # folder the whole onedir distribution sits in, one level up.
    return exe_path.parent


BASE_DIR = _app_data_dir()
BUNDLE_DIR = _bundle_dir()
FRONTEND_DIST_DIR = BUNDLE_DIR / 'frontend_dist' if _is_frozen() else BUNDLE_DIR.parent / 'frontend' / 'dist'

UPLOAD_FOLDER = BASE_DIR / 'uploads'
OUTPUT_FOLDER = BASE_DIR / 'AR_Outputs'
OUTPUT_WAIVE_FOLDER = BASE_DIR / 'AR_Outputs - Waive'
AR_INPUT_FOLDER = BASE_DIR / 'AR_Input'
SOT_INPUT_FOLDER = BASE_DIR / 'SOT_Input'
CAMPAIGN_INPUT_FOLDER = BASE_DIR / 'Campaign_Input'
DATA_DIR = BASE_DIR / 'data'
CAMPAIGNS_FILE = DATA_DIR / 'campaigns.json'
CONFIG_PATH = BUNDLE_DIR / 'config' / 'Rental_Charge_Conditions_v2.xlsx'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_WAIVE_FOLDER, exist_ok=True)
os.makedirs(AR_INPUT_FOLDER, exist_ok=True)
os.makedirs(SOT_INPUT_FOLDER, exist_ok=True)
os.makedirs(CAMPAIGN_INPUT_FOLDER, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
