
import React, { useMemo, useRef, useState, useEffect, useDeferredValue } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, Plus, Repeat2 } from 'lucide-react';
import { useLedger } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import { Currency, TransactionType } from '../types';
import { parseDate, toLocalYMD } from '../utils/date';
import { formatMoney, toMinorUnits, fromMinorUnits } from '../utils/money';
import { RECURRENCE_LABELS } from '../utils/recurringTransactions';

type RecordView = { searchTerm: string; selectedCategories: string[]; minAmount: string; maxAmount: string; showFilters: boolean; visibleCount: number; scrollY: number };
// History-entry scoped and memory-only: returning from details restores this view.
const recordViews = new Map<string, RecordView>();

const Records: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const savedView = recordViews.get(location.key);
  const { transactions, categories, currency } = useLedger();

  const categoryById = useMemo(() => {
    return new Map(categories.map(c => [c.id, c] as const));
  }, [categories]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilters, setShowFilters] = useState(savedView?.showFilters || false);
  const [searchTerm, setSearchTerm] = useState(savedView?.searchTerm || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(savedView?.selectedCategories || []);
  const [minAmount, setMinAmount] = useState<string>(savedView?.minAmount || '');
  const [maxAmount, setMaxAmount] = useState<string>(savedView?.maxAmount || '');

  const deferredSearch = useDeferredValue(searchTerm);
  const [visibleCount, setVisibleCount] = useState(savedView?.visibleCount || 100);
  const firstFilterRender = useRef(true);
  useEffect(() => { if (firstFilterRender.current) { firstFilterRender.current = false; return; } setVisibleCount(100); }, [deferredSearch, selectedCategories, minAmount, maxAmount]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo(0, savedView?.scrollY || 0));
    return () => cancelAnimationFrame(frame);
  }, []);
  const openTransaction = (id: string) => {
    if (recordViews.size >= 20) recordViews.delete(recordViews.keys().next().value!);
    recordViews.set(location.key, { searchTerm, selectedCategories, minAmount, maxAmount, showFilters, visibleCount, scrollY: window.scrollY });
    navigate(`/view/${id}`);
  };
  const hasFilters = Boolean(searchTerm || selectedCategories.length || minAmount || maxAmount);
  const clearFilters = () => { setSearchTerm(''); setSelectedCategories([]); setMinAmount(''); setMaxAmount(''); };

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
      if (deferredSearch.trim()) {
        const keyword = deferredSearch.trim().toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(keyword);
        const tagMatch = tx.tags?.some(tag => tag.toLowerCase().includes(keyword));
        const categoryMatch = categoryById.get(tx.categoryId)?.name.toLowerCase().includes(keyword);
        if (!noteMatch && !tagMatch && !categoryMatch) return false;
      }

      return true;
    });
  }, [transactions, selectedCategories, minAmount, maxAmount, deferredSearch, categoryById]);

  const ordered = useMemo(() => filteredTransactions
    .map(tx => ({ tx, date: parseDate(tx.date)?.getTime() || 0 }))
    .sort((a, b) => b.date - a.date).map(item => item.tx), [filteredTransactions]);
  const grouped = useMemo(() => ordered.slice(0, visibleCount).reduce((acc, tx) => {
    const date = parseDate(tx.date);
    const key = date ? toLocalYMD(date) : '日期不詳';
    (acc[key] ||= []).push(tx);
    return acc;
  }, {} as Record<string, typeof filteredTransactions>), [ordered, visibleCount]);
  const sortedDates = Object.keys(grouped);
  const dailyTotals = useMemo(() => {
    const result = new Map<string, Map<Currency, { income: number; expense: number }>>();
    for (const tx of ordered) {
      const parsed = parseDate(tx.date), day = parsed ? toLocalYMD(parsed) : '日期不詳';
      const code = (tx.currency as Currency) || currency;
      const totals = result.get(day) || new Map<Currency, { income: number; expense: number }>();
      const amount = totals.get(code) || { income: 0, expense: 0 };
      amount[tx.type === TransactionType.EXPENSE ? 'expense' : 'income'] += toMinorUnits(tx.amount, code);
      totals.set(code, amount); result.set(day, totals);
    }
    return result;
  }, [ordered, currency]);

  return (
    <div className="sf-records-page min-h-screen bg-background pt-safe-top pb-24 px-4">
      {/* Header */}
      <div className="flex justify-between items-center py-4 sticky top-0 sf-topbar z-10 px-4 -mx-4">
        <h1 className="sf-page-title">帳目明細</h1>
        <div className="flex gap-2">
          <button
            aria-label="搜尋帳目"
            className="sf-icon-button sf-control rounded-full text-gray-400 hover:text-white transition-colors"
            onClick={() => {
              setShowFilters(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
          >
            <Search size={20} />
          </button>
          <button
            aria-label="篩選帳目" aria-expanded={showFilters}
            className="sf-icon-button sf-control rounded-full text-gray-400 hover:text-white transition-colors"
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="sf-record-status"><span>{filteredTransactions.length} 筆{hasFilters ? '符合條件的帳目' : '帳目'}</span>{hasFilters && <button onClick={clearFilters}>清除篩選</button>}</div>
      {/* Filters */}
      {showFilters && (
        <div className="sf-panel p-4 space-y-3 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">關鍵字（分類／備註／標籤）</label>
            <input
              aria-label="搜尋帳目關鍵字"
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
                aria-label="最小金額"
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
                aria-label="最大金額"
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
                    aria-pressed={active}
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
            <p>{hasFilters ? '沒有符合條件的帳目' : '尚無帳目'}</p>
            <p className="text-xs mt-2">{hasFilters ? '試試其他關鍵字或清除篩選' : '點擊右下角按鈕新增第一筆記帳'}</p>
          </div>
        ) : (
          sortedDates.map((date) => (
            <div key={date}>
              <div className="sf-record-day"><h3>{date}</h3><div aria-label={`${date}每日小計`} className="sf-daily-totals">
                {Array.from(dailyTotals.get(date) || []).map(([code, totals]) => <p key={code}>{code} · 收入 {formatMoney(fromMinorUnits(totals.income, code), code)} · 支出 {formatMoney(fromMinorUnits(totals.expense, code), code)}</p>)}
                {hasFilters && <span>篩選結果小計</span>}
              </div></div>
              <div className="sf-panel overflow-hidden divide-y sf-divider">
                {grouped[date].map(tx => {
                  const category = categoryById.get(tx.categoryId);
                  const isExpense = tx.type === TransactionType.EXPENSE;
                  return (
                    <button
                      key={tx.id}
                      onClick={() => openTransaction(tx.id)}
                      className="sf-record-row p-4 flex items-center justify-between active:bg-gray-700/50 transition-colors cursor-pointer"
                    >
                      <div className="sf-record-description flex items-center gap-3">
                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${category?.color || 'bg-gray-500'} text-white`}>
                          <Icon name={category?.icon || 'HelpCircle'} size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium">{category?.name || '未分類'}</p>
                          {tx.note ? (
                            <p className="text-xs text-gray-400 line-clamp-1">{tx.note}</p>
                          ) : null}
                          {(tx.recurrence || tx.recurrenceSourceId) && (
                            <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                              <Repeat2 size={11} />
                              {tx.recurrence ? RECURRENCE_LABELS[tx.recurrence] : '週期自動帳目'}
                            </p>
                          )}

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
                      <span className={`sf-record-amount font-semibold ${isExpense ? 'text-white' : 'text-green-500'}`}>
                        {isExpense ? '-' : '+'} {formatMoney(tx.amount, (tx.currency as Currency) || currency)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {visibleCount < ordered.length && <button className="w-full p-4 text-primary" onClick={() => setVisibleCount(count => count + 100)}>載入更多（已顯示 {Math.min(visibleCount, ordered.length)}／{ordered.length} 筆）</button>}
      {/* FAB */}
      <button
        aria-label="新增帳目"
        onClick={() => navigate('/add')}
        className="fixed bottom-24 right-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg text-white active:scale-95 transition-transform z-20"
      >
        <Plus size={30} />
      </button>
    </div>
  );
};

export default Records;
