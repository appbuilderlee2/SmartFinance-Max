
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Currency, TransactionType } from '../types';
import { getCurrencySymbol } from '../utils/currency';

type PeriodMode = 'month' | 'year';

const Dashboard: React.FC = () => {
  const { transactions, categories, budgets, currency } = useData();

  const categoryById = useMemo(() => {
    return new Map(categories.map(c => [c.id, c] as const));
  }, [categories]);

  // Year / Month selectors (default to current)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');

  const availableCurrencies = useMemo(() => {
    const set = new Set<Currency>();
    set.add(currency);
    transactions.forEach((t) => {
      const txCurrency = (t.currency as Currency) || currency;
      set.add(txCurrency);
    });
    return Array.from(set);
  }, [transactions, currency]);

  const yearsOptions = useMemo(() => {
    const yearsSet = new Set<number>();
    transactions.forEach(t => yearsSet.add(new Date(t.date).getFullYear()));
    if (!yearsSet.size) yearsSet.add(now.getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions, now]);

  const periodStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      const d = new Date(t.date);
      const txCurrency = (t.currency as Currency) || currency;
      if (txCurrency !== selectedCurrency) return;

      if (d.getFullYear() !== selectedYear) return;
      if (periodMode === 'month' && d.getMonth() !== selectedMonth) return;

      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });
    return { income, expense };
  }, [transactions, selectedMonth, selectedYear, currency, selectedCurrency, periodMode]);

  // 2. Calculate Pie Data (Expenses by Category)
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      const txCurrency = (t.currency as Currency) || currency;
      if (txCurrency !== selectedCurrency) return;
      if (d.getFullYear() !== selectedYear) return;
      if (periodMode === 'month' && d.getMonth() !== selectedMonth) return;
      if (t.type === TransactionType.EXPENSE) {
        const current = map.get(t.categoryId) || 0;
        map.set(t.categoryId, current + t.amount);
      }
    });

    return Array.from(map.entries()).map(([catId, val]) => {
      const cat = categoryById.get(catId);
      return {
        name: cat?.name || 'Unknown',
        value: val,
        color: cat?.color.replace('bg-', 'text-').replace('text-', '#') || '#8884d8' // Hacky color mapping for demo
      };
    }).sort((a, b) => b.value - a.value).slice(0, 5); // Top 5
  }, [transactions, categoryById, selectedMonth, selectedYear, currency, selectedCurrency, periodMode]);

  // Helper to map Tailwind colors to Hex for Recharts
  const getColorHex = (tailwindClass: string) => {
    // Simple mapping for the demo constants
    if (tailwindClass.includes('red')) return '#ef4444';
    if (tailwindClass.includes('blue')) return '#3b82f6';
    if (tailwindClass.includes('green')) return '#22c55e';
    if (tailwindClass.includes('orange')) return '#f97316';
    if (tailwindClass.includes('purple')) return '#a855f7';
    if (tailwindClass.includes('pink')) return '#ec4899';
    if (tailwindClass.includes('indigo')) return '#6366f1';
    if (tailwindClass.includes('emerald')) return '#10b981';
    if (tailwindClass.includes('amber')) return '#f59e0b';
    return '#64748b';
  };

  const categoryByName = useMemo(() => {
    return new Map(categories.map(c => [c.name, c] as const));
  }, [categories]);

  const finalPieData = pieData.map(p => {
    // Find category to get original tailwind class
    const cat = categoryByName.get(p.name);
    return { ...p, color: getColorHex(cat?.color || '') };
  });

  // 3. Trend Data
  const trendData = useMemo(() => {
    const data: Array<{ month: string; income: number; expense: number }> = [];
    const points = periodMode === 'year' ? 12 : 6;

    for (let i = points - 1; i >= 0; i--) {
      const d = new Date();
      d.setFullYear(selectedYear);
      d.setMonth(periodMode === 'year' ? i : selectedMonth - i);
      const monthLabel = `${d.getMonth() + 1}月`;

      let inc = 0;
      let exp = 0;

      transactions.forEach(t => {
        const tDate = new Date(t.date);
        const txCurrency = (t.currency as Currency) || currency;
        if (txCurrency !== selectedCurrency) return;
        if (tDate.getMonth() === d.getMonth() && tDate.getFullYear() === d.getFullYear()) {
          if (t.type === TransactionType.INCOME) inc += t.amount;
          else exp += t.amount;
        }
      });
      data.push({ month: monthLabel, income: inc, expense: exp });
    }
    return data;
  }, [transactions, selectedMonth, selectedYear, currency, selectedCurrency, periodMode]);

  // Check budget status
  const totalBudget = budgets.reduce((acc, b) => acc + b.limit, 0);
  const isOverBudget = periodMode === 'month' && selectedCurrency === currency && periodStats.expense > totalBudget && totalBudget > 0;
  const hasOtherCurrenciesInPeriod = useMemo(() => {
    return transactions.some((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() !== selectedYear) return false;
      if (periodMode === 'month' && d.getMonth() !== selectedMonth) return false;
      const txCurrency = (t.currency as Currency) || currency;
      return txCurrency !== selectedCurrency;
    });
  }, [transactions, selectedMonth, selectedYear, currency, selectedCurrency, periodMode]);

  return (
    <div className="p-4 space-y-6 pt-safe-top mt-4 max-w-5xl mx-auto">
      <header className="flex flex-col gap-3 mb-2">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">統計總覽</h1>
          <div className="h-8 w-8 sf-control rounded-full overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">User</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex sf-control rounded-lg p-1">
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${periodMode === 'month' ? 'bg-primary text-white' : 'text-gray-400'}`}
            >
              月
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('year')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${periodMode === 'year' ? 'bg-primary text-white' : 'text-gray-400'}`}
            >
              年
            </button>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="sf-control rounded-lg px-3 py-2 text-sm"
          >
            {yearsOptions.map(y => <option key={y} value={y}>{y} 年</option>)}
          </select>
          {periodMode === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="sf-control rounded-lg px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i).map(m => (
                <option key={m} value={m}>{m + 1} 月</option>
              ))}
            </select>
          )}
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value as Currency)}
            className="sf-control rounded-lg px-3 py-2 text-sm"
            title="幣別"
          >
            {availableCurrencies.map((c) => (
              <option key={c} value={c}>
                {c} ({getCurrencySymbol(c)})
              </option>
            ))}
          </select>
        </div>
      </header>

      {hasOtherCurrenciesInPeriod && (
        <div className="sf-panel p-3 text-xs text-gray-300">
          本頁統計以 {selectedCurrency} 計算，已排除其他幣別交易（{periodMode === 'month' ? '本月' : '本年'}）。
          {selectedCurrency !== currency && <span className="ml-2 text-gray-500">（預算設定以主貨幣 {currency} 為準）</span>}
        </div>
      )}

      {/* Warning Banner */}
      {isOverBudget && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="text-red-500" size={20} />
          <span className="text-red-200 text-sm">本月預算已超標！請檢視您的支出。</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="sf-panel p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
            <TrendingDown className="text-red-500" />
          </div>
          <p className="text-gray-400 text-xs mb-1">總支出 ({periodMode === 'month' ? '本月' : '本年'})</p>
          <p className="text-2xl font-bold mb-1">{getCurrencySymbol(selectedCurrency)} {periodStats.expense.toLocaleString()}</p>
          <p className="text-xs text-red-400">較上期 (示意)</p>
        </div>
        <div className="sf-panel p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
            <TrendingUp className="text-green-500" />
          </div>
          <p className="text-gray-400 text-xs mb-1">總收入 ({periodMode === 'month' ? '本月' : '本年'})</p>
          <p className="text-2xl font-bold mb-1">{getCurrencySymbol(selectedCurrency)} {periodStats.income.toLocaleString()}</p>
          <p className="text-xs text-green-400">較上期 (示意)</p>
        </div>
      </div>

      {/* Pie Chart Section */}
      <div className="sf-panel p-4 space-y-3">
        <h3 className="text-lg font-semibold">分類圓餅圖 ({periodMode === 'month' ? '本月' : '本年'})</h3>
        {finalPieData.length > 0 ? (
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalPieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {finalPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
            尚無支出資料
          </div>
        )}
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {finalPieData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <div className="flex flex-col">
                <span className="text-gray-300">{item.name}</span>
                <span className="text-[11px] text-gray-500">
                  {getCurrencySymbol(selectedCurrency)} {item.value.toLocaleString()} ({Math.round(item.value / (periodStats.expense || 1) * 100)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Line Chart Section */}
      <div className="sf-panel p-4 space-y-3">
        <h3 className="text-lg font-semibold">{periodMode === 'month' ? '收支趨勢圖 (近六個月)' : '收支趨勢圖 (本年每月)'}</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" dot={{ r: 4, fill: '#22c55e' }} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" dot={{ r: 4, fill: '#ef4444' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>收入</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>支出</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
