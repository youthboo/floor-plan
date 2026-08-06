import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import AddCampaignsModal from '../Shared/AddCampaignsModal';
import UploadCampaignModal from '../Shared/UploadCampaignModal';

interface Campaign {
  code: string;
  name: string;
  models: string;
  drawdownPeriod: string;
  status: 'Active' | 'Default';
}

const mockCampaigns: Campaign[] = [
  {
    code: '0001',
    name: 'Default',
    models: '—',
    drawdownPeriod: '—',
    status: 'Default',
  },
  {
    code: '24001',
    name: 'Songkran EV Drawdown',
    models: 'SEALION6, DOLPHIN, ATTO3',
    drawdownPeriod: '25-04-26 → 31-05-26',
    status: 'Active',
  },
  {
    code: '24002',
    name: 'Dealer Group Incentive',
    models: 'SEALION6, DOLPHIN, SEAL5',
    drawdownPeriod: '25-04-26 → 31-05-26',
    status: 'Active',
  },
  {
    code: '24003',
    name: 'Extended Floorplan 120',
    models: 'SEALION6, DOLPHIN',
    drawdownPeriod: '15-02-26 → 31-03-26',
    status: 'Active',
  },
  {
    code: '24004',
    name: 'New Campaign',
    models: 'SEALION6, DOLPHIN, SEAL5',
    drawdownPeriod: '25-04-26 → 31-05-26',
    status: 'Active',
  },
];

export const CampaignManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns] = useState<Campaign[]>(mockCampaigns);
  const [isAddCampaignsModalOpen, setIsAddCampaignsModalOpen] = useState(false);
  const [isUploadCampaignModalOpen, setIsUploadCampaignModalOpen] = useState(false);
  const activeCampaigns = campaigns.filter((c) => c.status === 'Active').length;

  const handleAddCampaignClick = () => {
    setIsAddCampaignsModalOpen(true);
  };

  const handleUploadFile = () => {
    setIsAddCampaignsModalOpen(false);
    setIsUploadCampaignModalOpen(true);
  };

  const handleAddManually = () => {
    setIsAddCampaignsModalOpen(false);
    navigate('/new-campaign');
  };

  const handleUploadCampaign = (file: File) => {
    setIsUploadCampaignModalOpen(false);
    // TODO: Call API to upload file
  };

  return (
    <div className="w-full bg-white py-10">
      <div className="mx-auto max-w-5xl px-6 sm:px-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Campaign Management
          </h1>
          <p className="text-sm text-slate-500">
            Standard interest configuration and active campaign tables
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 px-6 py-5">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Campaigns</h2>
                <Badge variant="outline" className="border-orange-600 text-orange-600">
                  {activeCampaigns} active
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                Select a campaign to view its rate and quota detail, or add a new one
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-3">
              <Button variant="default" size="sm" onClick={handleAddCampaignClick}>
                + Add campaign
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/manage-campaigns')}>
                Manage
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign Code</TableHead>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead>Drawdown Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.code}>
                    <TableCell className="font-bold text-slate-900">{campaign.code}</TableCell>
                    <TableCell className="font-semibold text-slate-900">{campaign.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{campaign.models}</TableCell>
                    <TableCell className="text-sm text-slate-600">{campaign.drawdownPeriod}</TableCell>
                    <TableCell>
                      <Badge variant={campaign.status === 'Active' ? 'active' : 'inactive'}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/campaign-detail/${campaign.code}`)}
                        className="cursor-pointer text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
                      >
                        View →
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AddCampaignsModal
          isOpen={isAddCampaignsModalOpen}
          onClose={() => setIsAddCampaignsModalOpen(false)}
          onUploadFile={handleUploadFile}
          onAddManually={handleAddManually}
        />

        <UploadCampaignModal
          isOpen={isUploadCampaignModalOpen}
          onClose={() => setIsUploadCampaignModalOpen(false)}
          onUpload={handleUploadCampaign}
        />
      </div>
    </div>
  );
};

export default CampaignManagementPage;
