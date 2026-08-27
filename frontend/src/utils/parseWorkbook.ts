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

function normalizeCell(value: unknown): CellValue {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseSheet(name: string, sheet: XLSX.WorkSheet): SheetPreview {
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
  if (isSummarySheet) {
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
