import React, { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, Settings, CircleDollarSign, List, CreditCard } from 'lucide-react';
import { triggerHaptic, HapticPatterns } from '../utils/haptics';
import { navRoutePreloads } from '../routeModules';

const items = [
  { icon: CircleDollarSign, label: '記帳', path: '/add' },
  { icon: CalendarDays, label: '月曆', path: '/calendar' },
  { icon: BarChart3, label: '統計', path: '/' },
  { icon: List, label: '記錄', path: '/records' },
  { icon: CreditCard, label: '信用卡', path: '/cards' },
  { icon: Settings, label: '設定', path: '/settings' },
];

export default function BottomNavigation({ action }: { action?: React.ReactNode }) {
  const navigate = useNavigate(), location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const [actionBottom, setActionBottom] = useState(110);
  const hasAction = Boolean(action);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!hasAction || !viewport) return;
    const update = () => setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
  }, [hasAction]);
  useLayoutEffect(() => {
    if (!hasAction || !navRef.current) return;
    const measure = () => {
      if (navRef.current) setActionBottom(window.innerHeight - navRef.current.getBoundingClientRect().top + 12);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [hasAction, keyboardInset]);
  return <>
    {action && <div data-testid="navigation-action" className="fixed left-4 right-4 z-40" style={{ bottom: actionBottom }}>{action}</div>}
    <nav style={keyboardInset ? { transform: `translateY(-${keyboardInset}px)` } : undefined} ref={navRef} aria-label="主要導航" className="sf-tabbar fixed bottom-0 left-0 right-0 sf-surface border-t sf-divider pb-safe-bottom pt-2 px-4 z-50">
      <div className="sf-nav-items">
        {items.map(item => {
          const active = location.pathname === item.path || (item.path === '/cards' && location.pathname.startsWith('/cards/')) || (item.path === '/settings' && location.pathname === '/reports');
          const Icon = item.icon, preload = navRoutePreloads[item.path];
          const prefetch = () => { void preload?.().catch(() => undefined); };
          return <button key={item.path} aria-current={active ? 'page' : undefined} onClick={() => { triggerHaptic(HapticPatterns.Light); navigate(item.path); }} onPointerEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch} className={`sf-nav-item flex flex-col items-center gap-1 flex-1 min-w-0 py-1 transition-colors active:scale-95 duration-200 ${active ? 'text-primary' : 'text-gray-500'}`}>
            <Icon size={24} strokeWidth={active ? 2.5 : 2} /><span className="sf-nav-label">{item.label}</span>
          </button>;
        })}
      </div>
    </nav>
  </>;
}
