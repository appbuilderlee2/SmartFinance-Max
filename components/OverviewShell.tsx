import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function OverviewShell({ children }: { children: ReactNode }) {
  const location = useLocation(), navigate = useNavigate();
  return <div className="sf-overview">
    <header className="sf-hub-header"><h1 className="sf-page-title">總覽</h1><nav className="sf-hub-tabs" aria-label="總覽分頁">
      {[['/', '摘要'], ['/records', '明細'], ['/reports', '統計']].map(([path, label]) => <button key={path} aria-current={location.pathname === path ? 'page' : undefined} onClick={() => navigate(path)}>{label}</button>)}
    </nav></header>
    {children}
  </div>;
}
