"""Campaign Master: JSON storage, Excel import parsing, and shape conversion
between storage (ISO dates) and the frontend's display shape (dd-mm-yy)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import pandas as pd

from .errors import CalculationValidationError
from .paths import CAMPAIGNS_FILE

CAMPAIGN_HEADER_REQUIRED_COLUMNS = ['Campaign Code', 'Campaign Name', 'Free Days']
CAMPAIGN_CONDITION_REQUIRED_COLUMNS = [
    'Campaign Code', 'Range', 'Model (Sub)', 'DD Start', 'DD End', 'Units', 'Affected Dealers'
]
CAMPAIGN_RATE_REQUIRED_COLUMNS = [
    'Campaign Code', 'Range', 'Start Day', 'End Day', 'Rate %', 'Eff Start', 'Eff End', 'Active', 'Delivery Date'
]


def load_campaigns() -> list[dict[str, Any]]:
    """Load the campaign store, or an empty list if it doesn't exist yet."""
    if not CAMPAIGNS_FILE.exists():
        return []
    with open(CAMPAIGNS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_campaigns(campaigns: list[dict[str, Any]]) -> None:
    with open(CAMPAIGNS_FILE, 'w', encoding='utf-8') as f:
        json.dump(campaigns, f, indent=2, ensure_ascii=False)


def _parse_campaign_date(value: Any) -> str | None:
    """Parse a DD-MM-YY (or similar) cell into an ISO YYYY-MM-DD string."""
    parsed = pd.to_datetime(value, dayfirst=True, errors='coerce')
    return None if pd.isna(parsed) else parsed.strftime('%Y-%m-%d')


def _format_display_date(iso_date: str | None) -> str:
    """ISO YYYY-MM-DD -> dd-mm-yy, matching the frontend's display format."""
    if not iso_date:
        return ''
    return datetime.strptime(iso_date, '%Y-%m-%d').strftime('%d-%m-%y')


def _parse_display_date(display_date: Any) -> str | None:
    """dd-mm-yy (or other reasonable formats) -> ISO YYYY-MM-DD, for data coming back from the UI."""
    if not display_date:
        return None
    parsed = pd.to_datetime(display_date, dayfirst=True, errors='coerce')
    return None if pd.isna(parsed) else parsed.strftime('%Y-%m-%d')


def _parse_campaign_bool(value: Any) -> bool:
    return str(value).strip().upper() == 'TRUE'


def _parse_and_validate_sheet(
    xls: pd.ExcelFile, sheet_name: str, required_columns: list[str]
) -> pd.DataFrame:
    """Parse one sheet, strip its column names, and raise CalculationValidationError
    if any required column is missing."""
    df = xls.parse(sheet_name)
    df.columns = df.columns.astype(str).str.strip()
    missing = [c for c in required_columns if c not in df.columns]
    if missing:
        raise CalculationValidationError(f"'{sheet_name}' sheet is missing: {', '.join(missing)}")
    return df


def parse_campaign_import_file(file_path: str) -> list[dict[str, Any]]:
    """Parse a campaign import workbook into campaign dicts grouped by Campaign Code.
    Extraction only — nothing is saved here."""
    try:
        xls = pd.ExcelFile(file_path, engine='openpyxl')
    except Exception as e:
        raise CalculationValidationError(f'Could not read campaign file: {e}')

    required_sheets = ['Campaign', 'Campaign Condition', 'Rate by Day Range']
    missing_sheets = [s for s in required_sheets if s not in xls.sheet_names]
    if missing_sheets:
        raise CalculationValidationError(f"Missing required sheet(s): {', '.join(missing_sheets)}")

    df_header = _parse_and_validate_sheet(xls, 'Campaign', CAMPAIGN_HEADER_REQUIRED_COLUMNS)
    df_condition = _parse_and_validate_sheet(xls, 'Campaign Condition', CAMPAIGN_CONDITION_REQUIRED_COLUMNS)
    df_rate = _parse_and_validate_sheet(xls, 'Rate by Day Range', CAMPAIGN_RATE_REQUIRED_COLUMNS)

    df_header['Campaign Code'] = df_header['Campaign Code'].astype(str).str.strip()
    df_condition['Campaign Code'] = df_condition['Campaign Code'].astype(str).str.strip()
    df_rate['Campaign Code'] = df_rate['Campaign Code'].astype(str).str.strip()

    campaigns = []
    for _, header_row in df_header.iterrows():
        code = str(header_row['Campaign Code']).strip()
        if not code or code.lower() == 'nan':
            continue
        name = str(header_row['Campaign Name']).strip()
        free_days = int(header_row['Free Days']) if pd.notna(header_row['Free Days']) else 0

        quota_rows = [
            {
                'campaign': code,
                'range': str(row.get('Range', '')).strip(),
                'model': str(row.get('Model (Sub)', '')).strip(),
                'ddStart': _parse_campaign_date(row.get('DD Start')),
                'ddEnd': _parse_campaign_date(row.get('DD End')),
                'units': int(row['Units']) if pd.notna(row.get('Units')) else 0,
                'affectedDealers': str(row.get('Affected Dealers') or 'All dealers').strip() or 'All dealers',
                'exception': (
                    str(row['Exception']).strip()
                    if 'Exception' in df_condition.columns and pd.notna(row.get('Exception'))
                    else None
                ),
            }
            for _, row in df_condition[df_condition['Campaign Code'] == code].iterrows()
        ]

        rate_tiers = [
            {
                'range': str(row.get('Range', '')).strip(),
                'startDay': int(row['Start Day']) if pd.notna(row.get('Start Day')) else 0,
                'endDay': int(row['End Day']) if pd.notna(row.get('End Day')) else 0,
                'rate': float(row['Rate %']) if pd.notna(row.get('Rate %')) else 0.0,
                'plus': (
                    str(row['Plus']).strip()
                    if 'Plus' in df_rate.columns and pd.notna(row.get('Plus'))
                    else '-'
                ),
                'effectiveStart': _parse_campaign_date(row.get('Eff Start')),
                'effectiveEnd': _parse_campaign_date(row.get('Eff End')),
                'active': _parse_campaign_bool(row.get('Active', 'TRUE')),
                'deliveryDate': _parse_campaign_bool(row.get('Delivery Date', 'FALSE')),
            }
            for _, row in df_rate[df_rate['Campaign Code'] == code].iterrows()
        ]

        campaigns.append({
            'code': code,
            'name': name,
            'status': 'Active',
            'freeDays': free_days,
            'quotaRows': quota_rows,
            'rateTiers': rate_tiers,
        })

    return campaigns


def _campaign_detail_shape(campaign: dict[str, Any]) -> dict[str, Any]:
    """Storage shape -> the shape CampaignDetailPage / the review screen render."""
    quota_rows = campaign.get('quotaRows', [])
    rate_tiers = campaign.get('rateTiers', [])
    return {
        'code': campaign['code'],
        'name': campaign['name'],
        'status': campaign.get('status', 'Active'),
        'freeDays': campaign.get('freeDays', 0),
        'units': sum(q.get('units', 0) for q in quota_rows),
        'campaignConditions': [
            {
                'id': i + 1,
                'campaign': q.get('campaign', campaign['code']),
                'range': q.get('range', ''),
                'model': q.get('model', ''),
                'ddStart': _format_display_date(q.get('ddStart')),
                'ddEnd': _format_display_date(q.get('ddEnd')),
                'units': q.get('units', 0),
                'affectedDealers': q.get('affectedDealers', 'All dealers'),
                'selectedDealers': q.get('selectedDealers', []),
                'exception': q.get('exception'),
            }
            for i, q in enumerate(quota_rows)
        ],
        'rateByDayRange': [
            {
                'id': i + 1,
                'range': t.get('range', ''),
                'startDay': t.get('startDay', 0),
                'endDay': t.get('endDay', 0),
                'rate': t.get('rate', 0.0),
                'plus': t.get('plus', '-'),
                'effectiveStart': _format_display_date(t.get('effectiveStart')),
                'effectiveEnd': _format_display_date(t.get('effectiveEnd')),
                'active': t.get('active', True),
                'deliveryDate': t.get('deliveryDate', False),
            }
            for i, t in enumerate(rate_tiers)
        ],
    }


def _campaign_list_shape(campaign: dict[str, Any]) -> dict[str, Any]:
    """Storage shape -> the summary row shape CampaignManagementPage's table renders."""
    quota_rows = campaign.get('quotaRows', [])
    models = sorted({q['model'] for q in quota_rows if q.get('model')})
    dd_starts = [q['ddStart'] for q in quota_rows if q.get('ddStart')]
    dd_ends = [q['ddEnd'] for q in quota_rows if q.get('ddEnd')]
    drawdown_period = (
        f"{_format_display_date(min(dd_starts))} → {_format_display_date(max(dd_ends))}"
        if dd_starts and dd_ends else '—'
    )
    return {
        'code': campaign['code'],
        'name': campaign['name'],
        'status': campaign.get('status', 'Active'),
        'models': ', '.join(models) if models else '—',
        'drawdownPeriod': drawdown_period,
    }


def _campaign_from_frontend_shape(payload: dict[str, Any]) -> dict[str, Any]:
    """The reviewed/edited detail shape from the UI -> storage shape (ISO dates)."""
    code = str(payload['code']).strip()
    return {
        'code': code,
        'name': str(payload.get('name', '')).strip(),
        'status': payload.get('status') or 'Active',
        'freeDays': int(payload.get('freeDays') or 0),
        'quotaRows': [
            {
                'campaign': q.get('campaign') or code,
                'range': q.get('range', ''),
                'model': q.get('model', ''),
                'ddStart': _parse_display_date(q.get('ddStart')),
                'ddEnd': _parse_display_date(q.get('ddEnd')),
                'units': int(q.get('units') or 0),
                'affectedDealers': q.get('affectedDealers') or 'All dealers',
                'selectedDealers': q.get('selectedDealers') or [],
                'exception': q.get('exception'),
            }
            for q in payload.get('campaignConditions', [])
        ],
        'rateTiers': [
            {
                'range': t.get('range', ''),
                'startDay': int(t.get('startDay') or 0),
                'endDay': int(t.get('endDay') or 0),
                'rate': float(t.get('rate') or 0),
                'plus': t.get('plus') or '-',
                'effectiveStart': _parse_display_date(t.get('effectiveStart')),
                'effectiveEnd': _parse_display_date(t.get('effectiveEnd')),
                'active': bool(t.get('active', True)),
                'deliveryDate': bool(t.get('deliveryDate', False)),
            }
            for t in payload.get('rateByDayRange', [])
        ],
    }
