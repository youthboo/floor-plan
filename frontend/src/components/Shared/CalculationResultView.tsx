import React, { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../utils/formatters';
import type { CalculationResponse } from '../../types';
import SuccessAlert from './SuccessAlert';

interface CalculationResultViewProps {
  result: CalculationResponse;
  fileName: string;
  onReset: () => void;
  onExport: () => void;
  onUploadWaive?: () => void;
  successMessage?: string | null;
}

type ResultTab = 'summary' | 'arDetail' | 'byDealer' | 'dealerSummary';

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value, 2);
  return String(value);
}

export const CalculationResultView: React.FC<CalculationResultViewProps> = ({
  result,
  fileName,
  onReset,
  onExport,
  onUploadWaive,
  successMessage,
}) => {
  const [activeTab, setActiveTab] = useState<ResultTab>('summary');
  const { stats, campaignDistribution, mismatches, summary } = result;
  const safeSummary = summary ?? {
    'AR Last Month': 0,
    'New Volume': 0,
    'All Payment (Paid=Y)': 0,
    'AR Outstanding (Paid=N)': 0,
    Total: 0,
  };
  const safeStats = stats ?? {
    rowsProcessed: result.detailRecords?.length ?? 0,
    totalRamCharge: 0,
    totalDealerCharge: 0,
    mismatchCount: 0,
  };
  const safeCampaigns = campaignDistribution ?? [];
  const safeMismatches = mismatches ?? [];
  const mismatchCount = safeMismatches.length || safeStats.mismatchCount || 0;

  const summaryRows = useMemo(
    () =>
      (
        [
          'AR Last Month',
          'New Volume',
          'All Payment (Paid=Y)',
          'AR Outstanding (Paid=N)',
          'Total',
        ] as const
      ).map((key) => ({
        description: key,
        amount: safeSummary[key] ?? 0,
      })),
    [safeSummary]
  );

  const detailColumns = useMemo(() => {
    const first = result.detailRecords?.[0];
    return first ? Object.keys(first) : [];
  }, [result.detailRecords]);

  const dealerSummaryColumns = useMemo(() => {
    const first = result.dealerSummary?.[0];
    return first ? Object.keys(first) : [];
  }, [result.dealerSummary]);

  const tabs: { id: ResultTab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'arDetail', label: 'AR Detail' },
    { id: 'byDealer', label: 'Summary by Dealer Code' },
    { id: 'dealerSummary', label: 'Dealer Summary' },
  ];

  return (
    <div className="space-y-6">
      {successMessage && <SuccessAlert message={successMessage} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {safeStats.rowsProcessed.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-sm text-slate-500">rows processed</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {formatNumber(safeStats.totalRamCharge, 2)}
          </p>
          <p className="mt-1 text-sm text-slate-500">THB (RAM Charge column)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {formatNumber(safeStats.totalDealerCharge, 2)}
          </p>
          <p className="mt-1 text-sm text-slate-500">THB (Dealer Charge column)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {mismatchCount.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-sm text-slate-500">mismatched VIN / campaign</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="text-base font-semibold text-slate-900">Cars (VINs) by campaign</h3>
          <p className="mt-1 text-sm text-slate-500">
            Distribution of {safeStats.rowsProcessed.toLocaleString('en-US')} processed VINs across
            subvention campaigns
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Campaign
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  VINs
                </th>
              </tr>
            </thead>
            <tbody>
              {safeCampaigns.map((item) => (
                <tr key={item.campaign} className="border-t border-slate-100">
                  <td className="px-6 py-3 text-slate-800">{item.campaign}</td>
                  <td className="px-6 py-3 text-right font-semibold text-slate-900">
                    {item.vins.toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-6 py-3 font-semibold text-slate-900">Total</td>
                <td className="px-6 py-3 text-right font-semibold text-slate-900">
                  {safeStats.rowsProcessed.toLocaleString('en-US')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {mismatchCount > 0 && (
        <div className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50/60 shadow-sm">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-red-700">Mismatched VIN and campaign</h3>
              <span className="rounded-full bg-orange-200 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
                {mismatchCount} found
              </span>
            </div>
            <p className="mt-1 text-sm text-red-600/80">
              {mismatchCount} VINs assigned to a campaign that does not match the campaign conditions
            </p>
          </div>
          <div className="overflow-x-auto bg-white/70">
            <table className="w-full text-sm">
              <thead className="bg-orange-50/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    VIN Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dealer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Drawdown
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-red-600">
                    Assigned to
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-emerald-600">
                    Should be
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeMismatches.map((row) => (
                  <tr key={row.vinNumber} className="border-t border-orange-100">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                      {row.vinNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.dealer}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.model}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.drawdown}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
                        {row.assignedTo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        {row.shouldBe}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">Calculation result</h3>
            <p className="mt-1 truncate text-xs text-slate-400">from {fileName}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            Export result
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ResultTab)}>
          <TabsList className="border-b border-slate-100 px-6 py-4">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} variant="pill" value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="max-h-[28rem] overflow-auto">
          <TabsContent value="summary">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Amount (THB)
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <tr
                    key={row.description}
                    className={cn(
                      'border-t border-slate-100',
                      row.description === 'Total' && 'bg-slate-50 font-semibold'
                    )}
                  >
                    <td className="px-6 py-3 text-slate-800">{row.description}</td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.amount, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="arDetail">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {detailColumns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.detailRecords?.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                    {detailColumns.map((col) => (
                      <td key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {cellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="byDealer">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dealer Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dealer Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    VINs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    AR Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    RAM Charge
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dealer Charge
                  </th>
                </tr>
              </thead>
              <tbody>
                {(result.summaryByDealerCode ?? []).map((row) => (
                  <tr key={row.dealerCode} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-3 font-semibold text-slate-900">{row.dealerCode}</td>
                    <td className="px-6 py-3 text-slate-700">{row.dealerName}</td>
                    <td className="px-6 py-3 text-right text-slate-800">
                      {row.vins.toLocaleString('en-US')}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.arAmount, 2)}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.ramCharge, 2)}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.dealerCharge, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="dealerSummary">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {dealerSummaryColumns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.dealerSummary?.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100 hover:bg-slate-50">
                    {dealerSummaryColumns.map((col) => (
                      <td key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {cellValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            className="border-red-400 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button type="button" variant="outline" onClick={onUploadWaive}>
            Upload Waive Conditions
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalculationResultView;
