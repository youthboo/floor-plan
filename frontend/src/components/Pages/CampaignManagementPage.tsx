import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';
import AddCampaignsModal from '../Shared/AddCampaignsModal';
import UploadCampaignModal from '../Shared/UploadCampaignModal';
import ConfirmDialog from '../Shared/ConfirmDialog';
import LoadingSpinner from '../Shared/LoadingSpinner';
import ErrorAlert from '../Shared/ErrorAlert';
import { cn } from '../../lib/utils';
import { campaignService } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { useAsyncData } from '../../hooks/useAsyncData';
import { duplicateCampaignName, nextAvailableCampaignCode } from '../../utils/campaignDuplicate';

type StatusFilter = 'all' | 'active' | 'draft';

const PAGE_SIZE = 5;

function statusBadgeVariant(status: string): 'active' | 'inactive' {
  if (status === 'Draft') return 'inactive';
  return 'active';
}

export const CampaignManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    data: campaignsData,
    isLoading,
    error: listLoadError,
    refetch: refetchCampaignList,
  } = useAsyncData(() => campaignService.list(), [], { errorMessage: 'Failed to load campaigns' });
  const campaigns = campaignsData ?? [];
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [isAddCampaignsModalOpen, setIsAddCampaignsModalOpen] = useState(false);
  const [isUploadCampaignModalOpen, setIsUploadCampaignModalOpen] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const [isBulkActionInProgress, setIsBulkActionInProgress] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  // Shares one error slot with the list-load error, matching pre-refactor behavior
  // where both were the same state variable (so a refetch clears either).
  const [importError, setImportError] = useState<string | null>(null);
  const loadError = listLoadError || importError;
  const refetchCampaigns = async () => {
    setImportError(null);
    await refetchCampaignList();
  };

  const activeCampaigns = campaigns.filter((c) => c.status !== 'Draft').length;

  const filteredCampaigns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && campaign.status !== 'Draft') ||
        (statusFilter === 'draft' && campaign.status === 'Draft');

      if (!matchesStatus) return false;
      if (!query) return true;

      return (
        campaign.code.toLowerCase().includes(query) ||
        campaign.name.toLowerCase().includes(query) ||
        campaign.models.toLowerCase().includes(query)
      );
    });
  }, [campaigns, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCampaigns.slice(start, start + PAGE_SIZE);
  }, [filteredCampaigns, currentPage]);

  const pageStart = filteredCampaigns.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredCampaigns.length);

  const allOnPageSelected =
    pagedCampaigns.length > 0 && pagedCampaigns.every((c) => selectedCodes.includes(c.code));

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

  const handleUploadCampaign = async (file: File) => {
    setImportError(null);
    setIsImportingFile(true);
    try {
      const importResult = await campaignService.importFile(file);
      setIsUploadCampaignModalOpen(false);
      navigate('/review-campaigns', { state: { importResult } });
    } catch (err) {
      setImportError(getApiErrorMessage(err, 'Campaign file import failed'));
      setIsUploadCampaignModalOpen(false);
    } finally {
      setIsImportingFile(false);
    }
  };

  const enterManageMode = () => {
    setIsManageMode(true);
    setSelectedCodes([]);
  };

  const exitManageMode = () => {
    setIsManageMode(false);
    setSelectedCodes([]);
    setBulkActionError(null);
  };

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      const pageCodes = new Set(pagedCampaigns.map((c) => c.code));
      setSelectedCodes((prev) => prev.filter((code) => !pageCodes.has(code)));
      return;
    }
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      pagedCampaigns.forEach((c) => next.add(c.code));
      return Array.from(next);
    });
  };

  const toggleSelectOne = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  };

  const handleDuplicate = async () => {
    if (selectedCodes.length === 0) return;
    setBulkActionError(null);
    setIsBulkActionInProgress(true);
    try {
      const takenCodes = new Set(campaigns.map((c) => c.code));
      const details = await Promise.all(selectedCodes.map((code) => campaignService.get(code)));
      const duplicates = details.map((detail) => ({
        ...detail,
        code: nextAvailableCampaignCode(detail.code, takenCodes),
        name: duplicateCampaignName(detail.name),
        campaignConditions: detail.campaignConditions.map((row) => ({ ...row })),
        rateByDayRange: detail.rateByDayRange.map((row) => ({ ...row })),
      }));
      await campaignService.commit(duplicates);
      await refetchCampaigns();
      setSelectedCodes([]);
    } catch (err) {
      setBulkActionError(getApiErrorMessage(err, 'Failed to duplicate campaign(s)'));
    } finally {
      setIsBulkActionInProgress(false);
    }
  };

  const handleDeleteClick = () => {
    if (selectedCodes.length === 0) return;
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setBulkActionError(null);
    setIsBulkActionInProgress(true);
    try {
      for (const code of selectedCodes) {
        await campaignService.remove(code);
      }
      await refetchCampaigns();
      setSelectedCodes([]);
    } catch (err) {
      setBulkActionError(getApiErrorMessage(err, 'Failed to delete campaign(s)'));
      await refetchCampaigns();
    } finally {
      setIsBulkActionInProgress(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'draft', label: 'Draft' },
  ];

  return (
    <div className="w-full bg-white py-10">
      <div className="mx-auto max-w-[90rem] px-6 sm:px-10">
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
                <Badge
                  variant="outline"
                  className="border-orange-200 bg-orange-100 text-orange-700"
                >
                  {activeCampaigns} active
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {isManageMode
                  ? 'Tick campaigns to duplicate or delete in bulk'
                  : 'Select a campaign to view its rate and quota detail, or add a new one'}
              </p>
            </div>

            {isManageMode ? (
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3">
                <span className="text-sm text-slate-500">{selectedCodes.length} selected</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDuplicate()}
                  disabled={selectedCodes.length === 0 || isBulkActionInProgress}
                >
                  {isBulkActionInProgress ? 'Working...' : 'Duplicate'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDeleteClick}
                  disabled={selectedCodes.length === 0 || isBulkActionInProgress}
                >
                  {isBulkActionInProgress ? 'Working...' : 'Delete'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={exitManageMode}
                  disabled={isBulkActionInProgress}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="flex flex-shrink-0 gap-3">
                <Button variant="default" size="sm" onClick={handleAddCampaignClick}>
                  + Add campaign
                </Button>
                <Button variant="secondary" size="sm" onClick={enterManageMode}>
                  Manage
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4 px-6 pb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by code, name or model"
                  className="pl-9"
                />
              </div>

              <Tabs
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  setPage(1);
                }}
                className="self-start sm:self-auto"
              >
                <TabsList>
                  {statusFilters.map((filter) => (
                    <TabsTrigger key={filter.id} variant="segment" value={filter.id}>
                      {filter.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {loadError && <ErrorAlert message={loadError} />}
            {bulkActionError && <ErrorAlert message={bulkActionError} />}

            {isLoading ? (
              <div className="py-10">
                <LoadingSpinner />
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isManageMode && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleSelectAllOnPage}
                        aria-label="Select all campaigns on this page"
                      />
                    </TableHead>
                  )}
                  <TableHead>Campaign Code</TableHead>
                  <TableHead>Campaign Name</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead>Drawdown Period</TableHead>
                  <TableHead>Status</TableHead>
                  {!isManageMode && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isManageMode ? 6 : 6}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      {campaigns.length === 0
                        ? 'No campaigns yet — add one or import a campaign file to get started.'
                        : 'No campaigns match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedCampaigns.map((campaign) => {
                    const selected = selectedCodes.includes(campaign.code);
                    return (
                      <TableRow
                        key={campaign.code}
                        className={cn(selected && 'bg-primary-50/60')}
                      >
                        {isManageMode && (
                          <TableCell>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleSelectOne(campaign.code)}
                              aria-label={`Select campaign ${campaign.code}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-bold text-slate-900">{campaign.code}</TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {campaign.name}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{campaign.models}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {campaign.drawdownPeriod}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(campaign.status)}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        {!isManageMode && (
                          <TableCell className="text-right">
                            <Button
                              variant="link"
                              className="h-auto p-0 text-sm font-semibold"
                              onClick={() => navigate(`/campaign-detail/${campaign.code}`)}
                            >
                              View →
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            )}

            {!isLoading && (
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Showing {pageStart}-{pageEnd} of {filteredCampaigns.length} campaigns
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    className="h-auto px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:pointer-events-none disabled:text-slate-300"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    ← Prev
                  </Button>
                  <span className="text-sm font-semibold text-slate-900">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    className="h-auto px-2 py-1 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:pointer-events-none disabled:text-slate-300"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
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
          isSubmitting={isImportingFile}
        />

        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          title="Delete campaign(s)?"
          message={`This will permanently delete ${selectedCodes.length} campaign${selectedCodes.length === 1 ? '' : 's'}. This cannot be undone.`}
          confirmLabel="Delete"
          isDestructive
          isConfirming={isBulkActionInProgress}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setIsDeleteConfirmOpen(false)}
        />
      </div>
    </div>
  );
};

export default CampaignManagementPage;
