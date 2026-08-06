"""
FloorPlan Interest Calculator - REST API Backend
Main Flask application with calculation logic
"""

import os
import json
import traceback
import numpy as np
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

# ============= CONFIG =============
app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
OUTPUT_FOLDER = os.path.join(os.getcwd(), 'AR_Outputs')
OUTPUT_WAIVE_FOLDER = os.path.join(os.getcwd(), 'AR_Outputs - Waive')
AR_INPUT_FOLDER = os.path.join(os.getcwd(), 'AR_Input')
CONFIG_PATH = os.path.join(os.getcwd(), 'config', 'Rental_Charge_Conditions_v2.xlsx')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_WAIVE_FOLDER, exist_ok=True)
os.makedirs(AR_INPUT_FOLDER, exist_ok=True)


# ============= HELPER FUNCTIONS =============

def clean_nan_values(obj):
    """Convert NaN values to None for JSON serialization"""
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        return None if np.isnan(obj) else obj
    else:
        return obj

def load_config():
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
        raise Exception(f"Failed to load config: {str(e)}")


def prepare_ar_data(df_ar, source_name):
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


def calculate_detailed_charge(row, rate_ranges, month_start, month_end, penalty_rate):
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
    ram_charge_freeday_days_this_month = sum([(month_start <= d <= month_end) for d in ram_charge_days])

    ram_charge = 0.0
    ram_desc = {}

    for d in ram_charge_days:
        day_count = (d - alloc_date).days + 1
        applicable_rates = [
            r for r in rate_ranges
            if r['StartDay'] <= day_count <= r['EndDay']
            and pd.to_datetime(r['EffectiveStart']) <= d
            and d <= pd.to_datetime(r['EffectiveEnd'])
            and r.get('IsActive', True)
        ]

        if month_start <= d <= month_end and applicable_rates:
            rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r['EffectiveStart']))
            daily_interest = (price * float(rate_rec['Rate'])) / 36500
            ram_charge += daily_interest
            rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
            ram_desc[rate_key] = ram_desc.get(rate_key, 0) + 1

    # ====== RAM CHARGE ACTUAL (Full Period) ======
    ram_charge_actual_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end
    ram_charge_actual_days = pd.date_range(max(alloc_date, month_start), ram_charge_actual_end, freq='D')
    ram_charge_actual = 0.0

    for d in ram_charge_actual_days:
        day_count = (d - alloc_date).days + 1
        applicable_rates = [
            r for r in rate_ranges
            if r['StartDay'] <= day_count <= r['EndDay']
            and pd.to_datetime(r['EffectiveStart']) <= d
            and d <= pd.to_datetime(r['EffectiveEnd'])
            and r.get('IsActive', True)
        ]

        if applicable_rates:
            rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r['EffectiveStart']))
            daily_interest = (price * float(rate_rec['Rate'])) / 36500
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
            applicable_rates = [
                r for r in rate_ranges
                if r['StartDay'] <= day_count <= r['EndDay']
                and pd.to_datetime(r['EffectiveStart']) <= d
                and d <= pd.to_datetime(r['EffectiveEnd'])
                and r.get('IsActive', True)
            ]

            if month_start <= d <= month_end and applicable_rates:
                rate_rec = max(applicable_rates, key=lambda r: pd.to_datetime(r['EffectiveStart']))
                daily_interest = (price * float(rate_rec['Rate'])) / 36500
                dealer_charge += daily_interest
                rate_key = f"{rate_rec['StartDay']}-{rate_rec['EndDay']} @ {rate_rec['Rate']}%"
                dealer_desc[rate_key] = dealer_desc.get(rate_key, 0) + 1

    # ====== PENALTY CHARGE ======
    if pd.notna(due_date):
        penalty_start = due_date + timedelta(days=1)
        penalty_end = min(paid_date - timedelta(days=1), month_end) if pd.notna(paid_date) else month_end

        if penalty_start <= penalty_end:
            penalty_days = pd.date_range(penalty_start, penalty_end, freq='D')
            penalty_day_count = sum([1 for d in penalty_days if month_start <= d <= month_end])

            if penalty_day_count > 0:
                daily_penalty = (price * penalty_rate) / 36500
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


def create_excel_output(df_ar, df_summary, df_rental_summary, month_end, is_waive=False):
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
    def add_table(ws, table_name):
        if ws.max_row > 0:
            last_col = ws.max_column
            last_row = ws.max_row
            last_col_letter = get_column_letter(last_col)
            tab = Table(displayName=table_name, ref=f'A1:{last_col_letter}{last_row}')
            style = TableStyleInfo(name='TableStyleMedium9', showRowStripes=True)
            tab.tableStyleInfo = style
            ws.add_table(tab)

    def format_currency_column(ws, col_name):
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


# ============= API ENDPOINTS =============

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get configuration, rates, and subventions"""
    try:
        config_data = load_config()
        config = config_data['config']

        result = {
            'config': {
                'monthEndDate': str(config.get('Month End Date')),
                'penaltyRate': float(config.get('Penalty Rate', 15))
            },
            'rates': config_data['rates'].to_dict('records'),
            'subventions': config_data['subventions'].to_dict('records')
        }

        result = clean_nan_values(result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/upload', methods=['POST'])
def upload_ar():
    """Upload and preview AR file"""
    try:
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
            except:
                preview_tables[sheet] = '<p>Error reading sheet</p>'
                record_counts[sheet] = 0

        return jsonify({
            'fileName': filename,
            'filePath': filepath,
            'sheetNames': sheet_names,
            'previewTables': preview_tables,
            'recordCounts': record_counts
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/upload-waive', methods=['POST'])
def upload_waive():
    """Upload and preview waive file"""
    try:
        if 'waive_file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['waive_file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"waive_input_{timestamp}.xlsx"
        filepath = os.path.join(AR_INPUT_FOLDER, filename)
        file.save(filepath)

        df = pd.read_excel(filepath)
        preview_table = df.head(5).to_html(classes='table table-sm', index=False)
        approved_count = len(df[df['approved'].astype(str).str.upper() == 'Y']) if 'approved' in df.columns else 0

        return jsonify({
            'fileName': filename,
            'filePath': filepath,
            'sheetNames': ['Waive Data'],
            'previewTables': {'Waive Data': preview_table},
            'recordCounts': {'Waive Data': len(df)},
            'approvedCount': approved_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/calculate', methods=['POST'])
def calculate():
    """Calculate charges without waive"""
    try:
        data = request.json
        file_path = data.get('filePath')

        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 400

        # Load config
        config_data = load_config()
        config = config_data['config']
        month_end = pd.to_datetime(config['Month End Date'])
        month_start = month_end.replace(day=1)
        penalty_rate = float(config.get('Penalty Rate', 15))
        last_month_label = (month_end - relativedelta(months=1)).strftime('%b').lower()

        # Load AR file
        xls = pd.ExcelFile(file_path, engine='openpyxl')
        sheet_names = xls.sheet_names

        sheet_last = next((s for s in sheet_names if last_month_label in s.lower()), None)
        sheet_new = next((s for s in sheet_names if 'new' in s.lower()), None)
        sheet_all = next((s for s in sheet_names if 'all' in s.lower()), None)
        sheet_penalty = next((s for s in sheet_names if 'penalty' in s.lower()), None)

        if not all([sheet_last, sheet_new, sheet_all]):
            return jsonify({'error': 'Missing required sheets'}), 400

        # Read sheets
        df_ar_lastmonth = xls.parse(sheet_last, header=1)
        df_new_volume = xls.parse(sheet_new, header=1)
        df_all_payment = xls.parse(sheet_all, header=1)

        # Prepare data
        df_ar_lastmonth = prepare_ar_data(df_ar_lastmonth, 'AR Last Month')
        df_new_volume = prepare_ar_data(df_new_volume, 'New Volume')

        # Prepare payment data
        df_all_payment.columns = df_all_payment.columns.astype(str).str.strip()
        payment_date_col = 'Payment Date' if 'Payment Date' in df_all_payment.columns else (
            'Date' if 'Date' in df_all_payment.columns else None
        )

        if not payment_date_col:
            return jsonify({'error': 'Payment date column not found'}), 400

        df_all_payment = df_all_payment[['VIN No.', payment_date_col]].copy()
        df_all_payment.rename(columns={'VIN No.': 'VIN Number', payment_date_col: 'Payment Date'}, inplace=True)

        # Prepare penalty data
        df_penalty = pd.DataFrame(columns=['VIN Number', 'Due Date'])
        if sheet_penalty:
            df_penalty = xls.parse(sheet_penalty, header=0)
            df_penalty.columns = df_penalty.columns.str.strip()
            if 'VIN No.' in df_penalty.columns:
                df_penalty.rename(columns={'VIN No.': 'VIN Number'}, inplace=True)
            df_penalty['Due Date'] = pd.to_datetime(df_penalty['Due Date'], errors='coerce')
            df_penalty = df_penalty[['VIN Number', 'Due Date']].dropna(subset=['Due Date'])

        # Merge data
        df_ar_current = pd.concat([df_new_volume, df_ar_lastmonth], ignore_index=True)
        df_ar_current['Subvention Campaign'] = df_ar_current['Subvention Campaign'].fillna('Normal').replace('', 'Normal')
        df_ar_current = df_ar_current[~(df_ar_current['Dealer Group'].isna() | (df_ar_current['Dealer Group'].astype(str).str.strip() == ''))]

        df_ar_current = df_ar_current.merge(df_all_payment, on='VIN Number', how='left')
        df_ar_current['Paid'] = df_ar_current['Payment Date'].notna().map({True: 'Y', False: 'N'})
        df_ar_current = df_ar_current.merge(df_penalty, on='VIN Number', how='left')

        # Add waive column (empty for non-waive calculation)
        df_ar_current['waive amount'] = 0.0
        df_ar_current['reason'] = ''

        # Load rates and subventions
        df_rate = config_data['rates'].copy()
        df_rate.columns = df_rate.columns.str.strip()
        df_rate.rename(columns={'Start Day': 'StartDay', 'End Day': 'EndDay', 'Rate (%)': 'Rate'}, inplace=True)

        df_subvention = config_data['subventions'].copy()
        df_subvention.columns = df_subvention.columns.str.strip()

        rate_ranges = df_rate.to_dict('records')
        subvention_map = df_subvention.set_index('Campaign Name')['Free Days'].to_dict()
        df_ar_current['Free Days'] = df_ar_current['Subvention Campaign'].map(subvention_map).fillna(0).astype(int)

        # Calculate charges
        df_ar_current[[
            'RAM Charge', 'RAM Charge (bf)', 'Dealer Charge',
            'RAM Charge FreeDay (This Month)', 'RAM Rate Summary',
            'Dealer Rate Summary', 'Actual Used Days (This Month)', 'Aging'
        ]] = df_ar_current.apply(
            lambda row: calculate_detailed_charge(row, rate_ranges, month_start, month_end, penalty_rate),
            axis=1
        )

        # Format and calculate post-charges
        df_ar_current['Dealer Code'] = df_ar_current['Dealer Code'].astype(str).str.zfill(5)
        df_ar_current['Contract Number'] = df_ar_current['Contract Number'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True)

        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge'] + df_ar_current['waive amount']
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge'] - df_ar_current['waive amount']
        df_ar_current['AR Master Code'] = df_ar_current['Dealer Charge (After Waive)'].apply(
            lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
        )

        # Format dates and currency
        df_ar_current['Allocation Date'] = pd.to_datetime(df_ar_current['Allocation Date'], errors='coerce').dt.strftime('%d/%m/%Y')
        df_ar_current['Payment Date'] = pd.to_datetime(df_ar_current['Payment Date'], errors='coerce').fillna(month_end).dt.strftime('%d/%m/%Y')
        df_ar_current['Due Date'] = pd.to_datetime(df_ar_current['Due Date'], errors='coerce').dt.strftime('%d/%m/%Y').replace('NaT', '')

        df_ar_current['Price (Ex. Vat)'] = df_ar_current['Price (Ex. Vat)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge'] = df_ar_current['RAM Charge'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge (bf)'] = df_ar_current['RAM Charge (bf)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['Dealer Charge'] = df_ar_current['Dealer Charge'].astype(float).map('{:,.2f}'.format)
        df_ar_current['waive amount'] = df_ar_current['waive amount'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge (After Waive)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge (After Waive)'].astype(float).map('{:,.2f}'.format)

        # Calculate summary
        summary = {
            'AR Last Month': float(df_ar_current[df_ar_current['Source'] == 'AR Last Month']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
            'New Volume': float(df_ar_current[df_ar_current['Source'] == 'New Volume']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
            'All Payment (Paid=Y)': float(df_ar_current[df_ar_current['Paid'] == 'Y']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
            'AR Outstanding (Paid=N)': float(df_ar_current[df_ar_current['Paid'] == 'N']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
        }
        summary['Total'] = sum(summary.values())

        summary_df = pd.DataFrame.from_dict(summary, orient='index', columns=['Amount (THB)'])
        summary_df['Amount (THB)'] = summary_df['Amount (THB)'].map('{:,.2f}'.format)

        # Calculate dealer summary
        df_rental = df_ar_current.copy()
        for col in ['RAM Charge (After Waive)', 'Dealer Charge (After Waive)']:
            df_rental[col] = df_rental[col].str.replace(',', '').astype(float)

        df_ram = df_rental[df_rental['RAM Charge (After Waive)'] > 0].copy()
        df_dealer = df_rental[df_rental['Dealer Charge (After Waive)'] > 0].copy()

        def create_dealer_summary(df_group, ar_code, wht_rate):
            df_group = df_group.copy()
            df_group['AR Master Code'] = ar_code
            df_group['Amount per calculation'] = df_group['RAM Charge (After Waive)' if ar_code == 'RAM Rever Automotive' else 'Dealer Charge (After Waive)']
            df_group['Waive'] = df_group['waive amount'].str.replace(',', '').astype(float)
            df_group['WHT'] = df_group['Amount per calculation'] * wht_rate
            df_group['VAT'] = df_group['Amount per calculation'] * 0.07
            df_group['Total Receivable'] = df_group['Amount per calculation'] - df_group['WHT'] + df_group['VAT']
            df_group['Total'] = df_group['Amount per calculation'] + df_group['VAT']

            return df_group[['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master Code', 'Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']]

        df_ram_summary = create_dealer_summary(df_ram, 'RAM Rever Automotive', 0.03)
        df_dealer_summary = create_dealer_summary(df_dealer, 'Charge to Dealer', 0.05)

        group_cols = ['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master Code']
        sum_cols = ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']

        df_ram_summary = df_ram_summary.groupby(group_cols, as_index=False)[sum_cols].sum()
        df_dealer_summary = df_dealer_summary.groupby(group_cols, as_index=False)[sum_cols].sum()

        df_rental_summary = pd.concat([df_dealer_summary, df_ram_summary], ignore_index=True)

        # Create Excel file
        output_path = create_excel_output(df_ar_current, summary_df, df_rental_summary, month_end)

        return jsonify({
            'success': True,
            'message': 'Calculation completed',
            'outputPath': output_path,
            'summary': summary,
            'detailRecords': df_ar_current.head(100).to_dict('records'),
            'dealerSummary': df_rental_summary.to_dict('records')
        })
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

        # Load config
        config_data = load_config()
        config = config_data['config']
        month_end = pd.to_datetime(config['Month End Date'])
        month_start = month_end.replace(day=1)
        penalty_rate = float(config.get('Penalty Rate', 15))
        last_month_label = (month_end - relativedelta(months=1)).strftime('%b').lower()

        # Load waive file
        df_waive = pd.read_excel(waive_file_path)
        df_waive['Dealer Code'] = df_waive['Dealer Code'].astype(str).str.strip()
        df_waive['VIN Number'] = df_waive['VIN Number'].astype(str).str.strip()
        df_waive = df_waive[df_waive['approved'].astype(str).str.upper() == 'Y']
        df_waive['waive amount'] = df_waive['waive amount'].fillna(0)

        # Load AR file (same as calculate)
        xls = pd.ExcelFile(ar_file_path, engine='openpyxl')
        sheet_names = xls.sheet_names

        sheet_last = next((s for s in sheet_names if last_month_label in s.lower()), None)
        sheet_new = next((s for s in sheet_names if 'new' in s.lower()), None)
        sheet_all = next((s for s in sheet_names if 'all' in s.lower()), None)
        sheet_penalty = next((s for s in sheet_names if 'penalty' in s.lower()), None)

        # Read and prepare data (same as /calculate endpoint)
        df_ar_lastmonth = xls.parse(sheet_last, header=1)
        df_new_volume = xls.parse(sheet_new, header=1)
        df_all_payment = xls.parse(sheet_all, header=1)

        df_ar_lastmonth = prepare_ar_data(df_ar_lastmonth, 'AR Last Month')
        df_new_volume = prepare_ar_data(df_new_volume, 'New Volume')

        df_all_payment.columns = df_all_payment.columns.astype(str).str.strip()
        payment_date_col = 'Payment Date' if 'Payment Date' in df_all_payment.columns else 'Date'
        df_all_payment = df_all_payment[['VIN No.', payment_date_col]].copy()
        df_all_payment.rename(columns={'VIN No.': 'VIN Number', payment_date_col: 'Payment Date'}, inplace=True)

        df_penalty = pd.DataFrame(columns=['VIN Number', 'Due Date'])
        if sheet_penalty:
            df_penalty = xls.parse(sheet_penalty, header=0)
            df_penalty.columns = df_penalty.columns.str.strip()
            if 'VIN No.' in df_penalty.columns:
                df_penalty.rename(columns={'VIN No.': 'VIN Number'}, inplace=True)
            df_penalty['Due Date'] = pd.to_datetime(df_penalty['Due Date'], errors='coerce')
            df_penalty = df_penalty[['VIN Number', 'Due Date']].dropna(subset=['Due Date'])

        df_ar_current = pd.concat([df_new_volume, df_ar_lastmonth], ignore_index=True)
        df_ar_current['Subvention Campaign'] = df_ar_current['Subvention Campaign'].fillna('Normal').replace('', 'Normal')
        df_ar_current = df_ar_current[~(df_ar_current['Dealer Group'].isna() | (df_ar_current['Dealer Group'].astype(str).str.strip() == ''))]

        df_ar_current = df_ar_current.merge(df_all_payment, on='VIN Number', how='left')
        df_ar_current['Paid'] = df_ar_current['Payment Date'].notna().map({True: 'Y', False: 'N'})
        df_ar_current = df_ar_current.merge(df_penalty, on='VIN Number', how='left')

        # Merge waive data
        df_ar_current = df_ar_current.merge(
            df_waive[['Dealer Code', 'VIN Number', 'waive amount', 'reason']],
            on=['Dealer Code', 'VIN Number'],
            how='left'
        )
        df_ar_current['waive amount'] = df_ar_current['waive amount'].fillna(0)
        df_ar_current['reason'] = df_ar_current['reason'].fillna('')

        # Load rates and calculate (same as /calculate)
        df_rate = config_data['rates'].copy()
        df_rate.columns = df_rate.columns.str.strip()
        df_rate.rename(columns={'Start Day': 'StartDay', 'End Day': 'EndDay', 'Rate (%)': 'Rate'}, inplace=True)

        df_subvention = config_data['subventions'].copy()
        df_subvention.columns = df_subvention.columns.str.strip()

        rate_ranges = df_rate.to_dict('records')
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

        # Format (same as /calculate)
        df_ar_current['Dealer Code'] = df_ar_current['Dealer Code'].astype(str).str.zfill(5)
        df_ar_current['Contract Number'] = df_ar_current['Contract Number'].fillna('').astype(str).str.replace(r'\.0$', '', regex=True)

        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge'] + df_ar_current['waive amount']
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge'] - df_ar_current['waive amount']
        df_ar_current['AR Master Code'] = df_ar_current['Dealer Charge (After Waive)'].apply(
            lambda x: 'RAM Rever Automotive' if x == 0 else 'Charge to Dealer'
        )

        df_ar_current['Allocation Date'] = pd.to_datetime(df_ar_current['Allocation Date'], errors='coerce').dt.strftime('%d/%m/%Y')
        df_ar_current['Payment Date'] = pd.to_datetime(df_ar_current['Payment Date'], errors='coerce').fillna(month_end).dt.strftime('%d/%m/%Y')
        df_ar_current['Due Date'] = pd.to_datetime(df_ar_current['Due Date'], errors='coerce').dt.strftime('%d/%m/%Y').replace('NaT', '')

        df_ar_current['Price (Ex. Vat)'] = df_ar_current['Price (Ex. Vat)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge'] = df_ar_current['RAM Charge'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge (bf)'] = df_ar_current['RAM Charge (bf)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['Dealer Charge'] = df_ar_current['Dealer Charge'].astype(float).map('{:,.2f}'.format)
        df_ar_current['waive amount'] = df_ar_current['waive amount'].astype(float).map('{:,.2f}'.format)
        df_ar_current['RAM Charge (After Waive)'] = df_ar_current['RAM Charge (After Waive)'].astype(float).map('{:,.2f}'.format)
        df_ar_current['Dealer Charge (After Waive)'] = df_ar_current['Dealer Charge (After Waive)'].astype(float).map('{:,.2f}'.format)

        summary = {
            'AR Last Month': float(df_ar_current[df_ar_current['Source'] == 'AR Last Month']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
            'New Volume': float(df_ar_current[df_ar_current['Source'] == 'New Volume']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
            'All Payment (Paid=Y)': float(df_ar_current[df_ar_current['Paid'] == 'Y']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
            'AR Outstanding (Paid=N)': float(df_ar_current[df_ar_current['Paid'] == 'N']['Price (Ex. Vat)'].str.replace(',', '').astype(float).sum()),
        }
        summary['Total'] = sum(summary.values())

        summary_df = pd.DataFrame.from_dict(summary, orient='index', columns=['Amount (THB)'])
        summary_df['Amount (THB)'] = summary_df['Amount (THB)'].map('{:,.2f}'.format)

        # Dealer summary (same logic)
        df_rental = df_ar_current.copy()
        for col in ['RAM Charge (After Waive)', 'Dealer Charge (After Waive)']:
            df_rental[col] = df_rental[col].str.replace(',', '').astype(float)

        df_ram = df_rental[df_rental['RAM Charge (After Waive)'] > 0].copy()
        df_dealer = df_rental[df_rental['Dealer Charge (After Waive)'] > 0].copy()

        def create_dealer_summary(df_group, ar_code, wht_rate):
            df_group = df_group.copy()
            df_group['AR Master Code'] = ar_code
            df_group['Amount per calculation'] = df_group['RAM Charge (After Waive)' if ar_code == 'RAM Rever Automotive' else 'Dealer Charge (After Waive)']
            df_group['Waive'] = df_group['waive amount'].str.replace(',', '').astype(float)
            df_group['WHT'] = df_group['Amount per calculation'] * wht_rate
            df_group['VAT'] = df_group['Amount per calculation'] * 0.07
            df_group['Total Receivable'] = df_group['Amount per calculation'] - df_group['WHT'] + df_group['VAT']
            df_group['Total'] = df_group['Amount per calculation'] + df_group['VAT']

            return df_group[['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master Code', 'Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']]

        df_ram_summary = create_dealer_summary(df_ram, 'RAM Rever Automotive', 0.03)
        df_dealer_summary = create_dealer_summary(df_dealer, 'Charge to Dealer', 0.05)

        group_cols = ['Dealer Group', 'Dealer Code', 'Dealer Name', 'AR Master Code']
        sum_cols = ['Amount per calculation', 'Waive', 'WHT', 'VAT', 'Total Receivable', 'Total']

        df_ram_summary = df_ram_summary.groupby(group_cols, as_index=False)[sum_cols].sum()
        df_dealer_summary = df_dealer_summary.groupby(group_cols, as_index=False)[sum_cols].sum()

        df_rental_summary = pd.concat([df_dealer_summary, df_ram_summary], ignore_index=True)

        output_path = create_excel_output(df_ar_current, summary_df, df_rental_summary, month_end, is_waive=True)

        return jsonify({
            'success': True,
            'message': 'Waive calculation completed',
            'outputPath': output_path,
            'summary': summary,
            'detailRecords': df_ar_current.head(100).to_dict('records'),
            'dealerSummary': df_rental_summary.to_dict('records')
        })
    except Exception as e:
        return jsonify({'error': str(e), 'details': traceback.format_exc()}), 400


@app.route('/api/download', methods=['GET'])
def download():
    """Download generated Excel file"""
    try:
        file_path = request.args.get('filePath')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True)
