"""FloorPlan Interest Calculator - REST API Backend.
Routes only; calculation logic lives in utils/calculation_utils.py, Campaign
Master in utils/campaign_utils.py."""

from __future__ import annotations

import os
import traceback
from datetime import datetime

import pandas as pd
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

from utils.calculation_utils import (
    clean_nan_values,
    load_config,
    resolve_run_period,
    _parse_config_month_end,
    _parse_config_penalty_rate,
    _run_calculation_pipeline,
)
from utils.campaign_utils import (
    load_campaigns,
    save_campaigns,
    parse_campaign_import_file,
    _campaign_detail_shape,
    _campaign_list_shape,
    _campaign_from_frontend_shape,
)
from utils.errors import CalculationValidationError
from utils.paths import AR_INPUT_FOLDER, CAMPAIGN_INPUT_FOLDER, SOT_INPUT_FOLDER, UPLOAD_FOLDER

# ============= CONFIG =============
app = Flask(__name__)
# Ensures unexpected errors still return JSON, never Werkzeug's debug HTML page.
app.config['PROPAGATE_EXCEPTIONS'] = False
CORS(app)

WAIVE_REQUIRED_COLUMNS = ['Dealer Code', 'Dealer Name', 'VIN Number', 'waive amount', 'reason', 'approved']
SOT_REQUIRED_COLUMNS = ['VIN No.', 'SOT Start Date']


def _require_uploaded_file(field_name: str):
    """Validate an uploaded file field is present and non-empty.
    Returns (file, None) on success, or (None, error_response) to return as-is."""
    if field_name not in request.files:
        return None, (jsonify({'error': 'No file provided'}), 400)
    file = request.files[field_name]
    if file.filename == '':
        return None, (jsonify({'error': 'No file selected'}), 400)
    return file, None


def _save_incoming_xlsx(file, folder: str, filename: str, label: str):
    """Reject a non-.xlsx upload; otherwise save it as `filename` under `folder`.
    Returns (filepath, None) on success, or (None, error_response) on rejection."""
    if not file.filename.lower().endswith('.xlsx'):
        return None, (jsonify({'error': f'Only .xlsx files are accepted for the {label} file'}), 400)
    filepath = os.path.join(folder, filename)
    file.save(filepath)
    return filepath, None


def _validate_required_columns(df: pd.DataFrame, required_columns: list[str], filepath: str, label: str):
    """Strip df's columns and check the required ones are present; on failure, delete
    filepath and return an error response. Returns None on success."""
    df.columns = df.columns.astype(str).str.strip()
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        os.remove(filepath)
        return jsonify({
            'error': f"{label} file is missing required column(s): {', '.join(missing_columns)}"
        }), 400
    return None


def _load_config_and_run_pipeline(file_path: str, data: dict, **pipeline_kwargs):
    """Shared logic for /api/calculate and /api/calculate-with-waive.
    Call from inside the caller's own try/except — it can raise."""
    config_data = load_config()
    config = config_data['config']
    month_start, month_end, penalty_rate, last_month_label = resolve_run_period(data, config)
    return _run_calculation_pipeline(
        file_path, config_data, month_start, month_end, penalty_rate, last_month_label,
        **pipeline_kwargs
    )


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

    month_end = _parse_config_month_end(config)
    if pd.isna(month_end):
        return jsonify({'error': 'Invalid Month End Date in config'}), 400

    full_month_days = config.get('Full Month Days')
    if full_month_days is None or (isinstance(full_month_days, float) and pd.isna(full_month_days)):
        full_month_days = int(month_end.days_in_month)
    else:
        full_month_days = int(full_month_days)

    penalty_rate = _parse_config_penalty_rate(config)

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
    file, error = _require_uploaded_file('ar_file')
    if error:
        return error

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
    file, error = _require_uploaded_file('waive_file')
    if error:
        return error

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"waive_input_{timestamp}.xlsx"
    filepath, error = _save_incoming_xlsx(file, AR_INPUT_FOLDER, filename, 'waive')
    if error:
        return error

    df = pd.read_excel(filepath)
    error = _validate_required_columns(df, WAIVE_REQUIRED_COLUMNS, filepath, 'Waive')
    if error:
        return error

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


@app.route('/api/upload-sot', methods=['POST'])
def upload_sot():
    """Upload and preview SOT (Stock On Truck) file"""
    file, error = _require_uploaded_file('sot_file')
    if error:
        return error

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"sot_input_{timestamp}.xlsx"
    filepath, error = _save_incoming_xlsx(file, SOT_INPUT_FOLDER, filename, 'SOT')
    if error:
        return error

    df = pd.read_excel(filepath, header=0)
    error = _validate_required_columns(df, SOT_REQUIRED_COLUMNS, filepath, 'SOT')
    if error:
        return error

    preview_table = df.head(5).to_html(classes='table table-sm', index=False)

    return jsonify({
        'fileName': filename,
        'filePath': filepath,
        'sheetNames': ['SOT'],
        'previewTables': {'SOT': preview_table},
        'recordCounts': {'SOT': len(df)}
    })


@app.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    """List all saved campaigns (summary row shape for the Campaign Management table)"""
    campaigns = load_campaigns()
    return jsonify([_campaign_list_shape(c) for c in campaigns])


@app.route('/api/campaigns/<code>', methods=['GET'])
def get_campaign(code: str):
    """Get one saved campaign's full detail"""
    campaigns = load_campaigns()
    campaign = next((c for c in campaigns if c['code'] == code), None)
    if campaign is None:
        return jsonify({'error': 'Campaign not found'}), 404
    return jsonify(_campaign_detail_shape(campaign))


@app.route('/api/campaigns/import', methods=['POST'])
def import_campaigns():
    """Extract campaigns from an uploaded workbook for review — nothing is saved yet"""
    file, error = _require_uploaded_file('campaign_file')
    if error:
        return error

    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filepath, error = _save_incoming_xlsx(
        file, CAMPAIGN_INPUT_FOLDER, f"campaign_import_{timestamp}.xlsx", 'campaign'
    )
    if error:
        return error

    try:
        campaigns = parse_campaign_import_file(filepath)
    finally:
        # Only used to extract data for the review step below — not needed after that.
        os.remove(filepath)

    return jsonify({
        'fileName': filename,
        'campaignsExtracted': len(campaigns),
        'totalQuotaRows': sum(len(c['quotaRows']) for c in campaigns),
        'campaigns': [_campaign_detail_shape(c) for c in campaigns],
    })


@app.route('/api/campaigns/commit', methods=['POST'])
def commit_campaigns():
    """Save reviewed campaigns (from the import screen) into the campaign store"""
    data = request.json or {}
    incoming = data.get('campaigns', [])
    if not incoming:
        return jsonify({'error': 'No campaigns to import'}), 400

    by_code = {c['code']: c for c in load_campaigns()}
    for payload in incoming:
        campaign = _campaign_from_frontend_shape(payload)
        by_code[campaign['code']] = campaign

    updated = list(by_code.values())
    save_campaigns(updated)
    return jsonify([_campaign_list_shape(c) for c in updated])


@app.route('/api/campaigns/<code>', methods=['DELETE'])
def delete_campaign(code: str):
    """Permanently remove one campaign from the store"""
    campaigns = load_campaigns()
    remaining = [c for c in campaigns if c['code'] != code]
    if len(remaining) == len(campaigns):
        return jsonify({'error': 'Campaign not found'}), 404
    save_campaigns(remaining)
    return jsonify([_campaign_list_shape(c) for c in remaining])


@app.route('/api/calculate', methods=['POST'])
def calculate():
    """Calculate charges without waive"""
    try:
        data = request.json
        file_path = data.get('filePath')
        sot_file_path = data.get('sotFilePath')

        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 400

        if sot_file_path and not os.path.exists(sot_file_path):
            return jsonify({'error': 'SOT file not found'}), 400

        payload = _load_config_and_run_pipeline(file_path, data, sot_file_path=sot_file_path)
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
        sot_file_path = data.get('sotFilePath')

        if not ar_file_path or not os.path.exists(ar_file_path):
            return jsonify({'error': 'AR file not found'}), 400

        if not waive_file_path or not os.path.exists(waive_file_path):
            return jsonify({'error': 'Waive file not found'}), 400

        if sot_file_path and not os.path.exists(sot_file_path):
            return jsonify({'error': 'SOT file not found'}), 400

        payload = _load_config_and_run_pipeline(
            ar_file_path, data, waive_file_path=waive_file_path, sot_file_path=sot_file_path
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
