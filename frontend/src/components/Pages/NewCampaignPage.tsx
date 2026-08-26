import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';

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
                New Campaign
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                New campaign · fill in quota allocation and rate tiers, then Save
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-3">
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
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
