"""Interest calculation engine: per-VIN charges, the AR-file pipeline, Excel
export, and Campaign Master term resolution."""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
from dateutil.relativedelta import relativedelta
from openpyxl import Workbook
from openpyxl.styles import Alignment
from openpyxl.utils import get_column_letter
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.worksheet import Worksheet

from .campaign_utils import load_campaigns
from .errors import CalculationValidationError
from .paths import CONFIG_PATH, OUTPUT_FOLDER, OUTPUT_WAIVE_FOLDER

DAYS_PER_YEAR = 365
# Converts an annual rate% (e.g. 12) directly to a daily amount: price * rate / 100 / 365.
ANNUAL_RATE_TO_DAILY_DIVISOR = 100 * DAYS_PER_YEAR
VAT_RATE = 0.07
RAM_WHT_RATE = 0.03
DEALER_WHT_RATE = 0.05
DEALER_CODE_DIGITS = 5


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


def _parse_config_month_end(config: dict[str, Any]) -> pd.Timestamp:
    """Parse the Config sheet's 'Month End Date' cell; returns NaT if missing/invalid."""
    return pd.to_datetime(config.get('Month End Date'), dayfirst=True, errors='coerce')


def _parse_config_penalty_rate(config: dict[str, Any]) -> float:
    """Parse the Config sheet's 'Penalty Rate' cell, defaulting to 15.0 if missing/invalid."""
    try:
        return float(config.get('Penalty Rate', 15))
    except (TypeError, ValueError):
        return 15.0


def resolve_run_period(
    request_data: dict[str, Any], excel_config: dict[str, Any]
) -> tuple[pd.Timestamp, pd.Timestamp, float, str]:
    """Resolve (month_start, month_end, penalty_rate, last_month_label); UI request
    takes priority, falling back to the Excel config."""
    month = request_data.get('month')
    year = request_data.get('year')
    penalty = request_data.get('penaltyRate')

    if month is not None and year is not None and str(month).strip() and str(year).strip():
        month_start = pd.to_datetime(f"1 {month} {year}", errors='coerce')
        if pd.isna(month_start):
            raise ValueError(f"Invalid month/year from UI: {month} {year}")
        month_end = month_start + relativedelta(day=31)
    else:
        month_end = _parse_config_month_end(excel_config)
        if pd.isna(month_end):
            raise ValueError('Invalid Month End Date in config')
        month_start = month_end.replace(day=1)

    if penalty is not None and penalty != '':
        try:
            penalty_rate = float(penalty)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid penaltyRate from UI: {penalty}")
    else:
        penalty_rate = _parse_config_penalty_rate(excel_config)

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


def load_sot_sheet(sot_file_path: str | None) -> pd.DataFrame:
    """Load and standardize the optional SOT file (VIN Number, SOT Start Date)."""
    df_sot = pd.DataFrame(columns=['VIN Number', 'SOT Start Date'])
    if sot_file_path:
        df_sot = pd.read_excel(sot_file_path, header=0)
        df_sot.columns = df_sot.columns.astype(str).str.strip()
        if 'VIN No.' in df_sot.columns:
            df_sot.rename(columns={'VIN No.': 'VIN Number'}, inplace=True)
        df_sot['SOT Start Date'] = pd.to_datetime(df_sot['SOT Start Date'], errors='coerce')
        df_sot = df_sot[['VIN Number', 'SOT Start Date']].dropna(subset=['SOT Start Date'])
    return df_sot


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


def _daily_interest(price: float, rate: float) -> float:
    """The daily interest amount for one day at an annual rate%."""
    return (price * float(rate)) / ANNUAL_RATE_TO_DAILY_DIVISOR


def _rate_key(rate_rec: dict[str, Any]) -> str:
    """Display key identifying which rate-table row applied on a given day."""
    return f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"


def _compute_ram_charge_free_days(
    alloc_date: pd.Timestamp,
    free_days: int,
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    price: float,
    rate_ranges: list[dict[str, Any]],
) -> tuple[float, int, str]:
    """RAM Charge during the free-days period, clipped to this month."""
    free_day_actual_end = alloc_date + timedelta(days=free_days - 1)
    last_free_day = min(free_day_actual_end, month_end)
    ram_charge_days = pd.date_range(alloc_date, last_free_day, freq='D')
    ram_charge_freeday_days_this_month = int(((ram_charge_days >= month_start) & (ram_charge_days <= month_end)).sum())

    ram_charge = 0.0
    ram_desc = {}

    for d in ram_charge_days:
        day_count = (d - alloc_date).days + 1
        rate_rec = find_rate_for_day(rate_ranges, day_count, d)

        if month_start <= d <= month_end and rate_rec:
            ram_charge += _daily_interest(price, rate_rec['Rate'])
            rate_key = _rate_key(rate_rec)
            ram_desc[rate_key] = ram_desc.get(rate_key, 0) + 1

    ram_desc_txt = ', '.join(f"{v}d: {k}" for k, v in ram_desc.items())
    return ram_charge, ram_charge_freeday_days_this_month, ram_desc_txt


def _compute_ram_charge_actual(
    alloc_date: pd.Timestamp,
    paid_date: pd.Timestamp,
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    price: float,
    rate_ranges: list[dict[str, Any]],
) -> tuple[float, int]:
    """RAM Charge over the full period (unclipped) — the 'if never paid' projection."""
    ram_charge_actual_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end
    ram_charge_actual_days = pd.date_range(max(alloc_date, month_start), ram_charge_actual_end, freq='D')
    ram_charge_actual = 0.0

    for d in ram_charge_actual_days:
        day_count = (d - alloc_date).days + 1
        rate_rec = find_rate_for_day(rate_ranges, day_count, d)

        if rate_rec:
            ram_charge_actual += _daily_interest(price, rate_rec['Rate'])

    return ram_charge_actual, len(ram_charge_actual_days)


def _compute_dealer_and_penalty_charge(
    alloc_date: pd.Timestamp,
    due_date: pd.Timestamp,
    paid_date: pd.Timestamp,
    sot_start_date: pd.Timestamp,
    free_days: int,
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    price: float,
    penalty_rate: float,
    rate_ranges: list[dict[str, Any]],
) -> tuple[float, str]:
    """Dealer Charge (post-free-days, with SOT override) plus Penalty Charge past the Due Date."""
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
            if not (month_start <= d <= month_end):
                continue

            # SOT override: from SOT Start Date, use the flat Penalty Rate instead of
            # the rate table. Dealer Charge only, never RAM Charge.
            if pd.notna(sot_start_date) and d >= sot_start_date:
                dealer_charge += _daily_interest(price, penalty_rate)
                dealer_desc['SOT Override'] = dealer_desc.get('SOT Override', 0) + 1
                continue

            day_count = (d - alloc_date).days + 1
            rate_rec = find_rate_for_day(rate_ranges, day_count, d)
            if rate_rec:
                dealer_charge += _daily_interest(price, rate_rec['Rate'])
                rate_key = _rate_key(rate_rec)
                dealer_desc[rate_key] = dealer_desc.get(rate_key, 0) + 1

    if pd.notna(due_date):
        penalty_start = due_date + timedelta(days=1)
        penalty_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end

        if penalty_start <= penalty_end:
            penalty_days = pd.date_range(penalty_start, penalty_end, freq='D')
            penalty_day_count = int(((penalty_days >= month_start) & (penalty_days <= month_end)).sum())

            if penalty_day_count > 0:
                penalty_charge = _daily_interest(price, penalty_rate) * penalty_day_count
                dealer_desc['Penalty'] = penalty_day_count

    total_dealer_charge = dealer_charge + penalty_charge
    dealer_desc_txt = ', '.join(
        f"{v}d: {k} @ {penalty_rate}%" if k in ('Penalty', 'SOT Override') else f"{v}d: {k}"
        for k, v in dealer_desc.items()
    )
    return total_dealer_charge, dealer_desc_txt


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
    sot_start_date = pd.to_datetime(row.get('SOT Start Date'), errors='coerce')
    free_days = int(row.get('Free Days', 0))
    # A matched Campaign Master quota row overrides the standard rate table for this VIN —
    # even when that campaign's own table is empty (`is not None`, not truthiness: an empty
    # list must stay empty, not silently fall back to the standard table).
    campaign_rate_override = row.get('_CampaignRateOverride')
    rate_ranges = campaign_rate_override if campaign_rate_override is not None else rate_ranges

    if pd.isna(alloc_date):
        return pd.Series([0.0, 0.0, 0.0, 0, '', '', 0, 0])

    ram_charge, ram_charge_freeday_days_this_month, ram_desc_txt = _compute_ram_charge_free_days(
        alloc_date, free_days, month_start, month_end, price, rate_ranges
    )
    ram_charge_actual, actual_used_days = _compute_ram_charge_actual(
        alloc_date, paid_date, month_start, month_end, price, rate_ranges
    )
    total_dealer_charge, dealer_desc_txt = _compute_dealer_and_penalty_charge(
        alloc_date, due_date, paid_date, sot_start_date, free_days,
        month_start, month_end, price, penalty_rate, rate_ranges
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
        actual_used_days,
        aging
    ])


def _write_dataframe_to_sheet(ws: Worksheet, df: pd.DataFrame) -> None:
    """Write a dataframe (header + rows) into a worksheet, starting at A1."""
    for r in dataframe_to_rows(df, index=False, header=True):
        ws.append(r)


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
    _write_dataframe_to_sheet(ws_summary, summary_display)

    # ===== Sheet 2: AR Detail =====
    desired_order = [
        'Dealer Group', 'Dealer Code', 'Dealer Name', 'Model', 'VIN Number',
        'Price (Ex. Vat)', 'Allocation Date', 'Contract Number', 'Subvention Campaign',
        'Source', 'Payment Date', 'Paid', 'Free Days', 'Due Date', 'SOT Start Date', 'Aging',
        'RAM Charge FreeDay (This Month)', 'RAM Charge (bf)', 'RAM Charge',
        'Dealer Charge', 'waive amount', 'RAM Charge (After Waive)',
        'Dealer Charge (After Waive)', 'RAM Rate Summary', 'Dealer Rate Summary', 'reason'
    ]

    df_ar_export = df_ar[[col for col in desired_order if col in df_ar.columns]].copy()

    ws_detail = wb.create_sheet(title='AR Detail')
    _write_dataframe_to_sheet(ws_detail, df_ar_export)

    # ===== Sheet 3: Dealer Summary =====
    ws_dealer_summary = wb.create_sheet(title='Dealer Summary')
    _write_dataframe_to_sheet(ws_dealer_summary, df_rental_summary)

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
    df_sot: pd.DataFrame,
) -> pd.DataFrame:
    """Load and merge the AR Last Month/New Volume/All Payment/Penalty sheets, plus SOT and waive data."""
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
    df_ar_current = df_ar_current.merge(df_sot, on='VIN Number', how='left')

    if is_waive_run:
        df_ar_current = df_ar_current.merge(
            df_waive[['Dealer Code', 'VIN Number', 'waive amount', 'reason']],
            on=['Dealer Code', 'VIN Number'],
            how='left'
        )
        df_ar_current['waive amount'] = df_ar_current['waive amount'].fillna(0)
        df_ar_current['reason'] = df_ar_current['reason'].fillna('')
    else:
        # Pre-Waive: these columns still exist (0 / blank) — only the After-Waive
        # columns are absent this run (added in _calculate_charges when is_waive_run).
        df_ar_current['waive amount'] = 0
        df_ar_current['reason'] = ''

    return df_ar_current


# Trim words BYD's AR export appends after the model name (e.g. 'SEALION 7 AWD') that
# Campaign Master doesn't include. Flag new variant words seen in future files to the PO.
_MODEL_TRIM_KEYWORDS = {'PREMIUM', 'DYNAMIC', 'PERFORMANCE', 'AWD', 'RWD', 'EXTENDED', 'STD', 'EXT', 'DELUXE'}


def _normalize_model(model: Any) -> str:
    """Normalize a Model for matching: drop parenthetical specs and trim keywords,
    collapse separators, so 'SEALION 7 AWD' matches 'SEALION7' without colliding with 'SEAL'."""
    if model is None or (isinstance(model, float) and pd.isna(model)):
        return ''
    text = re.sub(r'\([^)]*\)', ' ', str(model).upper())
    tokens = [t for t in re.split(r'[\s\-]+', text) if t and t not in _MODEL_TRIM_KEYWORDS]
    return ''.join(tokens)


def _parse_dealer_list(value: Any) -> set[str]:
    """Normalize an Exception field into a set of dealer codes — a list (current UI shape),
    or (legacy) a comma/newline separated free-text string."""
    if not value:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(v).strip() for v in value if str(v).strip()}
    return {part.strip() for part in re.split(r'[,\n]+', str(value)) if part.strip()}


def _load_active_campaign_index() -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Build VIN-matching lookups from Campaign Master: name -> terms map, plus a flat
    quota-row index to match VINs against. Only Active campaigns are included."""
    campaigns_by_name: dict[str, dict[str, Any]] = {}
    quota_index: list[dict[str, Any]] = []

    for campaign in load_campaigns():
        if campaign.get('status', 'Active') != 'Active':
            continue

        rate_ranges = prepare_rate_ranges([
            {
                'StartDay': tier.get('startDay', 0),
                'EndDay': tier.get('endDay', 0),
                'Rate': tier.get('rate', 0.0),
                'EffectiveStart': tier['effectiveStart'],
                'EffectiveEnd': tier['effectiveEnd'],
                'IsActive': tier.get('active', True),
            }
            for tier in campaign.get('rateTiers', [])
            if tier.get('effectiveStart') and tier.get('effectiveEnd')
        ])

        campaigns_by_name[campaign['name'].strip().lower()] = {
            'code': campaign['code'],
            'name': campaign['name'],
            'freeDays': campaign.get('freeDays', 0),
            'rateRanges': rate_ranges,
        }

        for quota_row in campaign.get('quotaRows', []):
            if not quota_row.get('model') or not quota_row.get('ddStart') or not quota_row.get('ddEnd'):
                continue
            quota_index.append({
                'campaignName': campaign['name'],
                'model': _normalize_model(quota_row['model']),
                'ddStart': pd.Timestamp(quota_row['ddStart']),
                'ddEnd': pd.Timestamp(quota_row['ddEnd']),
                'selectedDealers': set(quota_row.get('selectedDealers') or []),
                'exceptionDealers': _parse_dealer_list(quota_row.get('exception')),
                # 0/unset means no cap (e.g. rows added via the manual campaign form,
                # which has no Units field) — only imported rows carry a real quota.
                'unitsQuota': int(quota_row.get('units') or 0),
            })

    return campaigns_by_name, quota_index


def _match_campaign_for_vin(
    model: Any,
    dealer_code: Any,
    alloc_date: pd.Timestamp,
    quota_index: list[dict[str, Any]],
    consumed_units: dict[int, int],
) -> str | None:
    """Find the campaign whose quota-row condition (Model + DD range, dealer scope,
    remaining quota) this VIN satisfies; returns its name, or None. Consumes one unit
    of the matched row's quota (consumed_units is mutated in place, keyed by the row's
    position in quota_index) so later VINs fall through once a row is exhausted."""
    if pd.isna(alloc_date) or not model or (isinstance(model, float) and pd.isna(model)):
        return None
    model_norm = _normalize_model(model)
    if not model_norm:
        return None
    dealer_str = str(dealer_code).strip()
    for idx, entry in enumerate(quota_index):
        if entry['model'] != model_norm:
            continue
        if not (entry['ddStart'] <= alloc_date <= entry['ddEnd']):
            continue
        if entry['selectedDealers']:
            if dealer_str not in entry['selectedDealers']:
                continue
        elif dealer_str in entry['exceptionDealers']:
            continue
        if entry['unitsQuota'] > 0 and consumed_units.get(idx, 0) >= entry['unitsQuota']:
            continue
        consumed_units[idx] = consumed_units.get(idx, 0) + 1
        return entry['campaignName']
    return None


def _resolve_campaign_terms(
    row: pd.Series,
    campaigns_by_name: dict[str, dict[str, Any]],
    quota_index: list[dict[str, Any]],
    subvention_map: dict[str, Any],
    consumed_units: dict[int, int],
) -> tuple[int, list[dict[str, Any]] | None, dict[str, Any] | None]:
    """Resolve (free_days, rate override, mismatch) for one AR row vs Campaign Master.

    Every VIN is independently re-matched against active campaign quota rows, regardless
    of what the AR file itself asserts (including 'Normal'), so under-assignment is also
    caught. Pricing uses the matched campaign's terms only when it agrees with the AR
    file's assertion; any mismatch (either direction) prices at Default ('Normal') —
    the panel is for source-data correction, never an alternate price preview.
    - Not in Master but in legacy config -> old behavior, not a mismatch."""
    raw_assigned = row.get('Subvention Campaign')
    assigned = str(raw_assigned) if raw_assigned is not None else 'Normal'
    default_free_days = int(subvention_map.get('Normal', 0) or 0)

    model = row.get('Model')
    dealer_code = row.get('Dealer Code')
    alloc_date = pd.to_datetime(row.get('Allocation Date'), errors='coerce')
    drawdown_display = alloc_date.strftime('%d/%m/%Y') if pd.notna(alloc_date) else ''

    def mismatch(should_be: str, reason: str) -> dict[str, Any]:
        return {
            'vinNumber': str(row.get('VIN Number', '')),
            'dealer': f"{row.get('Dealer Code', '')} - {row.get('Dealer Name', '')}",
            'model': str(model or ''),
            'drawdown': drawdown_display,
            'assignedTo': assigned,
            'shouldBe': should_be,
            'reason': reason,
        }

    matched_name = _match_campaign_for_vin(model, dealer_code, alloc_date, quota_index, consumed_units)

    if matched_name:
        if matched_name.strip().lower() == assigned.strip().lower():
            campaign = campaigns_by_name[matched_name.strip().lower()]
            return campaign['freeDays'], campaign['rateRanges'], None
        # AR file's assertion disagrees with the system's independent match — price at
        # Default regardless of direction; report the discrepancy for correction.
        return default_free_days, None, mismatch(
            matched_name,
            f"Model '{model}' allocated {drawdown_display} matches campaign '{matched_name}', not '{assigned}'",
        )

    if assigned.strip().lower() == 'normal':
        return default_free_days, None, None

    if assigned.strip().lower() in campaigns_by_name:
        return default_free_days, None, mismatch(
            'Normal', f"VIN does not meet '{assigned}' model/allocation-date conditions"
        )

    legacy_free_days = subvention_map.get(assigned)
    if legacy_free_days is not None:
        # Legacy campaign not yet migrated into Campaign Master — old behavior, not a mismatch.
        return int(legacy_free_days), None, None

    return default_free_days, None, mismatch(
        'Normal', f"Campaign '{assigned}' not found in Campaign Master or legacy config"
    )


def _calculate_charges(
    df_ar_current: pd.DataFrame,
    config_data: dict[str, Any],
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    penalty_rate: float,
    is_waive_run: bool,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Run calculate_detailed_charge per row, resolving Free Days/rate table against
    Campaign Master (falling back to legacy config), and derive AR Master Code."""
    df_rate = config_data['rates'].copy()
    df_rate.columns = df_rate.columns.str.strip()
    df_rate.rename(columns={'Start Day': 'StartDay', 'End Day': 'EndDay', 'Rate (%)': 'Rate'}, inplace=True)

    df_subvention = config_data['subventions'].copy()
    df_subvention.columns = df_subvention.columns.str.strip()

    rate_ranges = prepare_rate_ranges(df_rate.to_dict('records'))
    subvention_map = df_subvention.set_index('Campaign Name')['Free Days'].to_dict()

    campaigns_by_name, quota_index = _load_active_campaign_index()
    consumed_units: dict[int, int] = {}
    resolved = df_ar_current.apply(
        lambda row: _resolve_campaign_terms(
            row, campaigns_by_name, quota_index, subvention_map, consumed_units
        ),
        axis=1,
    )
    df_ar_current['Free Days'] = resolved.map(lambda r: r[0]).astype(int)
    df_ar_current['_CampaignRateOverride'] = resolved.map(lambda r: r[1])
    mismatches = [r[2] for r in resolved if r[2] is not None]

    df_ar_current[[
        'RAM Charge', 'RAM Charge (bf)', 'Dealer Charge',
        'RAM Charge FreeDay (This Month)', 'RAM Rate Summary',
        'Dealer Rate Summary', 'Actual Used Days (This Month)', 'Aging'
    ]] = df_ar_current.apply(
        lambda row: calculate_detailed_charge(row, rate_ranges, month_start, month_end, penalty_rate),
        axis=1
    )
    df_ar_current.drop(columns=['_CampaignRateOverride'], inplace=True)

    df_ar_current['Dealer Code'] = df_ar_current['Dealer Code'].astype(str).str.zfill(DEALER_CODE_DIGITS)
    df_ar_current['Contract Number'] = df_ar_current['Contract Number'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True)

    dealer_charge_col = 'Dealer Charge'
    if is_waive_run:
        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge'] + df_ar_current['waive amount']
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge'] - df_ar_current['waive amount']
        dealer_charge_col = 'Dealer Charge (After Waive)'
    # Pre-Waive: AR Master Code uses the pre-waive Dealer Charge (dealer_charge_col above).
    df_ar_current['AR Master Code'] = df_ar_current[dealer_charge_col].apply(
        lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
    )

    return df_ar_current, mismatches


def _build_stats_and_distributions(
    df_ar_current: pd.DataFrame, is_waive_run: bool, mismatches: list[dict[str, Any]]
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """Compute stats, campaign distribution, and summary-by-dealer — must run before export formatting."""
    stats: dict[str, Any] = {
        'rowsProcessed': int(len(df_ar_current)),
        'totalRamCharge': float(pd.to_numeric(df_ar_current['RAM Charge'], errors='coerce').fillna(0).sum()),
        'totalDealerCharge': float(pd.to_numeric(df_ar_current['Dealer Charge'], errors='coerce').fillna(0).sum()),
        'mismatchCount': len(mismatches),
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

    ram_amount_col = 'RAM Charge (After Waive)' if is_waive_run else 'RAM Charge'
    dealer_amount_col = 'Dealer Charge (After Waive)' if is_waive_run else 'Dealer Charge'
    summary_by_dealer = (
        df_ar_current.groupby(['Dealer Code', 'Dealer Name'], dropna=False)
        .agg(
            vins=('VIN Number', 'count'),
            ramCharge=(ram_amount_col, 'sum'),
            dealerCharge=(dealer_amount_col, 'sum'),
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
    """Format date/currency columns for export. Must run last — earlier steps need numeric values."""
    df_ar_current['Allocation Date'] = pd.to_datetime(df_ar_current['Allocation Date'], errors='coerce').dt.strftime('%d/%m/%Y')
    df_ar_current['Payment Date'] = pd.to_datetime(df_ar_current['Payment Date'], errors='coerce').fillna(month_end).dt.strftime('%d/%m/%Y')
    df_ar_current['Due Date'] = pd.to_datetime(df_ar_current['Due Date'], errors='coerce').dt.strftime('%d/%m/%Y').replace('NaT', '')
    df_ar_current['SOT Start Date'] = pd.to_datetime(df_ar_current['SOT Start Date'], errors='coerce').dt.strftime('%d/%m/%Y').replace('NaT', '')

    currency_columns = ['Price (Ex. Vat)', 'RAM Charge', 'RAM Charge (bf)', 'Dealer Charge', 'waive amount']
    if is_waive_run:
        currency_columns += ['RAM Charge (After Waive)', 'Dealer Charge (After Waive)']

    for col in currency_columns:
        df_ar_current[col] = df_ar_current[col].astype(float).map('{:,.2f}'.format)

    return df_ar_current


def _run_calculation_pipeline(
    ar_file_path: str,
    config_data: dict[str, Any],
    month_start: pd.Timestamp,
    month_end: pd.Timestamp,
    penalty_rate: float,
    last_month_label: str,
    waive_file_path: str | None = None,
    sot_file_path: str | None = None,
) -> dict[str, Any]:
    """Shared pipeline for /api/calculate and /api/calculate-with-waive (pass
    waive_file_path for the latter). Returns the payload dict or raises
    CalculationValidationError. Only Pre-Waive validates AR sheets/payment-date
    column (intentional asymmetry)."""
    is_waive_run = waive_file_path is not None
    df_waive = _load_waive_dataframe(waive_file_path) if is_waive_run else None
    df_sot = load_sot_sheet(sot_file_path)

    df_ar_current = _load_ar_dataframe(ar_file_path, last_month_label, is_waive_run, df_waive, df_sot)
    df_ar_current, mismatches = _calculate_charges(
        df_ar_current, config_data, month_start, month_end, penalty_rate, is_waive_run
    )

    stats, campaign_distribution, summary_by_dealer_code = _build_stats_and_distributions(
        df_ar_current, is_waive_run, mismatches
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
        'mismatches': mismatches,
        'summary': summary,
        'summaryByDealerCode': summary_by_dealer_code,
        'detailRecords': df_ar_current.to_dict('records'),
        'dealerSummary': df_rental_summary.to_dict('records'),
    })
