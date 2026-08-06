import React, { useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';

interface SystemConfig {
  month: string;
  year: string;
  penaltyRate: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const YEARS = ['2024', '2025', '2026', '2027'];

function getMonthMeta(month: string, year: string) {
  const monthIndex = MONTHS.indexOf(month as (typeof MONTHS)[number]);
  const yearNum = Number(year);
  const days = new Date(yearNum, monthIndex + 1, 0).getDate();
  const paddedMonth = String(monthIndex + 1).padStart(2, '0');
  return {
    fullMonthDays: days,
    monthEndDate: `${days}-${paddedMonth}-${year}`,
  };
}

export const UploadCalculatePage: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({
    month: 'October',
    year: '2025',
    penaltyRate: 15,
  });
  const [arFile, setArFile] = useState<File | null>(null);
  const [sotFile, setSotFile] = useState<File | null>(null);

  const arInputRef = useRef<HTMLInputElement>(null);
  const sotInputRef = useRef<HTMLInputElement>(null);

  const { monthEndDate, fullMonthDays } = useMemo(
    () => getMonthMeta(config.month, config.year),
    [config.month, config.year]
  );

  const handleARFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setArFile(e.target.files[0]);
  };

  const handleSOTFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSotFile(e.target.files[0]);
  };

  return (
    <div className="w-full bg-white py-10">
      <div className="mx-auto max-w-5xl px-6 sm:px-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Upload & Calculate
          </h1>
          <p className="text-sm text-slate-500">
            Import a wholesale AR drawdown file to compute floorplan interest
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-5">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-slate-900">System configuration</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">month info</span>
              </div>
              <Button type="button" variant="outline" size="sm">
                Edit
              </Button>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="month-select">Select Month</Label>
                  <Select
                    id="month-select"
                    value={config.month}
                    onChange={(e) => setConfig({ ...config, month: e.target.value })}
                  >
                    {MONTHS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="year-select">Select Year</Label>
                  <Select
                    id="year-select"
                    value={config.year}
                    onChange={(e) => setConfig({ ...config, year: e.target.value })}
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="penalty-rate">Penalty Rate (%)</Label>
                  <Input
                    id="penalty-rate"
                    type="number"
                    value={config.penaltyRate}
                    onChange={(e) =>
                      setConfig({ ...config, penaltyRate: Number.parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="month-end-date" className="flex items-center gap-1.5 text-slate-400">
                    <span>Month End Date</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-slate-500">
                      AUTO
                    </span>
                  </Label>
                  <Input
                    id="month-end-date"
                    type="text"
                    value={monthEndDate}
                    readOnly
                    disabled
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="full-month-days" className="flex items-center gap-1.5 text-slate-400">
                    <span>Full Month Days</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-slate-500">
                      AUTO
                    </span>
                  </Label>
                  <Input
                    id="full-month-days"
                    type="number"
                    value={fullMonthDays}
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 sm:px-10">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              {arFile || sotFile ? (
                <>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">Files ready</h3>
                  <div className="mb-6 space-y-1 text-sm text-slate-600">
                    {arFile && <p>AR: {arFile.name}</p>}
                    {sotFile && <p>SOT: {sotFile.name}</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button type="button" variant="default" size="default">
                      Continue to preview
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="default"
                      onClick={() => {
                        setArFile(null);
                        setSotFile(null);
                        if (arInputRef.current) arInputRef.current.value = '';
                        if (sotInputRef.current) sotInputRef.current.value = '';
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">No file uploaded</h3>
                  <p className="mb-6 text-sm leading-relaxed text-slate-500">
                    Upload the wholesale AR drawdown file to begin. The SOT (stock-on-truck) file is
                    optional. You&apos;ll preview the data before calculating.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="default"
                      size="default"
                      onClick={() => arInputRef.current?.click()}
                    >
                      Upload AR
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="default"
                      onClick={() => sotInputRef.current?.click()}
                    >
                      Upload SOT
                    </Button>
                  </div>
                </>
              )}

              <input
                ref={arInputRef}
                id="ar-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleARFileSelect}
                className="hidden"
              />
              <input
                ref={sotInputRef}
                id="sot-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleSOTFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadCalculatePage;
