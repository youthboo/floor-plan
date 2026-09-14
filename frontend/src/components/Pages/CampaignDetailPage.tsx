import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import { campaignService } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import type { CampaignDetail } from '../../types';

const AFFECTED_DEALERS_OPTIONS = ['All dealers', 'Selected dealers'];

export const CampaignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'campaign';

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    campaignService
      .get(campaignId)
      .then((data) => {
        if (!cancelled) setCampaign(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err, 'Failed to load campaign'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const campaignData = {
    name: campaign?.name ?? 'Untitled campaign',
    code: campaign?.code ?? campaignId ?? '',
    units: campaign?.units ?? 0,
    freeDays: campaign?.freeDays ?? 0,
    campaignConditions: campaign?.campaignConditions ?? [],
    rateByDayRange: campaign?.rateByDayRange ?? [],
  };

  // Read-only detail view — editing happens on the separate /edit-campaign route.
  const conditions = campaignData.campaignConditions;

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    navigate(`/?tab=${tab}`);
  };

  const handleBack = () => {
    navigate('/?tab=campaign');
  };

  const handleEdit = () => {
    navigate(`/edit-campaign/${campaignId}`);
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
                onClick={handleBack}
                className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                All campaigns
              </button>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {campaignData.name}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Code {campaignData.code} · {conditions.length} quota rows ·{' '}
                    {campaignData.rateByDayRange.length} rate tiers ·{' '}
                    {campaignData.units.toLocaleString()} units
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-3">
                  <Button variant="secondary" onClick={handleBack}>
                    Duplicate
                  </Button>
                  <Button variant="default" onClick={handleEdit}>
                    Edit
                  </Button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="py-10">
                <LoadingSpinner />
              </div>
            ) : loadError ? (
              <ErrorAlert message={loadError} />
            ) : !campaign ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">
                Campaign not found.
              </div>
            ) : (
              <>
            {/* Subvention Campaign Section */}
            <Card className="mb-6">
              <CardHeader className="px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">Subvention Campaign</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Subvention rate applied to this campaign
                </p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-900">
                      Number of Free Days
                    </span>
                    <div className="mt-2 text-sm text-slate-700">{campaignData.freeDays}</div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Condition Section */}
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Campaign condition{' '}
                    <span className="text-sm font-normal text-slate-600">
                      {conditions.length} rows
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Approved unit quota per model and dealer scope
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          CAMPAIGN
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">RANGE</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          MODEL (SUB)
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          DD START
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">DD END</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          AFFECTED DEALERS
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          EXCEPTION
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conditions.map((condition, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="px-4 py-3 text-slate-900">{condition.campaign}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.range}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.model}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.ddStart}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.ddEnd}</td>
                          <td className="px-4 py-3 text-slate-900">
                            <Select value={condition.affectedDealers} disabled>
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
                          </td>
                          <td className="px-4 py-3 text-slate-600">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Rate by Day Range Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Rate by Day Range{' '}
                    <span className="text-sm font-normal text-slate-600">
                      {campaignData.rateByDayRange.length} tiers
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Rate by aging range (days on floorplan), with effective periods
                  </p>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">RANGE</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          START DAY
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          END DAY
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">RATE %</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">PLUS</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          EFFECTIVE START
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          EFFECTIVE END
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">ACTIVE</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-700">
                          DELIVERY DATE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignData.rateByDayRange.map((tier, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="px-4 py-3 text-slate-900">{tier.range}</td>
                          <td className="px-4 py-3 text-slate-900">{tier.startDay}</td>
                          <td className="px-4 py-3 text-slate-900">{tier.endDay}</td>
                          <td className="px-4 py-3 text-slate-900">{tier.rate.toFixed(3)}</td>
                          <td className="px-4 py-3 text-slate-600">{tier.plus}</td>
                          <td className="px-4 py-3 text-slate-900">{tier.effectiveStart}</td>
                          <td className="px-4 py-3 text-slate-900">{tier.effectiveEnd}</td>
                          <td className="px-4 py-3 text-slate-900">
                            {tier.active ? (
                              <Checkbox
                                checked={tier.active}
                                disabled
                                className="h-5 w-5 cursor-default disabled:opacity-100"
                              />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            {tier.deliveryDate ? (
                              <Checkbox
                                checked={tier.deliveryDate}
                                disabled
                                className="h-5 w-5 cursor-default disabled:opacity-100"
                              />
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CampaignDetailPage;
