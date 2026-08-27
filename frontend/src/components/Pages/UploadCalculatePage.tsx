import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import UploadARModal from '../Shared/UploadARModal';
import UploadWaiveModal from '../Shared/UploadWaiveModal';
import UploadSOTModal from '../Shared/UploadSOTModal';
import ARDrawdownPreview from '../Shared/ARDrawdownPreview';
import CalculationResultView from '../Shared/CalculationResultView';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import {
  parseWorkbookFile,
  type WorkbookPreview,
} from '../../utils/parseWorkbook';
import { fileService } from '../../services/api';
import { useCalculation } from '../../hooks/useCalculation';
import { useConfig } from '../../hooks/useConfig';
import type { CalculationResponse } from '../../types';

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

const BASE_YEARS = ['2024', '2025', '2026', '2027'];

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

function getUploadErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    return data?.error || err.message || 'Upload failed';
  }
  if (err instanceof Error) return err.message;
  return 'Upload failed';
}

export const UploadCalculatePage: React.FC = () => {
  const {
    config: appConfig,
    loading: configLoading,
    error: configError,
  } = useConfig();

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [arFile, setArFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookPreview | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isWaiveModalOpen, setIsWaiveModalOpen] = useState(false);
  const [isSOTModalOpen, setIsSOTModalOpen] = useState(false);
  const [sotFile, setSotFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isWaiveRecalculating, setIsWaiveRecalculating] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<CalculationResponse | null>(null);

  const { calculate, loading: isCalculating, error: calcError, reset: resetCalculation } =
    useCalculation();

  useEffect(() => {
    if (!appConfig?.config) return;
    setSystemConfig({
      month: appConfig.config.month,
      year: appConfig.config.year,
      penaltyRate: appConfig.config.penaltyRate,
    });
  }, [appConfig]);

  const yearOptions = useMemo(() => {
    const years = new Set(BASE_YEARS);
    if (systemConfig?.year) years.add(systemConfig.year);
    if (appConfig?.config.year) years.add(appConfig.config.year);
    return Array.from(years).sort((a, b) => a.localeCompare(b));
  }, [systemConfig?.year, appConfig?.config.year]);

  const { monthEndDate, fullMonthDays } = useMemo(() => {
    if (!systemConfig) {
      return { monthEndDate: '', fullMonthDays: 0 };
    }
    return getMonthMeta(systemConfig.month, systemConfig.year);
  }, [systemConfig]);

  const handleARUpload = async (file: File) => {
    setIsUploadModalOpen(false);
    setIsParsing(true);
    setPageError(null);
    setSuccessMessage(null);
    setCalcResult(null);
    resetCalculation();

    try {
      const preview = await parseWorkbookFile(file);
      setArFile(file);
      setWorkbook(preview);
      setUploadedFilePath(null);
      setSotFile(null);
    } catch {
      setArFile(null);
      setWorkbook(null);
      setPageError('Failed to read the uploaded file. Please try a valid .xlsx or .csv file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleReset = () => {
    setArFile(null);
    setWorkbook(null);
    setUploadedFilePath(null);
    setPageError(null);
    setSuccessMessage(null);
    setCalcResult(null);
    setIsEditingConfig(false);
    setIsWaiveModalOpen(false);
    setIsSOTModalOpen(false);
    setSotFile(null);
    resetCalculation();
    if (appConfig?.config) {
      setSystemConfig({
        month: appConfig.config.month,
        year: appConfig.config.year,
        penaltyRate: appConfig.config.penaltyRate,
      });
    }
  };

  const handleToggleConfigEdit = () => {
    if (calcResult) return;
    if (isEditingConfig) {
      setIsEditingConfig(false);
      return;
    }
    setIsEditingConfig(true);
  };

  const handleCalculate = async () => {
    if (!arFile || !systemConfig) return;

    setPageError(null);
    setSuccessMessage(null);
    setIsUploading(true);

    try {
      let filePath = uploadedFilePath;
      if (!filePath) {
        const upload = await fileService.uploadAR(arFile);
        filePath = upload.filePath;
        setUploadedFilePath(filePath);
      }

      setIsUploading(false);
      const data = await calculate(filePath, {
        runConfig: {
          month: systemConfig.month,
          year: systemConfig.year,
          penaltyRate: systemConfig.penaltyRate,
        },
      });
      if (data) {
        setCalcResult(data);
        setIsEditingConfig(false);
      }
    } catch (err) {
      setPageError(getUploadErrorMessage(err));
      setIsUploading(false);
    }
  };

  const handleWaiveRecalculate = async (waiveFile: File) => {
    if (!arFile || !systemConfig) return;

    setPageError(null);
    setSuccessMessage(null);
    setIsWaiveModalOpen(false);
    setIsWaiveRecalculating(true);

    try {
      let arPath = uploadedFilePath;
      if (!arPath) {
        const upload = await fileService.uploadAR(arFile);
        arPath = upload.filePath;
        setUploadedFilePath(arPath);
      }

      const waiveUpload = await fileService.uploadWaive(waiveFile);
      const data = await calculate(arPath, {
        waiveFilePath: waiveUpload.filePath,
        runConfig: {
          month: systemConfig.month,
          year: systemConfig.year,
          penaltyRate: systemConfig.penaltyRate,
        },
      });

      if (data) {
        setCalcResult(data);
        setSuccessMessage('Recalculated with waive conditions applied');
      }
    } catch (err) {
      setPageError(getUploadErrorMessage(err));
    } finally {
      setIsWaiveRecalculating(false);
    }
  };

  const handleSOTUpload = (file: File) => {
    setIsSOTModalOpen(false);
    setSotFile(file);
  };

  const handleExport = async () => {
    if (!calcResult?.outputPath) return;
    const name = calcResult.outputPath.split(/[/\\]/).pop() || 'AR_Summary.xlsx';
    try {
      await fileService.downloadFile(calcResult.outputPath, name);
    } catch (err) {
      setPageError(getUploadErrorMessage(err));
    }
  };

  const busy = isParsing || isUploading || isCalculating || isWaiveRecalculating;
  const displayError = pageError || calcError || configError;

  let busyLabel = 'Reading workbook...';
  if (isWaiveRecalculating) busyLabel = 'Recalculating with waive conditions...';
  else if (isCalculating) busyLabel = 'Calculating charges...';
  else if (isUploading) busyLabel = 'Uploading file to server...';

  let contentSection: React.ReactNode;
  if (busy) {
    contentSection = (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16">
        <LoadingSpinner />
        <p className="-mt-8 text-center text-sm text-slate-500">{busyLabel}</p>
      </div>
    );
  } else if (calcResult && arFile) {
    contentSection = (
      <CalculationResultView
        result={calcResult}
        fileName={arFile.name}
        onReset={handleReset}
        onExport={handleExport}
        onUploadWaive={() => {
          setPageError(null);
          setIsWaiveModalOpen(true);
        }}
        successMessage={successMessage}
      />
    );
  } else if (workbook && arFile) {
    contentSection = (
      <ARDrawdownPreview
        key={workbook.fileName}
        workbook={workbook}
        onReset={handleReset}
        onCalculate={handleCalculate}
        onUploadSOT={() => {
          setPageError(null);
          setIsSOTModalOpen(true);
        }}
        sotFileName={sotFile?.name}
      />
    );
  } else {
    contentSection = (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <h3 className="mb-3 text-lg font-semibold text-slate-900">No file uploaded</h3>
          <p className="mb-6 text-sm leading-relaxed text-slate-500">
            Upload the wholesale AR drawdown file to begin. You&apos;ll preview the data before
            calculating.
          </p>
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => setIsUploadModalOpen(true)}
          >
            Upload AR
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white py-10">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
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
                <span className="text-slate-400">from config sheet</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleConfigEdit}
                disabled={!!calcResult || configLoading || !systemConfig}
              >
                {isEditingConfig ? 'Done' : 'Edit'}
              </Button>
            </CardHeader>

            <CardContent className="px-6 pb-6">
              {configLoading || !systemConfig ? (
                <div className="py-6">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="month-select">Select Month</Label>
                    <Select
                      value={systemConfig.month}
                      onValueChange={(month: string) =>
                        setSystemConfig({ ...systemConfig, month })
                      }
                      disabled={!isEditingConfig}
                    >
                      <SelectTrigger id="month-select">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month} value={month}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="year-select">Select Year</Label>
                    <Select
                      value={systemConfig.year}
                      onValueChange={(year: string) =>
                        setSystemConfig({ ...systemConfig, year })
                      }
                      disabled={!isEditingConfig}
                    >
                      <SelectTrigger id="year-select">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="penalty-rate">Penalty Rate (%)</Label>
                    <Input
                      id="penalty-rate"
                      type="number"
                      value={systemConfig.penaltyRate === 0 ? '' : systemConfig.penaltyRate}
                      disabled={!isEditingConfig}
                      onChange={(e) =>
                        setSystemConfig({
                          ...systemConfig,
                          penaltyRate: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label
                      htmlFor="month-end-date"
                      className="flex items-center gap-1.5 text-slate-400"
                    >
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
                    <Label
                      htmlFor="full-month-days"
                      className="flex items-center gap-1.5 text-slate-400"
                    >
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
              )}
            </CardContent>
          </Card>

          {displayError && <ErrorAlert message={displayError} />}

          {contentSection}
        </div>
      </div>

      <UploadARModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleARUpload}
      />

      <UploadWaiveModal
        isOpen={isWaiveModalOpen}
        onClose={() => setIsWaiveModalOpen(false)}
        onRecalculate={handleWaiveRecalculate}
        isSubmitting={isWaiveRecalculating}
      />

      <UploadSOTModal
        isOpen={isSOTModalOpen}
        onClose={() => setIsSOTModalOpen(false)}
        onUpload={handleSOTUpload}
      />
    </div>
  );
};

export default UploadCalculatePage;
