import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import AppTabsHeader from '../Shared/AppTabsHeader';
import BackLink from '../Shared/BackLink';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import { campaignService } from '../../services/api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatNumber } from '../../utils/formatters';

const AFFECTED_DEALERS_OPTIONS = ['All dealers', 'Selected dealers'];

export const CampaignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'campaign';

  const {
    data: campaign,
    isLoading,
    error: loadError,
  } = useAsyncData(() => campaignService.get(campaignId!), [campaignId], {
    enabled: Boolean(campaignId),
    errorMessage: 'Failed to load campaign',
  });

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
      <AppTabsHeader activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1">
        <div className="w-full bg-white py-10">
          <div className="mx-auto max-w-7xl px-6 sm:px-10">
            {/* Header */}
            <div className="mb-8">
              <BackLink onClick={handleBack} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {campaignData.name}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Code {campaignData.code} · {conditions.length} quota rows ·{' '}
                    {campaignData.rateByDayRange.length} rate tiers ·{' '}
                    {formatNumber(campaignData.units, 0)} units
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
                <Table containerClassName="border-0 rounded-none bg-transparent">
                  <TableHeader className="border-slate-200 bg-slate-50">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead variant="plain">CAMPAIGN</TableHead>
                      <TableHead variant="plain">RANGE</TableHead>
                      <TableHead variant="plain">MODEL (SUB)</TableHead>
                      <TableHead variant="plain">DD START</TableHead>
                      <TableHead variant="plain">DD END</TableHead>
                      <TableHead variant="plain">AFFECTED DEALERS</TableHead>
                      <TableHead variant="plain">EXCEPTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conditions.map((condition, idx) => (
                      <TableRow key={idx} className="border-slate-200 hover:bg-transparent">
                        <TableCell className="px-4 py-3 text-slate-900">{condition.campaign}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{condition.range}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{condition.model}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{condition.ddStart}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{condition.ddEnd}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">
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
                        </TableCell>
                        <TableCell className="px-4 py-3 text-slate-600">-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Table containerClassName="border-0 rounded-none bg-transparent">
                  <TableHeader className="border-slate-200 bg-slate-50">
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead variant="plain">RANGE</TableHead>
                      <TableHead variant="plain">START DAY</TableHead>
                      <TableHead variant="plain">END DAY</TableHead>
                      <TableHead variant="plain">RATE %</TableHead>
                      <TableHead variant="plain">PLUS</TableHead>
                      <TableHead variant="plain">EFFECTIVE START</TableHead>
                      <TableHead variant="plain">EFFECTIVE END</TableHead>
                      <TableHead variant="plain">ACTIVE</TableHead>
                      <TableHead variant="plain">DELIVERY DATE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignData.rateByDayRange.map((tier, idx) => (
                      <TableRow key={idx} className="border-slate-200 hover:bg-transparent">
                        <TableCell className="px-4 py-3 text-slate-900">{tier.range}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{tier.startDay}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{tier.endDay}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{tier.rate.toFixed(3)}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-600">{tier.plus}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{tier.effectiveStart}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">{tier.effectiveEnd}</TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">
                          {tier.active ? (
                            <Checkbox
                              checked={tier.active}
                              disabled
                              className="h-5 w-5 cursor-default disabled:opacity-100"
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-slate-900">
                          {tier.deliveryDate ? (
                            <Checkbox
                              checked={tier.deliveryDate}
                              disabled
                              className="h-5 w-5 cursor-default disabled:opacity-100"
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
