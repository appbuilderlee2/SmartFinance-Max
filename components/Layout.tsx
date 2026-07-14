
import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, Settings, CircleDollarSign, List } from 'lucide-react';

import { triggerHaptic, HapticPatterns } from '../utils/haptics';

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, hideNav }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Note: bottom-nav core pages are synchronous now (see App.tsx),
  // so prefetching them is unnecessary.
  const prefetchByPath = useMemo(() => {
    return {} as Record<string, () => Promise<unknown>>;
  }, []);

  useEffect(() => {
    // no-op
  }, []);

  // Navigation:
  // 1. Bookkeeping ($) -> Add Transaction
  // 2. Calendar -> Calendar View
  // 3. Stats (Chart) -> Dashboard
  // 4. Records (List) -> Records List (moved from Categories position)
  // 5. Settings (Gear) -> Settings
  const navItems = [
    { icon: CircleDollarSign, label: '記帳', path: '/add' },
    { icon: CalendarDays, label: '月曆', path: '/calendar' },
    { icon: BarChart3, label: '統計', path: '/' },
    { icon: List, label: '記錄', path: '/records' },
    { icon: Settings, label: '設定', path: '/settings' },
  ];

  const handleNavClick = (path: string) => {
    triggerHaptic(HapticPatterns.Light);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col relative">
      <div className={`flex-1 overflow-y-auto scrollbar-hide ${hideNav ? '' : 'pb-24'}`}>
        {children}
      </div>

      {!hideNav && (
        <div className="fixed bottom-0 left-0 right-0 sf-surface border-t sf-divider pb-safe-bottom pt-2 px-4 z-50">
          <div className="flex justify-between items-end max-w-md mx-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const IconComp = item.icon;

              const prefetch = prefetchByPath[item.path];

              return (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item.path)}
                  onPointerEnter={() => prefetch?.().catch(() => undefined)}
                  onTouchStart={() => prefetch?.().catch(() => undefined)}
                  className={`flex flex-col items-center gap-1 w-16 py-1 transition-colors active:scale-95 duration-200 ${isActive ? 'text-primary' : 'text-gray-500'
                    }`}
                >
                  <IconComp size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
