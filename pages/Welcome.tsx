import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, PlayCircle } from 'lucide-react';
import { DEMO_PAYLOAD } from '../utils/demoData';
import { setOnboarded } from '../utils/firstRun';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    setOnboarded();
    navigate('/');
  };

  const handleDemo = () => {
    try {
      localStorage.setItem('smartfinance_transactions', JSON.stringify(DEMO_PAYLOAD.transactions));
      localStorage.setItem('smartfinance_budgets', JSON.stringify(DEMO_PAYLOAD.budgets));
      localStorage.setItem('smartfinance_subscriptions', JSON.stringify(DEMO_PAYLOAD.subscriptions));
      localStorage.setItem('smartfinance_creditcards', JSON.stringify(DEMO_PAYLOAD.creditCards));
      localStorage.setItem('smartfinance_currency', DEMO_PAYLOAD.currency);
      localStorage.setItem('smartfinance_themecolor', DEMO_PAYLOAD.themeColor);
    } catch {
      // ignore
    }
    setOnboarded();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between sf-hero-bg p-6 relative overflow-x-hidden overflow-y-auto">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-20%] w-96 h-96 sf-spot rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 sf-spot rounded-full blur-[100px]" />

      <div className="mt-12 z-10 text-center">
        <h1 className="text-4xl font-bold mb-2 tracking-tight">歡迎使用</h1>
        <p className="text-gray-400 text-sm">您的個人智能財務管家</p>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center gap-8 z-10">
        <div className="relative w-64 h-64">
           {/* Mocking the isometric visual from screenshot 1 with CSS/Icons */}
           <div className="absolute inset-0 flex items-center justify-center">
              <TrendingUp size={120} className="text-primary drop-shadow-[0_0_15px_rgba(0,0,0,0.35)]" />
           </div>
           
           {/* Feature Callouts */}
           <div className="absolute top-0 right-0 flex items-center gap-2 animate-pulse">
             <div className="h-[1px] w-8 bg-gray-500"></div>
             <span className="text-xs text-gray-300">預算規劃</span>
           </div>
           <div className="absolute bottom-10 right-0 flex items-center gap-2">
             <div className="h-[1px] w-8 bg-gray-500"></div>
             <span className="text-xs text-gray-300">即時報表</span>
           </div>
           <div className="absolute top-1/2 left-0 flex items-center gap-2 -translate-x-full">
             <span className="text-xs text-gray-300">智能記帳</span>
             <div className="h-[1px] w-8 bg-gray-500"></div>
           </div>
        </div>

        <div className="text-center space-y-2 max-w-xs">
          <p className="text-gray-300 font-medium">掌握財務，實現目標。</p>
          <p className="text-gray-500 text-sm">離線使用（基礎）、本機備份、報表一目了然。</p>
        </div>
      </div>

      <div className="space-y-4 mb-8 z-10">
        <button 
          onClick={handleStart}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-full transition-all active:scale-[0.98] shadow-lg"
        >
          開始使用
        </button>
        <div className="text-center text-xs text-gray-500">
          本 App 只儲存喺本機（無需登入／無雲端）
        </div>
        <button
          type="button"
          onClick={handleStart}
          className="w-full sf-control hover:bg-surface/80 text-gray-200 font-medium py-3 rounded-full transition-colors flex items-center justify-center gap-2"
        >
          <PlayCircle size={18} />
          直接進入
        </button>

        <button
          type="button"
          onClick={handleDemo}
          className="w-full sf-control hover:bg-surface/80 text-gray-200 font-medium py-3 rounded-full transition-colors flex items-center justify-center gap-2"
        >
          <PlayCircle size={18} />
          體驗 Demo（會建立示範資料）
        </button>
      </div>
    </div>
  );
};

export default Welcome;
