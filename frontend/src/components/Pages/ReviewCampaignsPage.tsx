import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';
import ErrorAlert from '../Shared/ErrorAlert';
import { campaignService } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { fromISODate, toISODate } from '../../data/mockCampaigns';
import type { CampaignConditionRow, CampaignDetail, CampaignImportResult, RateTierRow } from '../../types';

interface ReviewLocationState {
  importResult: CampaignImportResult;
}

export const ReviewCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ReviewLocationState | null;

  const [campaigns, setCampaigns] = useState<CampaignDetail[]>(
    state?.importResult.campaigns ?? []
  );
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (tab: string) => {
    navigate(`/?tab=${tab}`);
  };

  const handleRemove = (code: string) => {
    setCampaigns((prev) => prev.filter((c) => c.code !== code));
  };

  const handleUpdate = (code: string, updated: CampaignDetail) => {
    setCampaigns((prev) => prev.map((c) => (c.code === code ? updated : c)));
  };

  const handleCancel = () => {
    // Nothing has been saved yet — navigating away just discards the staged extraction.
    navigate('/?tab=campaign');
  };

  const handleImport = async () => {
    if (campaigns.length === 0) return;
    setError(null);
    setIsImporting(true);
    try {
      await campaignService.commit(campaigns);
      navigate('/?tab=campaign');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Import failed'));
      setIsImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-primary-100 bg-[#E0ECFB]">
        <div className="flex items-center justify-center px-4 py-4">
          <Tabs value="campaign" onValueChange={handleTabChange}>
            <TabsList className="rounded-full bg-white/50 p-1" aria-label="Main">
              <TabsTrigger variant="nav" value="campaign">
                Campaign Management
              </TabsTrigger>
              <TabsTrigger variant="nav" value="upload">
                Upload & Calculate
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="flex-1">
        <div className="w-full bg-white py-10">
          <div className="mx-auto max-w-7xl px-6 sm:px-10">
            <button
              onClick={handleCancel}
              className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              All campaigns
            </button>

            {!state?.importResult ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">
                  Nothing to review
                </h3>
                <p className="mb-6 text-sm leading-relaxed text-slate-500">
                  No campaigns are staged for review — upload a campaign file from Campaign
                  Management to get started.
                </p>
                <Button onClick={handleCancel}>Back to campaigns</Button>
              </div>
            ) : (
              <>
                <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      Review extracted campaigns
                    </h1>
                    <p className="text-sm text-slate-500">
                      From <span className="font-medium text-slate-700">{state.importResult.fileName}</span>
                      {' · '}
                      {state.importResult.campaignsExtracted} campaign
                      {state.importResult.campaignsExtracted === 1 ? '' : 's'} extracted
                      {' · '}
                      {state.importResult.totalQuotaRows} quota row
                      {state.importResult.totalQuotaRows === 1 ? '' : 's'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Fields below are editable — fix anything before importing.
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-3">
                    <Button variant="secondary" onClick={handleCancel} disabled={isImporting}>
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleImport}
                      disabled={isImporting || campaigns.length === 0}
                    >
                      {isImporting
                        ? 'Importing...'
                        : `Import campaigns${campaigns.length ? ` (${campaigns.length})` : ''}`}
                    </Button>
                  </div>
                </div>

                {error && <div className="mb-6"><ErrorAlert message={error} /></div>}

                {campaigns.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                    <p className="text-sm text-slate-500">
                      All extracted campaigns were removed — nothing left to import.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {campaigns.map((campaign) => (
                      <CampaignReviewCard
                        key={campaign.code}
                        campaign={campaign}
                        onRemove={() => handleRemove(campaign.code)}
                        onUpdate={(updated) => handleUpdate(campaign.code, updated)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const inputCellClass = 'h-8 min-w-[90px] text-sm';

const CampaignReviewCard: React.FC<{
  campaign: CampaignDetail;
  onRemove: () => void;
  onUpdate: (updated: CampaignDetail) => void;
}> = ({ campaign, onRemove, onUpdate }) => {
  const updateConditionField = <K extends keyof CampaignConditionRow>(
    rowId: number,
    field: K,
    value: CampaignConditionRow[K]
  ) => {
    onUpdate({
      ...campaign,
      campaignConditions: campaign.campaignConditions.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    });
  };

  const removeConditionRow = (rowId: number) => {
    onUpdate({
      ...campaign,
      campaignConditions: campaign.campaignConditions.filter((row) => row.id !== rowId),
    });
  };

  const updateTierField = <K extends keyof RateTierRow>(
    rowId: number,
    field: K,
    value: RateTierRow[K]
  ) => {
    onUpdate({
      ...campaign,
      rateByDayRange: campaign.rateByDayRange.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row
      ),
    });
  };

  const removeTierRow = (rowId: number) => {
    onUpdate({
      ...campaign,
      rateByDayRange: campaign.rateByDayRange.filter((row) => row.id !== rowId),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-6 py-5">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{campaign.name}</h2>
            <span className="text-sm text-slate-500">Code {campaign.code}</span>
            <span className="text-sm text-slate-500">{campaign.freeDays} free days</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {campaign.campaignConditions.length} quota row
            {campaign.campaignConditions.length === 1 ? '' : 's'} ·{' '}
            {campaign.rateByDayRange.length} rate tier
            {campaign.rateByDayRange.length === 1 ? '' : 's'} ·{' '}
            {campaign.units.toLocaleString()} units
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${campaign.name} from import`}
          title="Remove from import"
          className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X className="h-5 w-5" />
        </button>
      </CardHeader>

      <CardContent className="space-y-6 px-6 pb-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Campaign quota</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Campaign</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Range</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Model (Sub)</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">DD Start</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">DD End</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Units</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {campaign.campaignConditions.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-slate-700">{row.campaign}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={row.range}
                        onChange={(e) => updateConditionField(row.id, 'range', e.target.value)}
                        className={inputCellClass}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={row.model}
                        onChange={(e) => updateConditionField(row.id, 'model', e.target.value)}
                        className={inputCellClass}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <DatePicker
                        value={toISODate(row.ddStart)}
                        onChange={(value) =>
                          updateConditionField(row.id, 'ddStart', value ? fromISODate(value) : '')
                        }
                        className="h-8 w-36 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <DatePicker
                        value={toISODate(row.ddEnd)}
                        onChange={(value) =>
                          updateConditionField(row.id, 'ddEnd', value ? fromISODate(value) : '')
                        }
                        className="h-8 w-36 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={row.units ?? 0}
                        onChange={(e) =>
                          updateConditionField(row.id, 'units', Number(e.target.value) || 0)
                        }
                        className={`${inputCellClass} text-right`}
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeConditionRow(row.id)}
                        aria-label="Remove quota row"
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-red-200 text-red-500 transition-colors hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {campaign.campaignConditions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                      No quota rows left
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Rate by day range</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Range</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Start Day</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">End Day</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Rate %</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Eff Start</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Eff End</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Delivery Date</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {campaign.rateByDayRange.map((tier) => (
                  <tr key={tier.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <Input
                        value={tier.range}
                        onChange={(e) => updateTierField(tier.id, 'range', e.target.value)}
                        className={inputCellClass}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={tier.startDay}
                        onChange={(e) =>
                          updateTierField(tier.id, 'startDay', Number(e.target.value) || 0)
                        }
                        className={`${inputCellClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={tier.endDay}
                        onChange={(e) =>
                          updateTierField(tier.id, 'endDay', Number(e.target.value) || 0)
                        }
                        className={`${inputCellClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        step="0.001"
                        value={tier.rate}
                        onChange={(e) =>
                          updateTierField(tier.id, 'rate', Number(e.target.value) || 0)
                        }
                        className={`${inputCellClass} text-right`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <DatePicker
                        value={toISODate(tier.effectiveStart)}
                        onChange={(value) =>
                          updateTierField(tier.id, 'effectiveStart', value ? fromISODate(value) : '')
                        }
                        className="h-8 w-36 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <DatePicker
                        value={toISODate(tier.effectiveEnd)}
                        onChange={(value) =>
                          updateTierField(tier.id, 'effectiveEnd', value ? fromISODate(value) : '')
                        }
                        className="h-8 w-36 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Checkbox
                        checked={tier.deliveryDate}
                        onCheckedChange={(checked) =>
                          updateTierField(tier.id, 'deliveryDate', checked === true)
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeTierRow(tier.id)}
                        aria-label="Remove rate tier"
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-red-200 text-red-500 transition-colors hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {campaign.rateByDayRange.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                      No rate tiers left
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewCampaignsPage;
