import type { WorkbookPreview } from './parseWorkbook';

// Columns backend/app.py needs somewhere across the "AR Last Month" + "New
// Volume" sheets combined (concat unions columns and fills NaN for the side
// that lacks one, so a column only needs to exist on ONE of the two sheets —
// requiring it on both would reject perfectly valid real-world files).
// NOTE: 'Payment Date' is deliberately excluded — it's never expected on
// these sheets; it's sourced solely from the "All payment" sheet and merged
// in afterwards by VIN Number.
const REQUIRED_AR_COLUMNS = [
  'Dealer Group',
  'Dealer Code',
  'Dealer Name',
  'Model',
  'VIN No.',
  'Pre-Vat',
  'Allocation Date',
  'Contract No',
  'Subvention',
];

export interface ARValidationResult {
  valid: boolean;
  error?: string;
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map((h) => h.trim().toLowerCase());
}

function hasColumn(headers: string[], column: string): boolean {
  return headers.includes(column.trim().toLowerCase());
}

function findSheet(sheetNames: string[], pattern: string): string | undefined {
  return sheetNames.find((name) => name.toLowerCase().includes(pattern.toLowerCase()));
}

function sheetHeaders(workbook: WorkbookPreview, sheetName: string): string[] {
  const sheet = workbook.sheets.find((s) => s.name === sheetName);
  return sheet ? normalizeHeaders(sheet.headers) : [];
}

/**
 * Validates that an uploaded AR drawdown workbook has the sheets and columns
 * the backend calculation needs, before the file is accepted and previewed.
 *
 * @param lastMonthLabel  3-letter lowercase abbreviation of the reporting
 *   period's previous month (e.g. "jan"), used the same way the backend
 *   locates the "previous month" sheet. Pass undefined to skip that
 *   particular sheet check (e.g. while system config hasn't loaded yet).
 */
export function validateARWorkbook(
  workbook: WorkbookPreview,
  lastMonthLabel?: string
): ARValidationResult {
  const sheetNames = workbook.sheets.map((s) => s.name);

  const sheetNew = findSheet(sheetNames, 'new');
  const sheetAll = findSheet(sheetNames, 'all');
  const sheetLast = lastMonthLabel ? findSheet(sheetNames, lastMonthLabel) : undefined;

  const missingSheets: string[] = [];
  if (!sheetNew) missingSheets.push('"new" (new volume)');
  if (!sheetAll) missingSheets.push('"all" (payment data)');
  if (lastMonthLabel && !sheetLast) {
    missingSheets.push(`"${lastMonthLabel}" (previous month volume)`);
  }

  if (missingSheets.length > 0) {
    return {
      valid: false,
      error: `Missing required sheet(s): ${missingSheets.join(', ')}.`,
    };
  }

  const problems: string[] = [];

  // AR Last Month + New Volume: a required column only needs to appear on
  // at least one of the two sheets (matches how the backend concatenates
  // them), so check the union rather than each sheet individually.
  const combinedHeaders = new Set([
    ...(sheetLast ? sheetHeaders(workbook, sheetLast) : []),
    ...(sheetNew ? sheetHeaders(workbook, sheetNew) : []),
  ]);
  const missingCombined = REQUIRED_AR_COLUMNS.filter(
    (col) => !combinedHeaders.has(col.trim().toLowerCase())
  );
  if (missingCombined.length) {
    const sheetLabel = [sheetLast, sheetNew].filter(Boolean).join(' / ');
    problems.push(`"${sheetLabel}" sheets are missing: ${missingCombined.join(', ')}`);
  }

  if (sheetAll) {
    const allHeaders = sheetHeaders(workbook, sheetAll);
    const missingAll: string[] = [];
    if (!hasColumn(allHeaders, 'VIN No.')) missingAll.push('VIN No.');
    if (!hasColumn(allHeaders, 'Payment Date') && !hasColumn(allHeaders, 'Date')) {
      missingAll.push('Payment Date (or Date)');
    }
    if (missingAll.length) problems.push(`"${sheetAll}" sheet is missing: ${missingAll.join(', ')}`);
  }

  if (problems.length > 0) {
    return { valid: false, error: `Required column(s) missing — ${problems.join('; ')}.` };
  }

  return { valid: true };
}
