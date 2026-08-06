import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { cn } from '../../lib/utils';

export const NewCampaignPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'campaign';
  const [campaignName, setCampaignName] = useState('');
  const [freeDays, setFreeDays] = useState('15');

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    navigate(`/?tab=${tab}`);
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleSave = () => {
    // TODO: Call API to save campaign
    console.log('Saving campaign:', { campaignName, freeDays });
    navigate('/campaign-management');
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
              onClick={handleCancel}
              className="cursor-pointer text-slate-600 hover:text-slate-900"
            >
              ← All campaigns
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              New Campaign
            </h1>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>

        <p className="mb-8 text-sm text-slate-600">
          New campaign · fill in quota allocation and rate tiers, then Save
        </p>

        {/* Campaign Name Section */}
        <Card className="mb-6">
          <CardHeader className="px-6 py-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-900">Campaign Name</span>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
                className="mt-2 block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-500 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
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
            <div>
              <label className="block">
                <span className="text-sm font-medium text-slate-900">
                  Number of Free Days
                </span>
                <input
                  type="number"
                  value={freeDays}
                  onChange={(e) => setFreeDays(e.target.value)}
                  className="mt-2 block w-32 rounded-lg border border-slate-300 px-4 py-3 text-slate-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </label>
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
            <Button variant="secondary" size="sm">
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
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No rows added
                    </td>
                  </tr>
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
            <Button variant="secondary" size="sm">
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
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No tiers added
                    </td>
                  </tr>
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

export default NewCampaignPage;
