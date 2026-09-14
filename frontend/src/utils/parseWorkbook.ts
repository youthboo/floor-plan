import * as XLSX from 'xlsx';

export type CellValue = string | number | boolean | null;

export interface SheetPreview {
  name: string;
  headers: string[];
  rows: CellValue[][];
}

export interface WorkbookPreview {
  fileName: string;
  sheets: SheetPreview[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** DD/MM/YYYY, matching the date format the backend uses everywhere else (strftime '%d/%m/%Y'). */
function formatDate(date: Date): string {
  // xlsx's Excel-serial-to-Date conversion can land a few seconds off exact
  // UTC midnight (float rounding), which can shift a date-only value onto
  // the wrong calendar day. Round to the nearest UTC day first to correct it,
  // then read UTC components (the value has no real time-of-day to begin with).
  const rounded = new Date(Math.round(date.getTime() / MS_PER_DAY) * MS_PER_DAY);
  const day = String(rounded.getUTCDate()).padStart(2, '0');
  const month = String(rounded.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${rounded.getUTCFullYear()}`;
}

function normalizeCell(value: unknown): CellValue {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseSheet(name: string, sheet: XLSX.WorkSheet, headerRowIndexOverride?: number): SheetPreview {
  // Keep blank rows in place so row indices match the sheet's physical row numbers.
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null | undefined)[]>(
    sheet,
    { header: 1, defval: null, raw: true, blankrows: true }
  );

  if (!matrix.length) {
    return { name, headers: [], rows: [] };
  }

  const isSummarySheet = name.trim().toLowerCase() === 'summary';

  let startIndex: number;
  if (headerRowIndexOverride !== undefined) {
    startIndex = headerRowIndexOverride;
  } else if (isSummarySheet) {
    // Summary sheet: use the first non-empty row as headers (top content row of the sheet)
    const headerRowIndex = matrix.findIndex((row) =>
      (row ?? []).some((cell) => cell !== null && cell !== undefined && cell !== '')
    );
    startIndex = headerRowIndex >= 0 ? headerRowIndex : 0;
  } else {
    // Every other sheet: column headers live on row 2, data starts on row 3.
    startIndex = matrix.length > 1 ? 1 : 0;
  }

  const headerRow = matrix[startIndex] ?? [];

  const columnCount = Math.max(
    headerRow.length,
    ...matrix.slice(startIndex + 1).map((row) => row?.length ?? 0),
    0
  );

  const headers = Array.from({ length: columnCount }, (_, index) => {
    const value = normalizeCell(headerRow[index]);
    return value === null ? '' : String(value);
  });

  const rows = matrix.slice(startIndex + 1).map((row) =>
    Array.from({ length: columnCount }, (_, index) => normalizeCell(row?.[index]))
  );

  // Drop trailing fully-empty rows
  const trimmedRows = [...rows];
  while (
    trimmedRows.length > 0 &&
    (trimmedRows.at(-1) ?? []).every((cell) => cell === null || cell === '')
  ) {
    trimmedRows.pop();
  }

  return { name, headers, rows: trimmedRows };
}

export async function parseWorkbookFile(file: File): Promise<WorkbookPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheets = workbook.SheetNames.map((name) =>
    parseSheet(name, workbook.Sheets[name])
  );

  return {
    fileName: file.name,
    sheets,
  };
}

/**
 * Parses a single-sheet file (e.g. SOT, Waive) whose header row is the sheet's
 * first row, unlike the AR drawdown workbook's sheets (header on row 2).
 */
export async function parseSingleSheetFile(file: File): Promise<SheetPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0] ?? '';
  return parseSheet(firstSheetName, workbook.Sheets[firstSheetName], 0);
}
