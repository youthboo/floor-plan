import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';
import { cn } from '../../lib/utils';
import type { CellValue, WorkbookPreview } from '../../utils/parseWorkbook';

interface ARDrawdownPreviewProps {
  workbook: WorkbookPreview;
  onReset: () => void;
  onCalculate?: () => void;
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

export const ARDrawdownPreview: React.FC<ARDrawdownPreviewProps> = ({
  workbook,
  onReset,
  onCalculate,
}) => {
  const [activeSheet, setActiveSheet] = useState(workbook.sheets[0]?.name ?? '');

  const currentSheet = useMemo(
    () => workbook.sheets.find((sheet) => sheet.name === activeSheet) ?? workbook.sheets[0],
    [workbook.sheets, activeSheet]
  );

  if (!currentSheet) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No sheet data found in this file.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-primary-100 bg-primary-50 px-6 py-3 text-sm text-primary-700">
        Files uploaded — review the preview below, then press Calculate.
      </div>

      <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">AR drawdown preview</h2>
        <p className="truncate text-xs text-slate-400 sm:max-w-md sm:text-right">
          {workbook.fileName}
        </p>
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

      <div className="max-h-[28rem] overflow-auto border-b border-slate-100">
        {currentSheet.headers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">This sheet is empty.</p>
        ) : (
          <table className="w-full caption-bottom text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
              <tr>
                {currentSheet.headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    className="h-12 whitespace-nowrap px-6 py-3 text-left align-middle text-xs font-bold uppercase tracking-wider text-gray-700"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        'whitespace-nowrap px-6 py-4 align-middle text-slate-700',
                        isNumericCell(cell) && 'text-right font-semibold text-slate-900'
                      )}
                    >
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
        <Button
          type="button"
          variant="secondary"
          className="border-red-400 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onReset}
        >
          Reset
        </Button>
        <Button type="button" variant="default" onClick={onCalculate} disabled={!onCalculate}>
          Calculate
        </Button>
      </div>
    </div>
  );
};

export default ARDrawdownPreview;
