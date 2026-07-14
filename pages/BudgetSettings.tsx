
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import { getCurrencySymbol } from '../utils/currency';

const BudgetSettings: React.FC = () => {
  const navigate = useNavigate();
  const { budgets, categories, updateBudget, currency } = useData();

  const categoryById = useMemo(() => {
    return new Map(categories.map(c => [c.id, c] as const));
  }, [categories]);

  const totalBudget = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);

  return (
    <div className="min-h-screen bg-background pb-20 pt-safe-top">
      <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="flex items-center text-primary">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-lg font-semibold">月預算設定</h2>
        <button className="text-primary font-bold" onClick={() => navigate(-1)}>完成</button>
      </div>

      <div className="p-4 space-y-6">
        {/* Total Budget Card */}
        <div className="sf-panel p-5">
          <div className="flex justify-between items-end mb-2">
            <div>
              <p className="text-gray-400 text-sm">本月總預算</p>
              <h1 className="text-3xl font-bold text-white">{getCurrencySymbol(currency)} {totalBudget.toLocaleString()}</h1>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span className="text-green-500">已使用 {getCurrencySymbol(currency)} {totalSpent.toLocaleString()}</span>
            <span>剩餘 {getCurrencySymbol(currency)} {(totalBudget - totalSpent).toLocaleString()}</span>
          </div>

          <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${totalSpent > totalBudget ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Category Sliders */}
        <div className="space-y-6">
          {categories.filter(c => c.type === 'EXPENSE').some(c => !budgets.find(b => b.categoryId === c.id)) && (
            <div className="sf-panel p-3 text-xs text-gray-300 flex items-center justify-between gap-3">
              <span>偵測到新分類尚未同步到預算，請稍後或點選重新整理。</span>
              <button
                type="button"
                onClick={() => navigate(0)}
                className="text-primary text-xs"
              >
                重新整理
              </button>
            </div>
          )}
          {budgets.map((budget) => {
            const cat = categoryById.get(budget.categoryId);
            if (!cat) return null;

            // Avoid division by zero
            const limit = budget.limit || 1;
            const percent = Math.round((budget.spent / limit) * 100);
            const barColor = percent > 90 ? 'bg-red-500' : 'bg-blue-500';

            return (
              <div key={budget.categoryId} className="sf-panel p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  {cat.icon.startsWith('emoji:') ? (
                    <span className={`text-2xl ${cat.color.replace('bg-', 'text-')}`}>
                      {cat.icon.replace('emoji:', '')}
                    </span>
                  ) : (
                    <Icon name={cat.icon} className={cat.color.replace('bg-', 'text-')} size={24} />
                  )}
                  <span className="font-medium flex-1">{cat.name}</span>
                  <span className="text-sm text-gray-300">{getCurrencySymbol(currency)} {budget.spent.toLocaleString()} / {getCurrencySymbol(currency)} {budget.limit.toLocaleString()}</span>
                </div>

                {/* Progress Bar with Limit Indicator */}
                <div className="w-full bg-gray-800 h-2 rounded-full mb-4 relative overflow-hidden">
                  <div className={`${barColor} h-full rounded-full transition-all duration-300`} style={{ width: `${Math.min(100, percent)}%` }}></div>
                </div>
                <div className="text-right text-xs mb-2" style={{ color: percent > 90 ? '#ef4444' : '#22c55e' }}>{percent}%</div>

                {/* Input + Slider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max="20000"
                      step="500"
                      value={budget.limit}
                      onChange={(e) => updateBudget(budget.categoryId, parseInt(e.target.value))}
                      className="w-full accent-white h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="w-32">
                    <div className="flex items-center gap-1 sf-control rounded-lg px-2 py-1">
                      <span className="text-xs text-gray-400">{getCurrencySymbol(currency)}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="bg-transparent text-right w-full focus:outline-none"
                        value={budget.limit}
                        onChange={(e) => updateBudget(budget.categoryId, Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default BudgetSettings;
