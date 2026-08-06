import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CampaignManagementPage from './components/Pages/CampaignManagementPage';
import UploadCalculatePage from './components/Pages/UploadCalculatePage';
import PreviewARPage from './components/Pages/PreviewARPage';
import { cn } from './lib/utils';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'campaign' | 'upload'>('upload');

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-white">
        <header className="sticky top-0 z-50 border-b border-primary-100 bg-[#E0ECFB]">
          <div className="flex items-center justify-center px-4 py-4">
            <nav
              className="inline-flex items-center rounded-full bg-white/50 p-1"
              aria-label="Main"
            >
              <button
                type="button"
                onClick={() => setActiveTab('campaign')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-all',
                  activeTab === 'campaign'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Campaign Management
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-all',
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
          {activeTab === 'campaign' && <CampaignManagementPage />}
          {activeTab === 'upload' && <UploadCalculatePage />}
          <Routes>
            <Route path="/preview-ar" element={<PreviewARPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
