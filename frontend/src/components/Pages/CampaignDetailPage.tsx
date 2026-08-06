import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { cn } from '../../lib/utils';

export const CampaignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'campaign';

  // Mock data - replace with API call later
  const campaignData = {
    id: 'SG-001',
    name: 'Songkran EV Drawdown',
    code: '24001',
    quotaRows: 3,
    rateTiers: 2,
    units: 2956,
    freeDays: 15,
    campaignConditions: [
      {
        id: 1,
        campaign: '24001',
        range: 'A',
        model: 'SEALION6',
        ddStart: '25-04-26',
        ddEnd: '31-05-26',
        affectedDealers: 'All dealers',
      },
      {
        id: 2,
        campaign: '24001',
        range: 'A',
        model: 'DOLPHIN',
        ddStart: '25-04-26',
        ddEnd: '31-05-26',
        affectedDealers: 'All dealers',
      },
      {
        id: 3,
        campaign: '24001',
        range: 'A',
        model: 'ATTO3',
        ddStart: '25-04-26',
        ddEnd: '31-05-26',
        affectedDealers: 'All dealers',
      },
    ],
    rateByDayRange: [
      {
        id: 1,
        range: 'A',
        startDay: 1,
        endDay: 90,
        rate: 6.625,
        plus: '-',
        effectiveStart: '01-01-25',
        effectiveEnd: '31-03-25',
        active: true,
        deliveryDate: true,
      },
      {
        id: 2,
        range: 'B',
        startDay: 91,
        endDay: 120,
        rate: 15.000,
        plus: '-',
        effectiveStart: '02-04-25',
        effectiveEnd: '30-04-25',
        active: true,
        deliveryDate: true,
      },
    ],
  };

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    navigate(`/?tab=${tab}`);
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleEdit = () => {
    navigate(`/edit-campaign/${campaignId}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-primary-100 bg-[#E0ECFB]">
        <div className="flex items-center justify-center px-4 py-4">
          <nav
            className="inline-flex items-center rounded-full bg-white/50 p-1"
            aria-label="Main"
          >
            <button
              type="button"
              onClick={() => handleTabChange('campaign')}
              className={cn(
                'cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all',
                activeTab === 'campaign'
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Campaign Management
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('upload')}
              className={cn(
                'cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all',
                activeTab === 'upload'
                  ? 'bg-primary-50 text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Upload & Calculate
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="w-full bg-white py-10">
          <div className="mx-auto max-w-5xl px-6 sm:px-10">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBack}
                  className="cursor-pointer text-slate-600 hover:text-slate-900"
                >
                  ← All campaigns
                </button>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    {campaignData.name}
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Code {campaignData.code} · {campaignData.quotaRows} quota rows ·{' '}
                    {campaignData.rateTiers} rate tiers · {campaignData.units.toLocaleString()} units
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleBack}>
                  Duplicate
                </Button>
                <Button variant="default" onClick={handleEdit}>
                  Edit
                </Button>
              </div>
            </div>

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
                      {campaignData.campaignConditions.length} rows
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
                      {campaignData.campaignConditions.map((condition, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="px-4 py-3 text-slate-900">{condition.campaign}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.range}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.model}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.ddStart}</td>
                          <td className="px-4 py-3 text-slate-900">{condition.ddEnd}</td>
                          <td className="px-4 py-3 text-slate-900">
                            <select className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700">
                              <option>{condition.affectedDealers}</option>
                            </select>
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
                              <input
                                type="checkbox"
                                checked={tier.active}
                                readOnly
                                className="h-5 w-5 rounded border-slate-300 bg-primary-700 text-primary-700"
                              />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            {tier.deliveryDate ? (
                              <input
                                type="checkbox"
                                checked={tier.deliveryDate}
                                readOnly
                                className="h-5 w-5 rounded border-slate-300 bg-primary-700 text-primary-700"
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
          </div>
        </div>
      </main>
    </div>
  );
};

export default CampaignDetailPage;
