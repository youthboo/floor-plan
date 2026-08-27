import React, { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { DatePicker } from '../ui/DatePicker';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';
import SelectDealersModal, { DEALERS } from '../Shared/SelectDealersModal';
import { getMockCampaign, toISODate } from '../../data/mockCampaigns';
import { cn } from '../../lib/utils';

const AFFECTED_DEALERS_OPTIONS = ['All dealers', 'Selected dealers'];

interface ConditionRow {
  id: number;
  campaign: string;
  range: string;
  model: string;
  ddStart: string;
  ddEnd: string;
  affectedDealers: string;
  selectedDealers: string[];
  exception: string;
}

interface RateTierRow {
  id: number;
  range: string;
  startDay: string;
  endDay: string;
  rate: string;
  plus: string;
  effectiveStart: string;
  effectiveEnd: string;
  active: boolean;
  deliveryDate: boolean;
}

function createConditionRow(id: number): ConditionRow {
  return {
    id,
    campaign: '',
    range: '',
    model: '',
    ddStart: '',
    ddEnd: '',
    affectedDealers: 'All dealers',
    selectedDealers: [],
    exception: '',
  };
}

function createRateTierRow(id: number): RateTierRow {
  return {
    id,
    range: '',
    startDay: '',
    endDay: '',
    rate: '',
    plus: '',
    effectiveStart: '',
    effectiveEnd: '',
    active: true,
    deliveryDate: false,
  };
}

export const NewCampaignPage: React.FC = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const isEditMode = Boolean(campaignId);
  const existingCampaign = isEditMode ? getMockCampaign(campaignId) : undefined;

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'campaign';
  const [campaignName, setCampaignName] = useState(existingCampaign?.name ?? '');
  const [freeDays, setFreeDays] = useState(String(existingCampaign?.freeDays ?? 15));

  const nextConditionId = useRef((existingCampaign?.campaignConditions.length ?? 0) + 1);
  const [conditions, setConditions] = useState<ConditionRow[]>(() =>
    existingCampaign
      ? existingCampaign.campaignConditions.map((row) => ({
          id: row.id,
          campaign: row.campaign,
          range: row.range,
          model: row.model,
          ddStart: toISODate(row.ddStart),
          ddEnd: toISODate(row.ddEnd),
          affectedDealers: row.affectedDealers,
          selectedDealers: row.selectedDealers ?? [],
          exception: row.exception ?? '',
        }))
      : [createConditionRow(1)]
  );
  const [dealerModalRowId, setDealerModalRowId] = useState<number | null>(null);

  const nextTierId = useRef((existingCampaign?.rateByDayRange.length ?? 0) + 1);
  const [rateTiers, setRateTiers] = useState<RateTierRow[]>(() =>
    existingCampaign
      ? existingCampaign.rateByDayRange.map((row) => ({
          id: row.id,
          range: row.range,
          startDay: String(row.startDay),
          endDay: String(row.endDay),
          rate: String(row.rate),
          plus: row.plus === '-' ? '' : row.plus,
          effectiveStart: toISODate(row.effectiveStart),
          effectiveEnd: toISODate(row.effectiveEnd),
          active: row.active,
          deliveryDate: row.deliveryDate,
        }))
      : [createRateTierRow(1)]
  );

  const addConditionRow = () => {
    setConditions((prev) => [...prev, createConditionRow(nextConditionId.current++)]);
  };

  const updateConditionRow = <K extends keyof ConditionRow>(
    id: number,
    field: K,
    value: ConditionRow[K]
  ) => {
    setConditions((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeConditionRow = (id: number) => {
    setConditions((prev) => prev.filter((row) => row.id !== id));
  };

  const handleAffectedDealersChange = (rowId: number, value: string) => {
    updateConditionRow(rowId, 'affectedDealers', value);
    if (value === 'Selected dealers') {
      setDealerModalRowId(rowId);
    }
  };

  const dealerModalRow = conditions.find((row) => row.id === dealerModalRowId) ?? null;

  const addRateTierRow = () => {
    setRateTiers((prev) => [...prev, createRateTierRow(nextTierId.current++)]);
  };

  const updateRateTierRow = <K extends keyof RateTierRow>(
    id: number,
    field: K,
    value: RateTierRow[K]
  ) => {
    setRateTiers((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removeRateTierRow = (id: number) => {
    setRateTiers((prev) => prev.filter((row) => row.id !== id));
  };

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    navigate(`/?tab=${tab}`);
  };

  const handleCancel = () => {
    navigate('/?tab=campaign');
  };

  const handleSave = () => {
    // TODO: Call API to save campaign
    console.log(isEditMode ? 'Updating campaign:' : 'Saving campaign:', {
      campaignName,
      freeDays,
      conditions,
      rateTiers,
    });
    navigate('/?tab=campaign');
  };

  const handleSaveDraft = () => {
    // TODO: Call API to save campaign as a draft
    console.log('Saving campaign as draft:', {
      campaignName,
      freeDays,
      conditions,
      rateTiers,
    });
    navigate('/?tab=campaign');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-primary-100 bg-[#E0ECFB]">
        <div className="flex items-center justify-center px-4 py-4">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
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
            {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All campaigns
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {isEditMode ? `Edit Campaign · ${existingCampaign?.name ?? campaignId}` : 'New Campaign'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {isEditMode
                  ? 'Update quota allocation and rate tiers, then Save'
                  : 'New campaign · fill in quota allocation and rate tiers, then Save'}
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-3">
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="border-amber-400 bg-amber-50 text-amber-700 hover:border-amber-500 hover:bg-amber-100"
                onClick={handleSaveDraft}
              >
                Save as draft
              </Button>
              <Button variant="default" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Campaign Name Section */}
        <Card className="mb-6">
          <CardHeader className="px-6 py-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Subvention Campaign Section */}
        <Card className="mb-6">
          <CardHeader className="px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Subvention Campaign</h2>
            <p className="mt-1 text-sm text-slate-600">
              Subvention rate applied to this campaign
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="free-days">Number of Free Days</Label>
              <Input
                id="free-days"
                type="number"
                value={freeDays}
                onChange={(e) => setFreeDays(e.target.value)}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Campaign Condition Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Campaign condition</h2>
              <p className="mt-1 text-sm text-slate-600">
                Approved unit quota per model and dealer scope
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={addConditionRow}>
              + Add row
            </Button>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">CAMPAIGN</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">RANGE</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">MODEL (SUB)</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">DD START</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">DD END</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">AFFECTED DEALERS</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">EXCEPTION</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {conditions.length === 0 ? (
                    <tr className="border-b border-slate-200">
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No rows added
                      </td>
                    </tr>
                  ) : (
                    conditions.map((row) => (
                      <tr key={row.id} className="border-b border-slate-200">
                        <td className="px-4 py-2">
                          <Input
                            value={row.campaign}
                            onChange={(e) => updateConditionRow(row.id, 'campaign', e.target.value)}
                            className="h-9 w-24"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.range}
                            onChange={(e) => updateConditionRow(row.id, 'range', e.target.value)}
                            className="h-9 w-16"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.model}
                            onChange={(e) => updateConditionRow(row.id, 'model', e.target.value)}
                            placeholder="Model"
                            className="h-9 w-32"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <DatePicker
                            value={row.ddStart}
                            onChange={(value) => updateConditionRow(row.id, 'ddStart', value)}
                            className="w-36"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <DatePicker
                            value={row.ddEnd}
                            onChange={(value) => updateConditionRow(row.id, 'ddEnd', value)}
                            className="w-36"
                          />
                        </td>
                        <td className="px-4 py-2">
                          {row.affectedDealers === 'Selected dealers' ? (
                            <button
                              type="button"
                              onClick={() => setDealerModalRowId(row.id)}
                              className={cn(
                                'block w-64 cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed transition-colors hover:border-slate-300 hover:bg-slate-50',
                                row.selectedDealers.length > 0 ? 'text-slate-700' : 'text-slate-400'
                              )}
                            >
                              {row.selectedDealers.length > 0
                                ? row.selectedDealers.join(', ')
                                : 'No dealers selected — click to add'}
                            </button>
                          ) : (
                            <Select
                              value={row.affectedDealers}
                              onValueChange={(value) => handleAffectedDealersChange(row.id, value)}
                            >
                              <SelectTrigger className="h-9 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AFFECTED_DEALERS_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.exception}
                            onChange={(e) => updateConditionRow(row.id, 'exception', e.target.value)}
                            placeholder="No exceptions — click to add"
                            className="h-9 min-w-[220px]"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeConditionRow(row.id)}
                            aria-label="Remove row"
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-red-200 text-red-500 transition-colors hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Rate by Day Range Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Rate by Day Range</h2>
              <p className="mt-1 text-sm text-slate-600">
                Rate by aging range (days on floorplan), with effective periods
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={addRateTierRow}>
              + Add tier
            </Button>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">RANGE</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">START DAY</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">END DAY</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">RATE %</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">PLUS</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">EFFECTIVE START</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">EFFECTIVE END</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">ACTIVE</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">DELIVERY DATE</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rateTiers.length === 0 ? (
                    <tr className="border-b border-slate-200">
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        No tiers added
                      </td>
                    </tr>
                  ) : (
                    rateTiers.map((row) => (
                      <tr key={row.id} className="border-b border-slate-200">
                        <td className="px-4 py-2">
                          <Input
                            value={row.range}
                            onChange={(e) => updateRateTierRow(row.id, 'range', e.target.value)}
                            className="h-9 w-16"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            value={row.startDay}
                            onChange={(e) => updateRateTierRow(row.id, 'startDay', e.target.value)}
                            className="h-9 w-20"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            value={row.endDay}
                            onChange={(e) => updateRateTierRow(row.id, 'endDay', e.target.value)}
                            className="h-9 w-20"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            step="0.001"
                            value={row.rate}
                            onChange={(e) => updateRateTierRow(row.id, 'rate', e.target.value)}
                            className="h-9 w-24"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={row.plus}
                            onChange={(e) => updateRateTierRow(row.id, 'plus', e.target.value)}
                            placeholder="-"
                            className="h-9 w-16"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <DatePicker
                            value={row.effectiveStart}
                            onChange={(value) =>
                              updateRateTierRow(row.id, 'effectiveStart', value)
                            }
                            className="w-36"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <DatePicker
                            value={row.effectiveEnd}
                            onChange={(value) =>
                              updateRateTierRow(row.id, 'effectiveEnd', value)
                            }
                            className="w-36"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Checkbox
                            checked={row.active}
                            onCheckedChange={(checked) =>
                              updateRateTierRow(row.id, 'active', checked === true)
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Checkbox
                            checked={row.deliveryDate}
                            onCheckedChange={(checked) =>
                              updateRateTierRow(row.id, 'deliveryDate', checked === true)
                            }
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeRateTierRow(row.id)}
                            aria-label="Remove tier"
                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border border-red-200 text-red-500 transition-colors hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </main>

      <SelectDealersModal
        isOpen={dealerModalRowId !== null}
        onClose={() => setDealerModalRowId(null)}
        selectedDealers={dealerModalRow?.selectedDealers ?? []}
        onConfirm={(dealers) => {
          if (dealerModalRowId === null) return;
          if (dealers.length === DEALERS.length) {
            updateConditionRow(dealerModalRowId, 'affectedDealers', 'All dealers');
            updateConditionRow(dealerModalRowId, 'selectedDealers', []);
          } else {
            updateConditionRow(dealerModalRowId, 'selectedDealers', dealers);
          }
        }}
      />
    </div>
  );
};

export default NewCampaignPage;
