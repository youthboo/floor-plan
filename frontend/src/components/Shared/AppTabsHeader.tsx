import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';

interface AppTabsHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/** Sticky top nav shared by the tab view and every full-page route. */
export const AppTabsHeader: React.FC<AppTabsHeaderProps> = ({ activeTab, onTabChange }) => (
  <header className="sticky top-0 z-50 border-b border-primary-100 bg-[#E0ECFB]">
    <div className="flex items-center justify-center px-4 py-4">
      <Tabs value={activeTab} onValueChange={onTabChange}>
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
);

export default AppTabsHeader;
