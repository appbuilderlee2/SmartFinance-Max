import React from 'react';
import BottomNavigation from './BottomNavigation';

interface LayoutProps { children: React.ReactNode; hideNav?: boolean; }
const Layout: React.FC<LayoutProps> = ({ children, hideNav }) => (
  <div className="min-h-screen bg-background text-white flex flex-col relative">
    <div className={`flex-1 overflow-y-auto scrollbar-hide ${hideNav ? '' : 'pb-24'}`}>{children}</div>
    {!hideNav && <BottomNavigation />}
  </div>
);
export default Layout;
