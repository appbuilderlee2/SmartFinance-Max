
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import { Currency, TransactionType } from '../types';
import { getCurrencySymbol } from '../utils/currency';
import { parseLocalYMD, toLocalYMD } from '../utils/date';

const Records: React.FC = () => {
  const navigate = useNavigate();
  const { transactions, categories, currency } = useData();

  const categoryById = useMemo(() => {
    return new Map(categories.map(c => [c.id, c] as const));
  }, [categories]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Category filter
      if (selectedCategories.length && !selectedCategories.includes(tx.categoryId)) return false;

      // Amount range
      const amt = tx.amount;
      if (minAmount && amt < Number(minAmount)) return false;
      if (maxAmount && amt > Number(maxAmount)) return false;

      // Keyword (note + tags)
      if (searchTerm.trim()) {
        const keyword = searchTerm.trim().toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(keyword);
        const tagMatch = tx.tags?.some(tag => tag.toLowerCase().includes(keyword));
        if (!noteMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [transactions, selectedCategories, minAmount, maxAmount, searchTerm]);

  // Group transactions by date
  const grouped = filteredTransactions.reduce((acc, tx) => {
    // IMPORTANT: tx.date is stored as ISO (UTC). Use local date for grouping.
    const dateStr = toLocalYMD(new Date(tx.date));
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(tx);
    return acc;
  }, {} as Record<string, typeof filteredTransactions>);

  // Sort dates descending (treat YYYY-MM-DD as local date to avoid timezone day shifts)
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const da = parseLocalYMD(a)?.getTime() ?? 0;
    const db = parseLocalYMD(b)?.getTime() ?? 0;
    return db - da;
  });

  return (
    <div className="min-h-screen bg-background pt-safe-top pb-24 px-4">
      {/* Header */}
      <div className="flex justify-between items-center py-4 sticky top-0 sf-topbar z-10 px-4 -mx-4">
        <h1 className="text-3xl font-bold text-white">帳目明細</h1>
        <div className="flex gap-2">
          <button
            className="p-2 sf-control rounded-full text-gray-400 hover:text-white transition-colors"
            onClick={() => {
              setShowFilters(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
          >
            <Search size={20} />
          </button>
          <button
            className="p-2 sf-control rounded-full text-gray-400 hover:text-white transition-colors"
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="sf-panel p-4 space-y-3 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">關鍵字（備註/標籤）</label>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="輸入關鍵字..."
              className="w-full sf-control text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">最小金額</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full sf-control text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">最大金額</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full sf-control text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="不限"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-2 block">分類（可多選）</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const active = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs border ${active ? 'bg-primary text-white border-primary' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategories([]);
                setMinAmount('');
                setMaxAmount('');
              }}
              className="px-3 py-2 rounded-lg text-sm bg-background border border-gray-700 text-gray-300"
            >
              清除
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="px-4 py-2 rounded-lg text-sm bg-primary text-white"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p>尚無帳目</p>
            <p className="text-xs mt-2">點擊右下角按鈕新增第一筆記帳</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-gray-500 text-sm mb-2 ml-1">{date}</h3>
              <div className="sf-panel overflow-hidden divide-y sf-divider">
                {grouped[date].map(tx => {
                  const category = categoryById.get(tx.categoryId);
                  const isExpense = tx.type === TransactionType.EXPENSE;
                  return (
                    <div
                      key={tx.id}
                      onClick={() => navigate(`/view/${tx.id}`)}
                      className="p-4 flex items-center justify-between active:bg-gray-700/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${category?.color || 'bg-gray-500'} text-white`}>
                          <Icon name={category?.icon || 'HelpCircle'} size={18} />
                        </div>
                        <div>
                          <p className="text-white font-medium">{category?.name || '未分類'}</p>
                          {tx.note ? (
                            <p className="text-xs text-gray-400 line-clamp-1">{tx.note}</p>
                          ) : null}

                          {/* Tags */}
                          {Array.isArray(tx.tags) && tx.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {tx.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="text-[10px] leading-4 px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25"
                                >
                                  {tag}
                                </span>
                              ))}
                              {tx.tags.length > 3 && (
                                <span className="text-[10px] leading-4 px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                                  +{tx.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`font-semibold whitespace-nowrap ${isExpense ? 'text-white' : 'text-green-500'}`}>
                        {isExpense ? '-' : '+'} {getCurrencySymbol((tx.currency as Currency) || currency)} {tx.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/add')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg text-white active:scale-95 transition-transform z-20"
      >
        <Plus size={30} />
      </button>
    </div>
  );
};

export default Records;
