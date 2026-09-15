import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, useSearchParams } from 'react-router-dom';
import CampaignManagementPage from './components/Pages/CampaignManagementPage';
import UploadCalculatePage from './components/Pages/UploadCalculatePage';
import NewCampaignPage from './components/Pages/NewCampaignPage';
import CampaignDetailPage from './components/Pages/CampaignDetailPage';
import ReviewCampaignsPage from './components/Pages/ReviewCampaignsPage';
import { Tabs, TabsContent } from './components/ui/Tabs';
import AppTabsHeader from './components/Shared/AppTabsHeader';

const AppContent: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'campaign' ? 'campaign' : 'upload';
  const isFullPageRoute =
    ['/new-campaign', '/review-campaigns'].includes(location.pathname) ||
    location.pathname.startsWith('/campaign-detail/') ||
    location.pathname.startsWith('/edit-campaign/');

  if (isFullPageRoute) {
    return (
      <Routes>
        <Route path="/new-campaign" element={<NewCampaignPage />} />
        <Route path="/campaign-detail/:campaignId" element={<CampaignDetailPage />} />
        <Route path="/edit-campaign/:campaignId" element={<NewCampaignPage />} />
        <Route path="/review-campaigns" element={<ReviewCampaignsPage />} />
      </Routes>
    );
  }

  return (
    <>
      <AppTabsHeader
        activeTab={activeTab}
        onTabChange={(value) => setSearchParams({ tab: value })}
      />
      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <main className="flex-1">
          <TabsContent value="campaign">
            <CampaignManagementPage />
          </TabsContent>
          <TabsContent value="upload">
            <UploadCalculatePage />
          </TabsContent>
        </main>
      </Tabs>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-white">
        <AppContent />
      </div>
    </BrowserRouter>
  );
};

export default App;
