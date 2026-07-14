import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Camera, X, Tag, CircleDollarSign, CalendarDays, BarChart3, List, Settings, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import NumPad from '../components/NumPad';
import { getCurrencySymbol } from '../utils/currency';
import { Currency, TransactionType } from '../types';
import { triggerHaptic, HapticPatterns } from '../utils/haptics';
import { clearTagHistory, deleteTagFromHistory, loadTagHistory, rememberTags } from '../utils/tagHistory';
import { toLocalYMD } from '../utils/date';

const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const { addTransaction, categories, currency } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for NumPad visibility
  const [isNumPadOpen, setIsNumPadOpen] = useState(false);

  // Fix date initialization to account for local timezone
  const getTodayString = () => toLocalYMD(new Date());

  const [amount, setAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagHistory, setTagHistory] = useState<string[]>(() => loadTagHistory());
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [txCurrency, setTxCurrency] = useState<Currency>(currency);
  const [showDetails, setShowDetails] = useState(false);
  const [editTagHistory, setEditTagHistory] = useState(false);

  const handleSave = () => {
    const amountValue = Number(amount);
    if (!selectedCategory) {
      alert("請選擇分類");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      alert("請輸入有效金額");
      return;
    }
    if (!date) {
      alert("請選擇日期");
      return;
    }
    const localDate = new Date(date + 'T00:00:00');
    if (Number.isNaN(localDate.getTime())) {
      alert("日期格式不正確");
      return;
    }

    // Persist tags MRU on save as well (covers cases where user typed but didn't blur/add)
    if (tags.length > 0) {
      rememberTags(tags);
      setTagHistory(loadTagHistory());
    }

    addTransaction({
      amount: amountValue,
      categoryId: selectedCategory,
      note: note,
      // Store as ISO string, but make sure the UI always displays it as local date.
      date: localDate.toISOString(),
      type: transactionType,
      isRecurring: recurrence !== 'none',
      receiptUrl: receiptPreview || undefined,
      tags: tags,
      currency: txCurrency
    });

    navigate('/records');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput('');

      rememberTags([t]);
      setTagHistory(loadTagHistory());
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pt-safe-top pb-safe-bottom">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-primary text-base">取消</button>
        <h2 className="text-lg font-semibold text-white">新增帳目</h2>
        <div className="w-14" />
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto scrollbar-hide pb-56">
        {/* Transaction Type Toggle */}
        <div className="flex sf-control rounded-xl p-1">
          <button
            onClick={() => setTransactionType(TransactionType.EXPENSE)}
            className={`flex-1 py-2 rounded-lg text-sm transition-all duration-200 ${transactionType === TransactionType.EXPENSE ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            支出
          </button>
          <button
            onClick={() => setTransactionType(TransactionType.INCOME)}
            className={`flex-1 py-2 rounded-lg text-sm transition-all duration-200 ${transactionType === TransactionType.INCOME ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            收入
          </button>
        </div>


        {/* Amount Display */}
        <div 
          onClick={() => setIsNumPadOpen(true)}
          className={`sf-card py-8 px-4 flex flex-col items-center justify-center mb-4 transition-colors duration-300 cursor-pointer ${transactionType === TransactionType.INCOME ? 'bg-green-500/10 border border-green-500/20' : ''
          }`}>
          <div className="flex items-baseline text-white">
            <span className="text-3xl mr-2 text-gray-400">{getCurrencySymbol(txCurrency)}</span>
            <span className={`text-6xl font-light tracking-tight ${!amount || amount === '0' ? 'text-gray-600' : 'text-white'}`}>
              {amount || '0'}
            </span>
          </div>
        </div>

        {/* Categories Grid */}
        <div>
          <h3 className="text-gray-400 text-sm mb-3 ml-1">
            {transactionType === TransactionType.EXPENSE ? '支出分類' : '收入分類'}
          </h3>
          <div className="grid grid-cols-5 gap-4">
            {categories.filter(c => c.type === transactionType).map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${selectedCategory === cat.id ? cat.color + ' text-white scale-110 shadow-lg ring-2 ring-white/20' : 'sf-control text-gray-400 group-active:scale-95'
                  }`}>
                  {cat.icon.startsWith('emoji:')
                    ? <span className="text-lg">{cat.icon.replace('emoji:', '')}</span>
                    : <Icon name={cat.icon} size={20} />}
                </div>
                <span className={`text-[10px] transition-colors ${selectedCategory === cat.id ? 'text-white' : 'text-gray-500'}`}>{cat.name}</span>
              </button>
            ))}
            {/* Add New Category Button */}
            <button onClick={() => navigate('/categories')} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full sf-control text-primary flex items-center justify-center active:scale-95 transition-transform">
                <Plus size={24} />
              </div>
              <span className="text-[10px] text-gray-500">新增</span>
            </button>
          </div>
        </div>

        {/* Date */}
        <div>
          <h3 className="text-gray-400 text-sm mb-2 ml-1">日期</h3>
          <div className="sf-control rounded-xl px-4 py-3">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-transparent text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Details (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowDetails(v => !v)}
            className="w-full sf-panel rounded-xl px-4 py-4 flex items-center justify-between text-base text-gray-200 hover:bg-surface/80 transition-colors"
          >
            <span className="font-medium">詳細資訊</span>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              {showDetails ? '收起' : '展開'}
              {showDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {showDetails && (
            <div className="space-y-3 mt-3">
              {/* Currency */}
              <div className="w-full sf-control rounded-xl p-4 flex items-center justify-between">
                <span className="text-gray-400 text-sm">幣別</span>
                <select
                  value={txCurrency}
                  onChange={(e) => setTxCurrency(e.target.value as Currency)}
                  className="bg-transparent text-right text-gray-300 focus:outline-none cursor-pointer"
                >
                  <option value="TWD">TWD (NT$)</option>
                  <option value="HKD">HKD (HK$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="CNY">RMB (¥)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="輸入備註..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full sf-control rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />

              {/* Tags Input */}
              <div className="w-full sf-control rounded-xl p-3 flex flex-wrap items-center gap-2 min-h-[56px]">
                <Tag size={18} className="text-gray-500 mr-1" />
                {tags.map(tag => (
                  <span key={tag} className="bg-primary/15 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-primary/25">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-white"><X size={12} /></button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={tags.length === 0 ? "新增標籤..." : ""}
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
                  onBlur={addTag}
                  className="bg-transparent text-white text-sm focus:outline-none flex-1 min-w-[80px]"
                />
              </div>

              {/* 常用標籤（最近使用 MRU） */}
              {tagHistory.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">常用標籤</span>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditTagHistory(v => !v)}
                        className={`text-xs underline ${editTagHistory ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                        title="編輯常用標籤"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Pencil size={12} />
                          {editTagHistory ? '完成' : '編輯'}
                        </span>
                      </button>

                      {editTagHistory && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm('清空所有常用標籤？')) return;
                            clearTagHistory();
                            setTagHistory(loadTagHistory());
                            setEditTagHistory(false);
                          }}
                          className="text-xs text-gray-400 hover:text-white underline"
                        >
                          清空
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tagHistory.slice(0, 12).map(t => {
                      const active = tags.includes(t);
                      return (
                        <div key={t} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!active) setTags(prev => [...prev, t]);
                              rememberTags([t]);
                              setTagHistory(loadTagHistory());
                            }}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${active
                              ? 'bg-primary/20 text-primary border-primary/30'
                              : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {t}
                          </button>

                          {editTagHistory && (
                            <button
                              type="button"
                              aria-label={`刪除常用標籤 ${t}`}
                              onClick={() => {
                                deleteTagFromHistory(t);
                                setTagHistory(loadTagHistory());
                              }}
                              className="text-gray-500 hover:text-white"
                              title="刪除"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />

              {!receiptPreview ? (
                <button
                  onClick={triggerFileInput}
                  className="w-full sf-control rounded-xl p-4 flex items-center gap-3 transition-colors hover:bg-surface/80 active:bg-surface/60"
                >
                  <div className="bg-gray-700 p-2 rounded-full">
                    <Camera size={18} className="text-white" />
                  </div>
                  <span className="text-gray-400">拍攝收據或上傳照片</span>
                </button>
              ) : (
                <div className="relative w-full sf-panel rounded-xl p-2">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/50">
                    <img src={receiptPreview} alt="Receipt Preview" className="w-full h-full object-contain" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setReceiptPreview(null); }}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <button onClick={triggerFileInput} className="w-full py-2 text-sm text-primary mt-1">
                    更換照片
                  </button>
                </div>
              )}

              {/* Recurrence */}
              <div>
                <h3 className="text-gray-400 text-sm mb-2 ml-1">週期</h3>
                <div className="flex sf-control rounded-xl p-1">
                  {['無', '每週', '每2週', '每月'].map((label, idx) => {
                    const value = ['none', 'weekly', 'biweekly', 'monthly'][idx] as any;
                    return (
                      <button
                        key={value}
                        onClick={() => setRecurrence(value)}
                        className={`flex-1 py-2 rounded-lg text-sm transition-all duration-200 ${recurrence === value ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                          }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-44"></div> {/* Spacer for fixed bottom bar */}
      </div>

      {/* Fixed bottom save */}
      {!isNumPadOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 sf-topbar pt-3">
          <div className="px-4">
            <button
              onClick={handleSave}
              className="w-full bg-primary text-white font-semibold py-4 rounded-2xl text-base shadow-lg active:scale-[0.99] transition-transform"
            >
              儲存
            </button>
          </div>

          <div className="mt-3 sf-surface border-t sf-divider pt-2 pb-safe-bottom">
            <div className="px-4">
              {(() => {
                const navItems = [
                  { icon: CircleDollarSign, label: '記帳', path: '/add' },
                  { icon: CalendarDays, label: '月曆', path: '/calendar' },
                  { icon: BarChart3, label: '統計', path: '/' },
                  { icon: List, label: '記錄', path: '/records' },
                  { icon: Settings, label: '設定', path: '/settings' },
                ];

                return (
                  <div className="flex justify-between items-end max-w-md mx-auto">
                    {navItems.map((item) => {
                      const isActive = item.path === '/add';
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.path}
                          onClick={() => {
                            triggerHaptic(HapticPatterns.Light);
                            navigate(item.path);
                          }}
                          className={`flex flex-col items-center gap-1 w-16 py-1 transition-colors active:scale-95 duration-200 ${
                            isActive ? 'text-primary' : 'text-gray-500'
                          }`}
                        >
                          <IconComp size={24} strokeWidth={isActive ? 2.5 : 2} />
                          <span className="text-[10px]">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Numeric Keypad - Modal */}
      {isNumPadOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60" 
          onClick={() => setIsNumPadOpen(false)}
        >
          <div 
            className="fixed bottom-0 left-0 right-0 z-50"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the pad itself
          >
            <NumPad
              onNumber={(num) => {
                if (num === '.') {
                  if (!amount.includes('.')) setAmount(amount + '.');
                } else if (amount === '0') {
                  setAmount(num);
                } else {
                  // Limit to 2 decimal places
                  const parts = amount.split('.');
                  if (parts.length === 2 && parts[1].length >= 2) return;
                  setAmount(amount + num);
                }
              }}
              onDelete={() => {
                if (amount.length > 1) {
                  setAmount(amount.slice(0, -1));
                } else {
                  setAmount('0');
                }
              }}
              onClear={() => setAmount('0')}
              onDone={() => {
                setIsNumPadOpen(false);
                // Optional: Automatically scroll to the next logical field after amount entry
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTransaction;
