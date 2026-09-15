import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';
import { cn } from '../../lib/utils';
import type { CellValue, SheetPreview, WorkbookPreview } from '../../utils/parseWorkbook';

interface ARDrawdownPreviewProps {
  workbook: WorkbookPreview;
  onReset: () => void;
  onCalculate?: () => void;
  onRemoveAR?: () => void;
  onUploadSOT?: () => void;
  onRemoveSOT?: () => void;
  sotFileName?: string | null;
  sotUploading?: boolean;
  sotPreview?: SheetPreview | null;
}

function formatCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('en-US')
      : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(value);
}

function isNumericCell(value: CellValue): boolean {
  return typeof value === 'number';
}

/**
 * Some sheets (e.g. "Summary") repeat their column header labels as a plain
 * data row before every new block (a new month section, etc). Since the
 * table already has a single header row, drop these repeats from the body.
 */
function isRepeatedHeaderRow(row: CellValue[], headers: string[]): boolean {
  const meaningfulHeaders = headers
    .map((header, index) => ({ header: header.trim().toLowerCase(), index }))
    .filter(({ header }) => header !== '');

  if (meaningfulHeaders.length === 0) return false;

  return meaningfulHeaders.every(({ header, index }) => {
    const cell = row[index];
    const cellText = cell === null || cell === undefined ? '' : String(cell).trim().toLowerCase();
    if (!cellText) return false;
    // Fuzzy match so header variants (e.g. "Amount" vs "Amount (THB)") still count as a repeat.
    return cellText === header || cellText.includes(header) || header.includes(cellText);
  });
}

export const ARDrawdownPreview: React.FC<ARDrawdownPreviewProps> = ({
  workbook,
  onReset,
  onCalculate,
  onRemoveAR,
  onUploadSOT,
  onRemoveSOT,
  sotFileName,
  sotUploading,
  sotPreview,
}) => {
  const [activeSheet, setActiveSheet] = useState(workbook.sheets[0]?.name ?? '');

  const currentSheet = useMemo(
    () => workbook.sheets.find((sheet) => sheet.name === activeSheet) ?? workbook.sheets[0],
    [workbook.sheets, activeSheet]
  );

  const visibleRows = useMemo(() => {
    if (!currentSheet) return [];
    return currentSheet.rows.filter((row) => !isRepeatedHeaderRow(row, currentSheet.headers));
  }, [currentSheet]);

  if (!currentSheet) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No sheet data found in this file.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-primary-100 bg-primary-50 px-6 py-3 text-sm text-primary-700">
          Files uploaded — review the preview below, then press Calculate.
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">AR drawdown preview</h2>
          <div className="flex items-center gap-2 sm:max-w-md">
            <p className="truncate text-xs text-slate-400">{workbook.fileName}</p>
            {onRemoveAR && (
              <button
                type="button"
                onClick={onRemoveAR}
                aria-label="Remove AR file"
                title="Remove AR file"
                className="flex-shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <Tabs value={activeSheet} onValueChange={setActiveSheet}>
          <TabsList className="border-b border-slate-100 px-6 py-4">
            {workbook.sheets.map((sheet) => (
              <TabsTrigger key={sheet.name} variant="pill" value={sheet.name}>
                {sheet.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {currentSheet.headers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">This sheet is empty.</p>
        ) : (
          <Table containerClassName="max-h-[28rem] border-0 rounded-none bg-transparent">
            <TableHeader className="sticky top-0">
              <TableRow>
                {currentSheet.headers.map((header, index) => (
                  <TableHead key={`${header}-${index}`} className="whitespace-nowrap">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      className={cn(
                        'whitespace-nowrap text-slate-700',
                        isNumericCell(cell) && 'text-right font-semibold text-slate-900'
                      )}
                    >
                      {formatCell(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {sotPreview && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">SOT preview</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {sotPreview.rows.length} rows
              </span>
            </div>
            <div className="flex items-center gap-2 sm:max-w-md">
              <p className="truncate text-xs text-slate-400">{sotFileName}</p>
              {onRemoveSOT && (
                <button
                  type="button"
                  onClick={onRemoveSOT}
                  aria-label="Remove SOT file"
                  title="Remove SOT file"
                  className="flex-shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {sotPreview.headers.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">This file is empty.</p>
          ) : (
            <Table containerClassName="max-h-[20rem] border-0 rounded-none bg-transparent">
              <TableHeader className="sticky top-0">
                <TableRow>
                  {sotPreview.headers.map((header, index) => (
                    <TableHead key={`${header}-${index}`} className="whitespace-nowrap">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sotPreview.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className={cn(
                          'whitespace-nowrap text-slate-700',
                          cellIndex === 0 && 'font-semibold text-slate-900'
                        )}
                      >
                        {formatCell(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          className="border-red-400 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onReset}
        >
          Reset
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {sotFileName && !sotPreview && (
            <span className="max-w-[12rem] truncate text-xs text-slate-500" title={sotFileName}>
              SOT: {sotFileName}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onUploadSOT}
            disabled={!onUploadSOT || sotUploading}
          >
            {sotUploading ? 'Uploading SOT...' : sotFileName ? 'Replace SOT' : 'Upload SOT'}
          </Button>
          <Button type="button" variant="default" onClick={onCalculate} disabled={!onCalculate}>
            Calculate
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ARDrawdownPreview;
