"""Filesystem paths, resolved relative to backend/ (not the cwd). Creates the
runtime folders on import."""

from __future__ import annotations

import os
from pathlib import Path

# backend/utils/paths.py -> backend/ is two levels up.
BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_FOLDER = BASE_DIR / 'uploads'
OUTPUT_FOLDER = BASE_DIR / 'AR_Outputs'
OUTPUT_WAIVE_FOLDER = BASE_DIR / 'AR_Outputs - Waive'
AR_INPUT_FOLDER = BASE_DIR / 'AR_Input'
SOT_INPUT_FOLDER = BASE_DIR / 'SOT_Input'
CAMPAIGN_INPUT_FOLDER = BASE_DIR / 'Campaign_Input'
DATA_DIR = BASE_DIR / 'data'
CAMPAIGNS_FILE = DATA_DIR / 'campaigns.json'
CONFIG_PATH = BASE_DIR / 'config' / 'Rental_Charge_Conditions_v2.xlsx'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_WAIVE_FOLDER, exist_ok=True)
os.makedirs(AR_INPUT_FOLDER, exist_ok=True)
os.makedirs(SOT_INPUT_FOLDER, exist_ok=True)
os.makedirs(CAMPAIGN_INPUT_FOLDER, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
