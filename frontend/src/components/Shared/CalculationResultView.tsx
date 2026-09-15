import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { cn } from '../../lib/utils';
import { formatNumber } from '../../utils/formatters';
import type { CalculationResponse } from '../../types';

interface CalculationResultViewProps {
  result: CalculationResponse;
  fileName: string;
  onReset: () => void;
  onExport: () => void;
  onUploadWaive?: () => void;
}

type ResultTab = 'summary' | 'arDetail' | 'byDealer' | 'dealerSummary';

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value, 2);
  return String(value);
}

/** The mismatch panel's Assigned To / Should Be columns show "— none —" for Default. */
function campaignLabel(value: string): string {
  return value.trim().toLowerCase() === 'normal' ? '— none —' : value;
}

export const CalculationResultView: React.FC<CalculationResultViewProps> = ({
  result,
  fileName,
  onReset,
  onExport,
  onUploadWaive,
}) => {
  const isWaiveRun = result.stats?.totalWaive !== undefined;

  const [activeTab, setActiveTab] = useState<ResultTab>('summary');
  const [highlightedVin, setHighlightedVin] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'arDetail' || !highlightedVin) return;
    const el = document.getElementById(`ar-detail-row-${highlightedVin}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeTab, highlightedVin]);

  const handleMismatchRowClick = (vinNumber: string) => {
    setActiveTab('arDetail');
    setHighlightedVin(vinNumber);
  };

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

  const waiveRows = useMemo(() => {
    const records = result.detailRecords ?? [];
    if (records.length === 0 || !('waive amount' in records[0])) return [];

    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return value;
      const parsed = parseFloat(String(value ?? '0').replace(/,/g, ''));
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return records
      .map((row) => ({ row, waiveAmount: toNumber(row['waive amount']) }))
      .filter(({ waiveAmount }) => waiveAmount > 0)
      .map(({ row, waiveAmount }) => ({
        vinNumber: String(row['VIN Number'] ?? ''),
        dealer: `${row['Dealer Code'] ?? ''} - ${row['Dealer Name'] ?? ''}`,
        waiveAmount,
        reason: String(row['reason'] ?? ''),
        ramChargeAfter: toNumber(row['RAM Charge (After Waive)']),
        dealerChargeAfter: toNumber(row['Dealer Charge (After Waive)']),
      }));
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
      <div
        className={cn(
          'grid grid-cols-1 gap-4 sm:grid-cols-2',
          isWaiveRun ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
        )}
      >
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
        {isWaiveRun && (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-3xl font-bold tracking-tight text-slate-900">
              {formatNumber(safeStats.totalWaive ?? 0, 2)}
            </p>
            <p className="mt-1 text-sm text-slate-500">THB waived (Total Waive amount)</p>
          </div>
        )}
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
        <Table containerClassName="border-0 rounded-none bg-transparent">
          <TableHeader className="border-b-0 bg-slate-50">
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableHead className="text-slate-500">Campaign</TableHead>
              <TableHead className="text-right text-slate-500">VINs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeCampaigns.map((item) => (
              <TableRow key={item.campaign} className="border-b-0 border-t border-slate-100 hover:bg-transparent">
                <TableCell className="px-6 py-3 text-slate-800">{item.campaign}</TableCell>
                <TableCell className="px-6 py-3 text-right font-semibold text-slate-900">
                  {item.vins.toLocaleString('en-US')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="border-slate-200 bg-slate-50">
            <TableRow className="hover:bg-transparent">
              <TableCell className="px-6 py-3 font-semibold text-slate-900">Total</TableCell>
              <TableCell className="px-6 py-3 text-right font-semibold text-slate-900">
                {safeStats.rowsProcessed.toLocaleString('en-US')}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {waiveRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Waive preview</h3>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                {waiveRows.length} waived
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              VINs with an approved waive amount applied from the uploaded waive file
            </p>
          </div>
          <Table containerClassName="max-h-[28rem] border-0 rounded-none bg-transparent">
            <TableHeader className="sticky top-0 border-b-0 bg-slate-50">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="text-slate-500">VIN Number</TableHead>
                <TableHead className="text-slate-500">Dealer</TableHead>
                <TableHead className="text-right text-slate-500">Waive Amount</TableHead>
                <TableHead className="text-slate-500">Reason</TableHead>
                <TableHead className="text-right text-slate-500">RAM Charge (After Waive)</TableHead>
                <TableHead className="text-right text-slate-500">Dealer Charge (After Waive)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waiveRows.map((row) => (
                <TableRow key={row.vinNumber} className="border-b-0 border-t border-slate-100 hover:bg-transparent">
                  <TableCell className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {row.vinNumber}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">{row.dealer}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatNumber(row.waiveAmount, 2)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">{row.reason}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-700">
                    {formatNumber(row.ramChargeAfter, 2)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-slate-700">
                    {formatNumber(row.dealerChargeAfter, 2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
        {mismatchCount === 0 ? (
          <p className="px-6 pb-6 text-sm text-slate-500">No mismatches found.</p>
        ) : (
          <Table containerClassName="max-h-[28rem] border-0 rounded-none bg-white/70">
            <TableHeader className="sticky top-0 border-b-0 bg-orange-50/80">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead className="text-slate-500">VIN Number</TableHead>
                <TableHead className="text-slate-500">Dealer</TableHead>
                <TableHead className="text-slate-500">Model</TableHead>
                <TableHead className="text-slate-500">Drawdown</TableHead>
                <TableHead className="text-red-600">Assigned to</TableHead>
                <TableHead className="text-emerald-600">Should be</TableHead>
                <TableHead className="text-slate-500">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeMismatches.map((row) => (
                <TableRow
                  key={row.vinNumber}
                  onClick={() => handleMismatchRowClick(row.vinNumber)}
                  className="cursor-pointer border-b-0 border-t border-orange-100 hover:bg-orange-100/50"
                  title="View this VIN in AR Detail"
                >
                  <TableCell className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {row.vinNumber}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-700">{row.dealer}</TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3 text-slate-700">{row.model}</TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3 text-slate-700">{row.drawdown}</TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
                      {campaignLabel(row.assignedTo)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                      {campaignLabel(row.shouldBe)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-slate-600">{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">
              {isWaiveRun ? 'Calculation Result (After Waive)' : 'Calculation result'}
            </h3>
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
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 border-b-0 bg-slate-50">
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableHead className="text-slate-500">Description</TableHead>
                  <TableHead className="text-right text-slate-500">Amount (THB)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryRows.map((row) => (
                  <TableRow
                    key={row.description}
                    className={cn(
                      'border-b-0 border-t border-slate-100 hover:bg-transparent',
                      row.description === 'Total' && 'bg-slate-50 font-semibold'
                    )}
                  >
                    <TableCell className="px-6 py-3 text-slate-800">{row.description}</TableCell>
                    <TableCell className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.amount, 2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </TabsContent>

          <TabsContent value="arDetail">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 border-b-0 bg-slate-50">
                <TableRow className="border-b-0 hover:bg-transparent">
                  {detailColumns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap text-slate-500">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.detailRecords?.map((row, index) => {
                  const vin = String(row['VIN Number'] ?? '');
                  return (
                    <TableRow
                      key={index}
                      id={vin ? `ar-detail-row-${vin}` : undefined}
                      className={cn(
                        'border-b-0 border-t border-slate-100 hover:bg-slate-50',
                        vin && vin === highlightedVin && 'bg-amber-50 hover:bg-amber-50'
                      )}
                    >
                      {detailColumns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {cellValue(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </table>
          </TabsContent>

          <TabsContent value="byDealer">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 border-b-0 bg-slate-50">
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableHead className="text-slate-500">Dealer Code</TableHead>
                  <TableHead className="text-slate-500">Dealer Name</TableHead>
                  <TableHead className="text-right text-slate-500">VINs</TableHead>
                  <TableHead className="text-right text-slate-500">AR Amount</TableHead>
                  <TableHead className="text-right text-slate-500">RAM Charge</TableHead>
                  <TableHead className="text-right text-slate-500">Dealer Charge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(result.summaryByDealerCode ?? []).map((row) => (
                  <TableRow key={row.dealerCode} className="border-b-0 border-t border-slate-100 hover:bg-slate-50">
                    <TableCell className="px-6 py-3 font-semibold text-slate-900">{row.dealerCode}</TableCell>
                    <TableCell className="px-6 py-3 text-slate-700">{row.dealerName}</TableCell>
                    <TableCell className="px-6 py-3 text-right text-slate-800">
                      {row.vins.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.arAmount, 2)}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.ramCharge, 2)}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-semibold text-slate-900">
                      {formatNumber(row.dealerCharge, 2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </TabsContent>

          <TabsContent value="dealerSummary">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 border-b-0 bg-slate-50">
                <TableRow className="border-b-0 hover:bg-transparent">
                  {dealerSummaryColumns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap text-slate-500">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.dealerSummary?.map((row, index) => (
                  <TableRow key={index} className="border-b-0 border-t border-slate-100 hover:bg-slate-50">
                    {dealerSummaryColumns.map((col) => (
                      <TableCell key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {cellValue(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
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
            {isWaiveRun ? 'Replace Waive Conditions' : 'Upload Waive Conditions'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CalculationResultView;
