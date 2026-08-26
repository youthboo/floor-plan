import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import CampaignManagementPage from './components/Pages/CampaignManagementPage';
import UploadCalculatePage from './components/Pages/UploadCalculatePage';
import PreviewARPage from './components/Pages/PreviewARPage';
import NewCampaignPage from './components/Pages/NewCampaignPage';
import CampaignDetailPage from './components/Pages/CampaignDetailPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/Tabs';

const AppContent: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'campaign' | 'upload'>('upload');
  const isFullPageRoute =
    ['/new-campaign', '/preview-ar'].includes(location.pathname) ||
    location.pathname.startsWith('/campaign-detail/') ||
    location.pathname.startsWith('/edit-campaign/');

  if (isFullPageRoute) {
    return (
      <Routes>
        <Route path="/new-campaign" element={<NewCampaignPage />} />
        <Route path="/preview-ar" element={<PreviewARPage />} />
        <Route path="/campaign-detail/:campaignId" element={<CampaignDetailPage />} />
        <Route path="/edit-campaign/:campaignId" element={<NewCampaignPage />} />
      </Routes>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'campaign' | 'upload')}>
      <header className="sticky top-0 z-50 border-b border-primary-100 bg-[#E0ECFB]">
        <div className="flex items-center justify-center px-4 py-4">
          <TabsList className="rounded-full bg-white/50 p-1" aria-label="Main">
            <TabsTrigger variant="nav" value="campaign">
              Campaign Management
            </TabsTrigger>
            <TabsTrigger variant="nav" value="upload">
              Upload & Calculate
            </TabsTrigger>
          </TabsList>
        </div>
      </header>

      <main className="flex-1">
        <TabsContent value="campaign">
          <CampaignManagementPage />
        </TabsContent>
        <TabsContent value="upload">
          <UploadCalculatePage />
        </TabsContent>
      </main>
    </Tabs>
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
