import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CreditCard2: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-safe-top pb-24">
      <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center text-primary">
          <ChevronLeft size={24} />
          <span>設定</span>
        </button>
        <h2 className="text-lg font-semibold">回贈助手</h2>
        <div className="w-16" />
      </div>

      <div className="p-4 space-y-4">
        <div className="text-xs text-gray-500">
          兩個模式：
          A 用 SwipeWhich 場景（例如：網購/外幣/餐飲）做回贈比較；
          B 用 PickCardRebate 卡片庫規則（指定商戶/類別/期限）作參考。
        </div>

        <div className="sf-panel overflow-hidden divide-y sf-divider">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors"
            onClick={() => navigate('/settings/creditcards2/match')}
          >
            <div>
              <div className="text-white font-medium">信用卡配對</div>
              <div className="text-xs text-gray-500">將本地信用卡配對到 來源A / 來源B</div>
            </div>
            <ChevronRight className="text-gray-500" size={18} />
          </div>

          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors"
            onClick={() => navigate('/settings/creditcards2/a')}
          >
            <div>
              <div className="text-white font-medium">A：場景比較（來源A）</div>
              <div className="text-xs text-gray-500">按場景查看各卡回贈率/上限提示</div>
            </div>
            <ChevronRight className="text-gray-500" size={18} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreditCard2;
