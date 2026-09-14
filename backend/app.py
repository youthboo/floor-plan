"""
FloorPlan Interest Calculator - REST API Backend
Main Flask application with calculation logic
"""

from __future__ import annotations

import os
import traceback
from typing import Any
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

import pandas as pd
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.utils import get_column_letter
from openpyxl.styles import Alignment
from openpyxl.worksheet.worksheet import Worksheet

# ============= CONFIG =============
app = Flask(__name__)
# Ensures unexpected errors still return JSON, never Werkzeug's debug HTML page.
app.config['PROPAGATE_EXCEPTIONS'] = False
CORS(app)

# Relative to this file, not the process's cwd, so it works regardless of launch directory.
BASE_DIR = Path(__file__).resolve().parent

UPLOAD_FOLDER = BASE_DIR / 'uploads'
OUTPUT_FOLDER = BASE_DIR / 'AR_Outputs'
OUTPUT_WAIVE_FOLDER = BASE_DIR / 'AR_Outputs - Waive'
AR_INPUT_FOLDER = BASE_DIR / 'AR_Input'
CONFIG_PATH = BASE_DIR / 'config' / 'Rental_Charge_Conditions_v2.xlsx'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_WAIVE_FOLDER, exist_ok=True)
os.makedirs(AR_INPUT_FOLDER, exist_ok=True)

WAIVE_REQUIRED_COLUMNS = ['Dealer Code', 'Dealer Name', 'VIN Number', 'waive amount', 'reason', 'approved']

DAYS_PER_YEAR = 365
# Converts an annual rate% (e.g. 12) directly to a daily amount: price * rate / 100 / 365.
ANNUAL_RATE_TO_DAILY_DIVISOR = 100 * DAYS_PER_YEAR
VAT_RATE = 0.07
RAM_WHT_RATE = 0.03
DEALER_WHT_RATE = 0.05
DEALER_CODE_DIGITS = 5


class CalculationValidationError(Exception):
    """Raised when the AR file fails validation (missing sheets, no payment-date column)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


# ============= HELPER FUNCTIONS =============


def clean_nan_values(obj: Any) -> Any:
    """Convert NaN values to None for JSON serialization"""
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        return None if np.isnan(obj) else obj
    else:
        return obj


def load_config() -> dict[str, Any]:
    """Load configuration from Excel file"""
    try:
        df_config = pd.read_excel(CONFIG_PATH, sheet_name='Config', engine='openpyxl')
        config = dict(zip(df_config['Key'], df_config['Value']))

        df_rate = pd.read_excel(CONFIG_PATH, sheet_name='Rate_By_Day_Range', engine='openpyxl')
        df_subvention = pd.read_excel(CONFIG_PATH, sheet_name='Subvention_Campaign', engine='openpyxl')

        return {
            'config': config,
            'rates': df_rate,
            'subventions': df_subvention
        }
    except Exception as e:
        raise RuntimeError(f"Failed to load config: {str(e)}") from e


def resolve_run_period(
    request_data: dict[str, Any], excel_config: dict[str, Any]
) -> tuple[pd.Timestamp, pd.Timestamp, float, str]:
    """
    Resolve (month_start, month_end, penalty_rate, last_month_label) for a
    calculation run. Prefer values from the UI request; fall back to Excel
    Config sheet.
    """
    month = request_data.get('month')
    year = request_data.get('year')
    penalty = request_data.get('penaltyRate')

    if month is not None and year is not None and str(month).strip() and str(year).strip():
        month_start = pd.to_datetime(f"1 {month} {year}", errors='coerce')
        if pd.isna(month_start):
            raise ValueError(f"Invalid month/year from UI: {month} {year}")
        month_end = month_start + relativedelta(day=31)
    else:
        month_end = pd.to_datetime(excel_config.get('Month End Date'), dayfirst=True, errors='coerce')
        if pd.isna(month_end):
            raise ValueError('Invalid Month End Date in config')
        month_start = month_end.replace(day=1)

    if penalty is not None and penalty != '':
        try:
            penalty_rate = float(penalty)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid penaltyRate from UI: {penalty}")
    else:
        try:
            penalty_rate = float(excel_config.get('Penalty Rate', 15))
        except (TypeError, ValueError):
            penalty_rate = 15.0

    last_month_label = (month_end - relativedelta(months=1)).strftime('%b').lower()

    return month_start, month_end, penalty_rate, last_month_label


def locate_ar_sheets(
    sheet_names: list[str], last_month_label: str
) -> tuple[str | None, str | None, str | None, str | None]:
    """Find the AR Last Month / New Volume / All Payment / Penalty sheet names by pattern."""
    sheet_last = next((s for s in sheet_names if last_month_label in s.lower()), None)
    sheet_new = next((s for s in sheet_names if 'new' in s.lower()), None)
    sheet_all = next((s for s in sheet_names if 'all' in s.lower()), None)
    sheet_penalty = next((s for s in sheet_names if 'penalty' in s.lower()), None)
    return sheet_last, sheet_new, sheet_all, sheet_penalty


def load_penalty_sheet(xls: pd.ExcelFile, sheet_penalty: str | None) -> pd.DataFrame:
    """Load and standardize the optional penalty sheet (VIN Number, Due Date)."""
    df_penalty = pd.DataFrame(columns=['VIN Number', 'Due Date'])
    if sheet_penalty:
        df_penalty = xls.parse(sheet_penalty, header=0)
        df_penalty.columns = df_penalty.columns.str.strip()
        if 'VIN No.' in df_penalty.columns:
            df_penalty.rename(columns={'VIN No.': 'VIN Number'}, inplace=True)
        df_penalty['Due Date'] = pd.to_datetime(df_penalty['Due Date'], errors='coerce')
        df_penalty = df_penalty[['VIN Number', 'Due Date']].dropna(subset=['Due Date'])
    return df_penalty


def prepare_ar_data(df_ar: pd.DataFrame, source_name: str) -> pd.DataFrame:
    """Prepare and standardize AR data"""
    df = df_ar.copy()
    df.columns = df.columns.astype(str).str.strip()

    required_columns = [
        'Dealer Group', 'Dealer Code', 'Dealer Name', 'Model', 'VIN No.',
        'Pre-Vat', 'Allocation Date', 'Contract No', 'Subvention'
    ]

    if source_name == 'AR Last Month':
        required_columns.append('Payment Date')

    available_columns = [col for col in required_columns if col in df.columns]
    df = df[available_columns].copy()

    rename_map = {
        'VIN No.': 'VIN Number',
        'Pre-Vat': 'Price (Ex. Vat)',
        'Contract No': 'Contract Number',
        'Subvention': 'Subvention Campaign'
    }

    df.rename(columns=rename_map, inplace=True)
    df['Dealer Code'] = (
        df['Dealer Code']
        .astype(str)
        .str.replace(r'\.0$', '', regex=True)
        .str.strip()
    )
    df['Source'] = source_name

    return df


def prepare_rate_ranges(rate_ranges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pre-parse EffectiveStart/EffectiveEnd once, since find_rate_for_day() runs per day per VIN."""
    prepared = []
    for r in rate_ranges:
        r = dict(r)
        r['EffectiveStart'] = pd.to_datetime(r['EffectiveStart'])
        r['EffectiveEnd'] = pd.to_datetime(r['EffectiveEnd'])
        prepared.append(r)
    return prepared


def find_rate_for_day(
    rate_ranges: list[dict[str, Any]], day_count: int, date: pd.Timestamp
) -> dict[str, Any] | None:
    """Find the rate range matching a day-count/date; ties broken by latest EffectiveStart.
    rate_ranges must already have EffectiveStart/EffectiveEnd parsed to datetime."""
    applicable_rates = [
        r for r in rate_ranges
        if r['StartDay'] <= day_count <= r['EndDay']
        and r['EffectiveStart'] <= date <= r['EffectiveEnd']
        and r.get('IsActive', True)
    ]
    if not applicable_rates:
        return None
    return max(applicable_rates, key=lambda r: r['EffectiveStart'])


def calculate_detailed_charge(
    row: pd.Series,
    rate_ranges: list[dict[str, Any]],
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    penalty_rate: float,
) -> pd.Series:
    """Calculate detailed charges for a single vehicle"""
    price = float(row.get('Price (Ex. Vat)', 0))
    alloc_date = pd.to_datetime(row['Allocation Date'], errors='coerce')
    paid_date = pd.to_datetime(row['Payment Date'], errors='coerce')
    due_date = pd.to_datetime(row.get('Due Date'), errors='coerce')
    free_days = int(row.get('Free Days', 0))

    if pd.isna(alloc_date):
        return pd.Series([0.0, 0.0, 0.0, 0, '', '', 0, 0])

    # ====== RAM CHARGE (Free Days Period) ======
    free_day_actual_end = alloc_date + timedelta(days=free_days - 1)
    last_free_day = min(free_day_actual_end, month_end)
    ram_charge_days = pd.date_range(alloc_date, last_free_day, freq='D')
    ram_charge_freeday_days_this_month = sum(month_start <= d <= month_end for d in ram_charge_days)

    ram_charge = 0.0
    ram_desc = {}

    for d in ram_charge_days:
        day_count = (d - alloc_date).days + 1
        rate_rec = find_rate_for_day(rate_ranges, day_count, d)

        if month_start <= d <= month_end and rate_rec:
            daily_interest = (price * float(rate_rec['Rate'])) / ANNUAL_RATE_TO_DAILY_DIVISOR
            ram_charge += daily_interest
            rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
            ram_desc[rate_key] = ram_desc.get(rate_key, 0) + 1

    # ====== RAM CHARGE ACTUAL (Full Period) ======
    ram_charge_actual_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end
    ram_charge_actual_days = pd.date_range(max(alloc_date, month_start), ram_charge_actual_end, freq='D')
    ram_charge_actual = 0.0

    for d in ram_charge_actual_days:
        day_count = (d - alloc_date).days + 1
        rate_rec = find_rate_for_day(rate_ranges, day_count, d)

        if rate_rec:
            daily_interest = (price * float(rate_rec['Rate'])) / ANNUAL_RATE_TO_DAILY_DIVISOR
            ram_charge_actual += daily_interest

    # ====== DEALER CHARGE ======
    dealer_charge = 0.0
    penalty_charge = 0.0
    dealer_desc = {}

    dealer_start = alloc_date + timedelta(days=free_days)

    if pd.notna(due_date):
        dealer_end = min(due_date, paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else min(due_date, month_end)
    else:
        dealer_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end

    if dealer_start <= dealer_end:
        dealer_days = pd.date_range(dealer_start, dealer_end, freq='D')
        for d in dealer_days:
            day_count = (d - alloc_date).days + 1
            rate_rec = find_rate_for_day(rate_ranges, day_count, d)

            if month_start <= d <= month_end and rate_rec:
                daily_interest = (price * float(rate_rec['Rate'])) / ANNUAL_RATE_TO_DAILY_DIVISOR
                dealer_charge += daily_interest
                rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
                dealer_desc[rate_key] = dealer_desc.get(rate_key, 0) + 1

    # ====== PENALTY CHARGE ======
    if pd.notna(due_date):
        penalty_start = due_date + timedelta(days=1)
        penalty_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end

        if penalty_start <= penalty_end:
            penalty_days = pd.date_range(penalty_start, penalty_end, freq='D')
            penalty_day_count = sum(1 for d in penalty_days if month_start <= d <= month_end)

            if penalty_day_count > 0:
                daily_penalty = (price * penalty_rate) / ANNUAL_RATE_TO_DAILY_DIVISOR
                penalty_charge = daily_penalty * penalty_day_count
                dealer_desc['Penalty'] = penalty_day_count

    total_dealer_charge = dealer_charge + penalty_charge
    ram_desc_txt = ', '.join(f"{v}d: {k}" for k, v in ram_desc.items())
    dealer_desc_txt = ', '.join(
        f"{v}d: {k}" if k != 'Penalty' else f"{v}d: Penalty @ {penalty_rate}%"
        for k, v in dealer_desc.items()
    )

    if pd.notna(paid_date):
        aging = (paid_date - alloc_date).days
    else:
        aging = (month_end - alloc_date).days + 1
    aging = max(aging, 0)

    return pd.Series([
        round(ram_charge, 2),
        round(ram_charge_actual, 2),
        round(total_dealer_charge, 2),
        ram_charge_freeday_days_this_month,
        ram_desc_txt,
        dealer_desc_txt,
        len(ram_charge_actual_days),
        aging
    ])


def create_excel_output(
    df_ar: pd.DataFrame,
    df_summary: pd.DataFrame,
    df_rental_summary: pd.DataFrame,
    month_end: pd.Timestamp,
    is_waive: bool = False,
) -> str:
    """Create Excel workbook with summary, detail, and dealer summary sheets"""
    wb = Workbook()

    # ===== Sheet 1: Summary =====
    ws_summary = wb.active
    ws_summary.title = 'Summary'
    summary_display = df_summary.reset_index().rename(columns={'index': 'Description'})

    for r in dataframe_to_rows(summary_display, index=False, header=True):
        ws_summary.append(r)

    # ===== Sheet 2: AR Detail =====
    desired_order = [
        'Dealer Group', 'Dealer Code', 'Dealer Name', 'Model', 'VIN Number',
        'Price (Ex. Vat)', 'Allocation Date', 'Contract Number', 'Subvention Campaign',
        'Source', 'Payment Date', 'Paid', 'Free Days', 'Due Date', 'Aging',
        'RAM Charge FreeDay (This Month)', 'RAM Charge (bf)', 'RAM Charge',
        'Dealer Charge', 'waive amount', 'RAM Charge (After Waive)',
        'Dealer Charge (After Waive)', 'RAM Rate Summary', 'Dealer Rate Summary', 'reason'
    ]

    df_ar_export = df_ar[[col for col in desired_order if col in df_ar.columns]].copy()

    ws_detail = wb.create_sheet(title='AR Detail')
    for r in dataframe_to_rows(df_ar_export, index=False, header=True):
        ws_detail.append(r)

    # ===== Sheet 3: Dealer Summary =====
    ws_dealer_summary = wb.create_sheet(title='Dealer Summary')
    for r in dataframe_to_rows(df_rental_summary, index=False, header=True):
        ws_dealer_summary.append(r)

    # ===== Format Tables =====
    def add_table(ws: Worksheet, table_name: str) -> None:
        if ws.max_row > 0:
            last_col = ws.max_column
            last_row = ws.max_row
            last_col_letter = get_column_letter(last_col)
            tab = Table(displayName=table_name, ref=f'A1:{last_col_letter}{last_row}')
            style = TableStyleInfo(name='TableStyleMedium9', showRowStripes=True)
            tab.tableStyleInfo = style
            ws.add_table(tab)

    def format_currency_column(ws: Worksheet, col_name: str) -> None:
        for cell in ws[1]:
            if cell.value == col_name:
                col_letter = cell.column_letter
                for row in range(2, ws.max_row + 1):
                    cell = ws[f'{col_letter}{row}']
                    cell.number_format = '#,##0.00'
                    cell.alignment = Alignment(horizontal='right')

    add_table(ws_summary, 'SummaryTable')
    add_table(ws_detail, 'DetailTable')
    add_table(ws_dealer_summary, 'DealerSummaryTable')

    for col in ['Amount (THB)']:
        format_currency_column(ws_summary, col)

    for col in ['Price (Ex. Vat)', 'RAM Charge (bf)', 'RAM Charge', 'Dealer Charge',
                'waive amount', 'RAM Charge (After Waive)', 'Dealer Charge (After Waive)']:
        format_currency_column(ws_detail, col)

    for col in ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']:
        format_currency_column(ws_dealer_summary, col)

    for ws in [ws_summary, ws_detail, ws_dealer_summary]:
        for column_cells in ws.columns:
            max_len = max(len(str(cell.value)) if cell.value else 0 for cell in column_cells)
            ws.column_dimensions[get_column_letter(column_cells[0].column)].width = max_len + 2

    # ===== Save File =====
    month_str = month_end.strftime('%b')
    year_str = month_end.strftime('%Y')
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S' if not is_waive else '%Y%m%d_%H%M')

    folder = OUTPUT_WAIVE_FOLDER if is_waive else OUTPUT_FOLDER
    filename = f"AR_Summary_{month_str}{year_str}{'_After_Waive' if is_waive else ''}_{timestamp_str}.xlsx"
    filepath = os.path.join(folder, filename)

    wb.save(filepath)
    return filepath


def append_dealer_summary_totals(
    df_rental_summary: pd.DataFrame, df_dealer_summary: pd.DataFrame, df_ram_summary: pd.DataFrame
) -> pd.DataFrame:
    """Append 'Total Charge to Dealer' / 'Total RAM Rever Automotive' grand-total rows"""
    sum_cols = ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']

    def total_row(label: str, df_group: pd.DataFrame) -> pd.Series:
        sums = df_group[sum_cols].sum() if len(df_group) > 0 else pd.Series(0.0, index=sum_cols)
        return pd.Series({
            'Dealer Group': '',
            'Dealer Code': '',
            'Dealer Name': label,
            'AR Master Code': '',
            **sums.to_dict(),
        })

    totals = pd.DataFrame([
        total_row('Total Charge to Dealer', df_dealer_summary),
        total_row('Total RAM Rever Automotive', df_ram_summary),
    ])
    return pd.concat([df_rental_summary, totals], ignore_index=True)


def _load_waive_dataframe(waive_file_path: str) -> pd.DataFrame:
    """Load the waive file and keep only approved (Y) rows."""
    df_waive = pd.read_excel(waive_file_path)
    df_waive['Dealer Code'] = df_waive['Dealer Code'].astype(str).str.strip()
    df_waive['VIN Number'] = df_waive['VIN Number'].astype(str).str.strip()
    df_waive = df_waive[df_waive['approved'].astype(str).str.upper() == 'Y']
    df_waive['waive amount'] = df_waive['waive amount'].fillna(0)
    return df_waive


def _load_ar_dataframe(
    ar_file_path: str,
    last_month_label: str,
    is_waive_run: bool,
    df_waive: pd.DataFrame | None,
) -> pd.DataFrame:
    """Load the AR Last Month / New Volume / All Payment / Penalty sheets, merge them
    into one dataframe, and merge in waive amounts when df_waive is given."""
    xls = pd.ExcelFile(ar_file_path, engine='openpyxl')
    sheet_names = xls.sheet_names

    sheet_last, sheet_new, sheet_all, sheet_penalty = locate_ar_sheets(sheet_names, last_month_label)

    if not is_waive_run and not all([sheet_last, sheet_new, sheet_all]):
        raise CalculationValidationError('Missing required sheets')

    df_ar_lastmonth = xls.parse(sheet_last, header=1)
    df_new_volume = xls.parse(sheet_new, header=1)
    df_all_payment = xls.parse(sheet_all, header=1)

    df_ar_lastmonth = prepare_ar_data(df_ar_lastmonth, 'AR Last Month')
    df_new_volume = prepare_ar_data(df_new_volume, 'New Volume')

    df_all_payment.columns = df_all_payment.columns.astype(str).str.strip()
    if is_waive_run:
        payment_date_col = 'Payment Date' if 'Payment Date' in df_all_payment.columns else 'Date'
    else:
        payment_date_col = 'Payment Date' if 'Payment Date' in df_all_payment.columns else (
            'Date' if 'Date' in df_all_payment.columns else None
        )
        if not payment_date_col:
            raise CalculationValidationError('Payment date column not found')

    df_all_payment = df_all_payment[['VIN No.', payment_date_col]].copy()
    df_all_payment.rename(columns={'VIN No.': 'VIN Number', payment_date_col: 'Payment Date'}, inplace=True)

    df_penalty = load_penalty_sheet(xls, sheet_penalty)

    df_ar_current = pd.concat([df_new_volume, df_ar_lastmonth], ignore_index=True)
    df_ar_current['Subvention Campaign'] = df_ar_current['Subvention Campaign'].fillna('Normal').replace('', 'Normal')
    df_ar_current = df_ar_current[~(df_ar_current['Dealer Group'].isna() | (df_ar_current['Dealer Group'].astype(str).str.strip() == ''))]

    df_ar_current = df_ar_current.merge(df_all_payment, on='VIN Number', how='left')
    df_ar_current['Paid'] = df_ar_current['Payment Date'].notna().map({True: 'Y', False: 'N'})
    df_ar_current = df_ar_current.merge(df_penalty, on='VIN Number', how='left')

    if is_waive_run:
        df_ar_current = df_ar_current.merge(
            df_waive[['Dealer Code', 'VIN Number', 'waive amount', 'reason']],
            on=['Dealer Code', 'VIN Number'],
            how='left'
        )
        df_ar_current['waive amount'] = df_ar_current['waive amount'].fillna(0)
        df_ar_current['reason'] = df_ar_current['reason'].fillna('')

    return df_ar_current


def _calculate_charges(
    df_ar_current: pd.DataFrame,
    config_data: dict[str, Any],
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    penalty_rate: float,
    is_waive_run: bool,
) -> pd.DataFrame:
    """Run calculate_detailed_charge() over every row, then derive the
    After-Waive / AR Master Code columns."""
    df_rate = config_data['rates'].copy()
    df_rate.columns = df_rate.columns.str.strip()
    df_rate.rename(columns={'Start Day': 'StartDay', 'End Day': 'EndDay', 'Rate (%)': 'Rate'}, inplace=True)

    df_subvention = config_data['subventions'].copy()
    df_subvention.columns = df_subvention.columns.str.strip()

    rate_ranges = prepare_rate_ranges(df_rate.to_dict('records'))
    subvention_map = df_subvention.set_index('Campaign Name')['Free Days'].to_dict()
    df_ar_current['Free Days'] = df_ar_current['Subvention Campaign'].map(subvention_map).fillna(0).astype(int)

    df_ar_current[[
        'RAM Charge', 'RAM Charge (bf)', 'Dealer Charge',
        'RAM Charge FreeDay (This Month)', 'RAM Rate Summary',
        'Dealer Rate Summary', 'Actual Used Days (This Month)', 'Aging'
    ]] = df_ar_current.apply(
        lambda row: calculate_detailed_charge(row, rate_ranges, month_start, month_end, penalty_rate),
        axis=1
    )

    df_ar_current['Dealer Code'] = df_ar_current['Dealer Code'].astype(str).str.zfill(DEALER_CODE_DIGITS)
    df_ar_current['Contract Number'] = df_ar_current['Contract Number'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True)

    if is_waive_run:
        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge'] + df_ar_current['waive amount']
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge'] - df_ar_current['waive amount']
        df_ar_current['AR Master Code'] = df_ar_current['Dealer Charge (After Waive)'].apply(
            lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
        )
    else:
        # Pre-Waive: no waive columns should exist yet (spec 3.3.7).
        df_ar_current['AR Master Code'] = df_ar_current['Dealer Charge'].apply(
            lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
        )

    return df_ar_current


def _build_stats_and_distributions(
    df_ar_current: pd.DataFrame, is_waive_run: bool
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """Compute the stats block, campaign distribution, and summary-by-dealer-code —
    all read numeric charge columns, so this must run before export formatting."""
    stats: dict[str, Any] = {
        'rowsProcessed': int(len(df_ar_current)),
        'totalRamCharge': float(pd.to_numeric(df_ar_current['RAM Charge'], errors='coerce').fillna(0).sum()),
        'totalDealerCharge': float(pd.to_numeric(df_ar_current['Dealer Charge'], errors='coerce').fillna(0).sum()),
        'mismatchCount': 0,
    }
    if is_waive_run:
        stats['totalWaive'] = float(pd.to_numeric(df_ar_current['waive amount'], errors='coerce').fillna(0).sum())

    campaign_counts = (
        df_ar_current.assign(**{
            'Subvention Campaign': df_ar_current['Subvention Campaign'].fillna('Normal').astype(str)
        })
        .groupby('Subvention Campaign', dropna=False)
        .size()
        .reset_index(name='vins')
        .sort_values('vins', ascending=False)
    )
    campaign_distribution = [
        {'campaign': str(row['Subvention Campaign']), 'vins': int(row['vins'])}
        for _, row in campaign_counts.iterrows()
    ]

    summary_by_dealer = (
        df_ar_current.groupby(['Dealer Code', 'Dealer Name'], dropna=False)
        .agg(
            vins=('VIN Number', 'count'),
            ramCharge=('RAM Charge', 'sum'),
            dealerCharge=('Dealer Charge', 'sum'),
            arAmount=('Price (Ex. Vat)', 'sum'),
        )
        .reset_index()
        .sort_values('arAmount', ascending=False)
    )
    summary_by_dealer_code = [
        {
            'dealerCode': str(row['Dealer Code']),
            'dealerName': str(row['Dealer Name']),
            'vins': int(row['vins']),
            'ramCharge': float(row['ramCharge']),
            'dealerCharge': float(row['dealerCharge']),
            'arAmount': float(row['arAmount']),
        }
        for _, row in summary_by_dealer.iterrows()
    ]

    return stats, campaign_distribution, summary_by_dealer_code


def _build_price_summary(df_ar_current: pd.DataFrame) -> tuple[dict[str, float], pd.DataFrame]:
    """Build the Summary sheet's price-category totals (numeric dict + display dataframe)."""
    price_numeric = pd.to_numeric(df_ar_current['Price (Ex. Vat)'], errors='coerce').fillna(0)
    summary = {
        'AR Last Month': float(price_numeric[df_ar_current['Source'] == 'AR Last Month'].sum()),
        'New Volume': float(price_numeric[df_ar_current['Source'] == 'New Volume'].sum()),
        'All Payment (Paid=Y)': float(price_numeric[df_ar_current['Paid'] == 'Y'].sum()),
        'AR Outstanding (Paid=N)': float(price_numeric[df_ar_current['Paid'] == 'N'].sum()),
    }
    summary['Total'] = float(sum(summary.values()))

    summary_df = pd.DataFrame.from_dict(summary, orient='index', columns=['Amount (THB)'])
    summary_df['Amount (THB)'] = summary_df['Amount (THB)'].map('{:,.2f}'.format)

    return summary, summary_df


def _build_dealer_summary(df_ar_current: pd.DataFrame, is_waive_run: bool) -> pd.DataFrame:
    """Split RAM/Dealer buckets, apply WHT/VAT, group by dealer, and append grand totals."""
    ram_amount_col = 'RAM Charge (After Waive)' if is_waive_run else 'RAM Charge'
    dealer_amount_col = 'Dealer Charge (After Waive)' if is_waive_run else 'Dealer Charge'
    df_ram = df_ar_current[df_ar_current[ram_amount_col] > 0].copy()
    df_dealer = df_ar_current[df_ar_current[dealer_amount_col] > 0].copy()

    def create_dealer_summary(
        df_group: pd.DataFrame, ar_code: str, amount_col: str, wht_rate: float
    ) -> pd.DataFrame:
        df_group = df_group.copy()
        df_group['AR Master Code'] = ar_code
        df_group['Amount per calculation'] = df_group[amount_col]
        df_group['Waive'] = (
            pd.to_numeric(df_group['waive amount'], errors='coerce').fillna(0)
            if is_waive_run else 0.0
        )
        df_group['WHT'] = df_group['Amount per calculation'] * wht_rate
        df_group['VAT'] = df_group['Amount per calculation'] * VAT_RATE
        df_group['Total Receivable'] = df_group['Amount per calculation'] - df_group['WHT'] + df_group['VAT']
        df_group['Total'] = df_group['Amount per calculation'] + df_group['VAT']

        return df_group[[
            'Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master Code',
            'Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total'
        ]]

    df_ram_summary = create_dealer_summary(df_ram, 'RAM Rever Automotive', ram_amount_col, RAM_WHT_RATE)
    df_dealer_summary = create_dealer_summary(df_dealer, 'Charge to Dealer', dealer_amount_col, DEALER_WHT_RATE)

    group_cols = ['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master Code']
    sum_cols = ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']

    if is_waive_run:
        if len(df_ram_summary) > 0:
            df_ram_summary = df_ram_summary.groupby(group_cols, as_index=False)[sum_cols].sum()
        if len(df_dealer_summary) > 0:
            df_dealer_summary = df_dealer_summary.groupby(group_cols, as_index=False)[sum_cols].sum()
    else:
        df_ram_summary = df_ram_summary.groupby(group_cols, as_index=False)[sum_cols].sum()
        df_dealer_summary = df_dealer_summary.groupby(group_cols, as_index=False)[sum_cols].sum()

    df_rental_summary = pd.concat([df_dealer_summary, df_ram_summary], ignore_index=True)
    return append_dealer_summary_totals(df_rental_summary, df_dealer_summary, df_ram_summary)


def _format_ar_detail_for_export(
    df_ar_current: pd.DataFrame, month_end: pd.Timestamp, is_waive_run: bool
) -> pd.DataFrame:
    """Format date/currency columns for the AR Detail sheet and API response. Must run
    last — every other step above needs these columns as numbers, not display strings."""
    df_ar_current['Allocation Date'] = pd.to_datetime(df_ar_current['Allocation Date'], errors='coerce').dt.strftime('%d/%m/%Y')
    df_ar_current['Payment Date'] = pd.to_datetime(df_ar_current['Payment Date'], errors='coerce').fillna(month_end).dt.strftime('%d/%m/%Y')
    df_ar_current['Due Date'] = pd.to_datetime(df_ar_current['Due Date'], errors='coerce').dt.strftime('%d/%m/%Y').replace('NaT', '')

    df_ar_current['Price (Ex. Vat)'] = df_ar_current['Price (Ex. Vat)'].astype(float).map('{:,.2f}'.format)
    df_ar_current['RAM Charge'] = df_ar_current['RAM Charge'].astype(float).map('{:,.2f}'.format)
    df_ar_current['RAM Charge (bf)'] = df_ar_current['RAM Charge (bf)'].astype(float).map('{:,.2f}'.format)
    df_ar_current['Dealer Charge'] = df_ar_current['Dealer Charge'].astype(float).map('{:,.2f}'.format)

    if is_waive_run:
        df_ar_current['waive amount'] = df_ar_current['waive amount'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge (After Waive)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge (After Waive)'].astype(float).map('{:,.2f}'.format)

    return df_ar_current


def _run_calculation_pipeline(
    ar_file_path: str,
    config_data: dict[str, Any],
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    penalty_rate: float,
    last_month_label: str,
    waive_file_path: str | None = None,
) -> dict[str, Any]:
    """
    Shared pipeline for /api/calculate (Pre-Waive) and /api/calculate-with-waive
    (Post-Waive) — pass waive_file_path to run Post-Waive.

    Returns the payload dict, or raises CalculationValidationError.

    Note: only Pre-Waive validates the AR sheets/payment-date column; this
    asymmetry is intentional (preserved from before the two routes were merged).
    """
    is_waive_run = waive_file_path is not None
    df_waive = _load_waive_dataframe(waive_file_path) if is_waive_run else None

    df_ar_current = _load_ar_dataframe(ar_file_path, last_month_label, is_waive_run, df_waive)
    df_ar_current = _calculate_charges(
        df_ar_current, config_data, month_start, month_end, penalty_rate, is_waive_run
    )

    stats, campaign_distribution, summary_by_dealer_code = _build_stats_and_distributions(
        df_ar_current, is_waive_run
    )
    summary, summary_df = _build_price_summary(df_ar_current)
    df_rental_summary = _build_dealer_summary(df_ar_current, is_waive_run)

    df_ar_current = _format_ar_detail_for_export(df_ar_current, month_end, is_waive_run)

    output_path = create_excel_output(df_ar_current, summary_df, df_rental_summary, month_end, is_waive=is_waive_run)

    return clean_nan_values({
        'success': True,
        'message': 'Recalculated with waive conditions applied' if is_waive_run else 'Calculation completed',
        'outputPath': output_path,
        'stats': stats,
        'campaignDistribution': campaign_distribution,
        'mismatches': [],
        'summary': summary,
        'summaryByDealerCode': summary_by_dealer_code,
        'detailRecords': df_ar_current.to_dict('records'),
        'dealerSummary': df_rental_summary.to_dict('records'),
    })


# ============= API ENDPOINTS =============


@app.errorhandler(Exception)
def handle_unexpected_error(error: Exception):
    """Catch-all JSON error response for routes without their own try/except."""
    return jsonify({'error': str(error)}), 400


@app.route('/api/config', methods=['GET'])
def get_config():
    """Get configuration, rates, and subventions"""
    config_data = load_config()
    config = config_data['config']

    month_end = pd.to_datetime(config.get('Month End Date'), dayfirst=True, errors='coerce')
    if pd.isna(month_end):
        return jsonify({'error': 'Invalid Month End Date in config'}), 400

    full_month_days = config.get('Full Month Days')
    if full_month_days is None or (isinstance(full_month_days, float) and pd.isna(full_month_days)):
        full_month_days = int(month_end.days_in_month)
    else:
        full_month_days = int(full_month_days)

    penalty_rate = config.get('Penalty Rate', 15)
    try:
        penalty_rate = float(penalty_rate)
    except (TypeError, ValueError):
        penalty_rate = 15.0

    result = {
        'config': {
            'monthEndDate': month_end.strftime('%d-%m-%Y'),
            'fullMonthDays': full_month_days,
            'penaltyRate': penalty_rate,
            'month': month_end.strftime('%B'),
            'year': str(month_end.year),
        },
        'rates': config_data['rates'].to_dict('records'),
        'subventions': config_data['subventions'].to_dict('records')
    }

    result = clean_nan_values(result)
    return jsonify(result)


@app.route('/api/upload', methods=['POST'])
def upload_ar():
    """Upload and preview AR file"""
    if 'ar_file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['ar_file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    xls = pd.ExcelFile(filepath, engine='openpyxl')
    sheet_names = xls.sheet_names

    preview_tables = {}
    record_counts = {}

    for sheet in sheet_names:
        try:
            header = 0 if 'penalty' in sheet.lower() else 1
            df = pd.read_excel(xls, sheet_name=sheet, header=header)
            preview_tables[sheet] = df.head(5).to_html(classes='table table-sm', index=False)
            record_counts[sheet] = int(len(df))
        except Exception:
            preview_tables[sheet] = '<p>Error reading sheet</p>'
            record_counts[sheet] = 0

    return jsonify({
        'fileName': filename,
        'filePath': filepath,
        'sheetNames': sheet_names,
        'previewTables': preview_tables,
        'recordCounts': record_counts
    })


@app.route('/api/upload-waive', methods=['POST'])
def upload_waive():
    """Upload and preview waive file"""
    if 'waive_file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['waive_file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not file.filename.lower().endswith('.xlsx'):
        return jsonify({'error': 'Only .xlsx files are accepted for the waive file'}), 400

    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"waive_input_{timestamp}.xlsx"
    filepath = os.path.join(AR_INPUT_FOLDER, filename)
    file.save(filepath)

    df = pd.read_excel(filepath)
    df.columns = df.columns.astype(str).str.strip()

    missing_columns = [col for col in WAIVE_REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        os.remove(filepath)
        return jsonify({
            'error': f"Waive file is missing required column(s): {', '.join(missing_columns)}"
        }), 400

    preview_table = df.head(5).to_html(classes='table table-sm', index=False)
    approved_count = len(df[df['approved'].astype(str).str.upper() == 'Y'])

    return jsonify({
        'fileName': filename,
        'filePath': filepath,
        'sheetNames': ['Waive Data'],
        'previewTables': {'Waive Data': preview_table},
        'recordCounts': {'Waive Data': len(df)},
        'approvedCount': approved_count
    })


@app.route('/api/calculate', methods=['POST'])
def calculate():
    """Calculate charges without waive"""
    try:
        data = request.json
        file_path = data.get('filePath')

        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 400

        # Load config (rates/subventions from Excel; period/penalty prefer UI)
        config_data = load_config()
        config = config_data['config']
        month_start, month_end, penalty_rate, last_month_label = resolve_run_period(data, config)

        payload = _run_calculation_pipeline(
            file_path, config_data, month_start, month_end, penalty_rate, last_month_label
        )
        return jsonify(payload)
    except CalculationValidationError as e:
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        return jsonify({'error': str(e), 'details': traceback.format_exc()}), 400


@app.route('/api/calculate-with-waive', methods=['POST'])
def calculate_with_waive():
    """Calculate charges with waive applied"""
    try:
        data = request.json
        ar_file_path = data.get('arFilePath')
        waive_file_path = data.get('waiveFilePath')

        if not ar_file_path or not os.path.exists(ar_file_path):
            return jsonify({'error': 'AR file not found'}), 400

        if not waive_file_path or not os.path.exists(waive_file_path):
            return jsonify({'error': 'Waive file not found'}), 400

        # Load config (rates/subventions from Excel; period/penalty prefer UI)
        config_data = load_config()
        config = config_data['config']
        month_start, month_end, penalty_rate, last_month_label = resolve_run_period(data, config)

        payload = _run_calculation_pipeline(
            ar_file_path, config_data, month_start, month_end, penalty_rate, last_month_label,
            waive_file_path=waive_file_path
        )
        return jsonify(payload)
    except CalculationValidationError as e:
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        return jsonify({'error': str(e), 'details': traceback.format_exc()}), 400


@app.route('/api/download', methods=['GET'])
def download():
    """Download generated Excel file"""
    file_path = request.args.get('filePath')
    if not file_path or not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404

    return send_file(file_path, as_attachment=True)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
