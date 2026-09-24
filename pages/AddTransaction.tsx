import { readEntryDraft, saveEntryDraft, clearEntryDraft, MAX_RECEIPT_BYTES, type EntryDraft } from '../utils/entryDraft';
import { makeId } from '../utils/id';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Camera, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import NumPad from '../components/NumPad';
import { getCurrencySymbol } from '../utils/currency';
import { Currency, RecurrenceFrequency, TransactionType } from '../types';
import BottomNavigation from '../components/BottomNavigation';
import { rememberTags } from '../utils/tagHistory';
import TagPicker from '../components/TagPicker';
import { localYMDToStoredISOString, toLocalYMD, parseDate } from '../utils/date';
import { parseMoneyInput } from '../utils/money';

const AddTransaction: React.FC = () => {
  const { transactions } = useData();
  const [draft, setDraft] = useState<EntryDraft | null | undefined>();
  useEffect(() => {
    let active = true;
    void readEntryDraft().then(value => { if (active) setDraft(value && !transactions.some(tx => tx.id === value.id) ? value : null); });
    return () => { active = false; };
  }, []);
  if (draft === undefined) return <div className="min-h-screen bg-background pt-safe-top p-6 text-gray-300">正在載入草稿…</div>;
  return <EntryForm initialDraft={draft} />;
};

const EntryForm: React.FC<{ initialDraft: EntryDraft | null }> = ({ initialDraft }) => {
  const navigate = useNavigate();
  const { saveTransaction, categories, currency, transactions } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draftId = useRef(initialDraft?.id || makeId('tx'));
  const saved = useRef(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draftWarning, setDraftWarning] = useState(false);
  // State for NumPad visibility
  const [isNumPadOpen, setIsNumPadOpen] = useState(false);

  // Fix date initialization to account for local timezone
  const getTodayString = () => toLocalYMD(new Date());

  const [amount, setAmount] = useState<string>(initialDraft?.amount || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialDraft?.selectedCategory || null);
  const [note, setNote] = useState(initialDraft?.note || '');
  const [date, setDate] = useState(initialDraft?.date || getTodayString());
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | 'none'>(initialDraft?.recurrence || 'none');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(initialDraft?.receiptPreview || null);
  const [tags, setTags] = useState<string[]>(initialDraft?.tags || []);
  const [transactionType, setTransactionType] = useState<TransactionType>(initialDraft?.transactionType || TransactionType.EXPENSE);
  const [txCurrency, setTxCurrency] = useState<Currency>(initialDraft?.txCurrency || currency);
  const [showDetails, setShowDetails] = useState(initialDraft?.showDetails || false);

  const [categoryQuery, setCategoryQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [formError, setFormError] = useState('');
  const categoryOptions = useMemo(() => {
    const latest = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type === transactionType) latest.set(tx.categoryId, Math.max(latest.get(tx.categoryId) || 0, parseDate(tx.date)?.getTime() || 0));
    }
    return categories.filter(c => c.type === transactionType && c.name.toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase()))
      .sort((a, b) => (latest.get(b.id) || 0) - (latest.get(a.id) || 0));
  }, [categories, transactions, transactionType, categoryQuery]);
  const recentCategories = categoryOptions.slice(0, 4);
  const visibleCategories = showAllCategories ? categoryOptions : selectedCategory && !recentCategories.some(c => c.id === selectedCategory)
    ? [...recentCategories.slice(0, 3), ...categoryOptions.filter(c => c.id === selectedCategory)] : recentCategories;
  const changeType = (type: TransactionType) => { setTransactionType(type); setSelectedCategory(null); setCategoryQuery(''); setFormError(''); };

  useEffect(() => {
    if (saved.current) return;
    let active = true;
    void saveEntryDraft({ id: draftId.current, amount, selectedCategory, note, date, recurrence, receiptPreview, tags, transactionType, txCurrency, showDetails })
      .then(ok => { if (active) setDraftWarning(!ok); });
    return () => { active = false; };
  }, [amount, selectedCategory, note, date, recurrence, receiptPreview, tags, transactionType, txCurrency, showDetails]);

  const handleSave = async () => {
    if (savingRef.current) return;
    setFormError('');
    const amountValue = parseMoneyInput(amount, txCurrency);
    if (!categories.some(c => c.id === selectedCategory && c.type === transactionType)) {
      setFormError("請選擇分類");
      return;
    }
    if (amountValue === null || amountValue <= 0) {
      setFormError(`請輸入有效金額（${txCurrency === Currency.JPY ? '不可輸入小數' : '最多兩位小數'}）`);
      return;
    }
    if (!date) {
      setFormError("請選擇日期");
      return;
    }
    const storedDate = localYMDToStoredISOString(date);
    if (!storedDate) {
      setFormError("日期格式不正確");
      return;
    }

    // Persist tags MRU on save as well (covers cases where user typed but didn't blur/add)
    if (tags.length > 0) {
      rememberTags(tags);
    }

    savingRef.current = true; setSaving(true);
    try {
    await saveTransaction({
      id: draftId.current,
      amount: amountValue,
      categoryId: selectedCategory!,
      note: note,
      // Store as ISO string, but make sure the UI always displays it as local date.
      date: storedDate,
      type: transactionType,
      isRecurring: recurrence !== 'none',
      recurrence: recurrence === 'none' ? undefined : recurrence,
      receiptUrl: receiptPreview || undefined,
      tags: tags,
      currency: txCurrency
    });

    saved.current = true;
    if (!await clearEntryDraft()) setDraftWarning(true);
    navigate('/records');
    } catch (error) { setFormError(error instanceof Error ? error.message : '儲存失敗，請重試'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) { setFormError('請選擇圖片收據'); return; }
      if (file.size > MAX_RECEIPT_BYTES) { setFormError('收據圖片不可超過 5 MB，請先縮小圖片'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') { setFormError(''); setReceiptPreview(reader.result); }
      };
      reader.onerror = () => setFormError('收據讀取失敗，請重試');
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="sf-entry-page min-h-screen bg-background flex flex-col pt-safe-top pb-safe-bottom">
      {/* Header */}
      <div className="px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center sf-topbar sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-primary text-base justify-self-start">取消</button>
        <h2 className="text-lg font-semibold text-white">新增帳目</h2>
        <span aria-hidden="true" />
      </div>

      <fieldset disabled={saving} className="sf-entry-content p-4 space-y-4 flex-1 pb-56 min-w-0">
        {draftWarning && <p role="alert" className="text-sm text-amber-400">草稿暫時未能保存，請勿關閉頁面</p>}
        {/* Transaction Type Toggle */}
        <div className="flex sf-control rounded-xl p-1">
          <button
            aria-pressed={transactionType === TransactionType.EXPENSE}
            onClick={() => changeType(TransactionType.EXPENSE)}
            className={`flex-1 py-2 rounded-lg text-sm transition-all duration-200 ${transactionType === TransactionType.EXPENSE ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            支出
          </button>
          <button
            aria-pressed={transactionType === TransactionType.INCOME}
            onClick={() => changeType(TransactionType.INCOME)}
            className={`flex-1 py-2 rounded-lg text-sm transition-all duration-200 ${transactionType === TransactionType.INCOME ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
          >
            收入
          </button>
        </div>


        {/* Amount Display */}
        <button
          type="button"
          aria-label="輸入金額"
          onClick={() => setIsNumPadOpen(true)}
          className={`sf-entry-amount sf-card w-full py-4 px-4 flex flex-col items-center justify-center transition-colors duration-300 cursor-pointer ${transactionType === TransactionType.INCOME ? 'bg-green-500/10 border border-green-500/20' : ''
          }`}>
          <span className="sf-entry-caption">{transactionType === TransactionType.EXPENSE ? '支出金額' : '收入金額'} · {txCurrency}</span>
          <div className="sf-entry-number flex items-baseline text-white">
            <span className="text-3xl mr-2 text-gray-400">{getCurrencySymbol(txCurrency)}</span>
            <span className={`text-6xl font-light tracking-tight ${!amount || amount === '0' ? 'text-gray-600' : 'text-white'}`}>
              {amount || '0'}
            </span>
          </div>
        </button>

        {/* Categories Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm ml-1">{transactionType === TransactionType.EXPENSE ? '支出分類' : '收入分類'} · 最近使用</h3>
            <button type="button" aria-expanded={showAllCategories} onClick={() => { setShowAllCategories(value => !value); setCategoryQuery(''); }} className="text-primary text-sm min-h-11 px-2">{showAllCategories ? '收起' : '查看全部'}</button>
          </div>
          {showAllCategories && <input aria-label="搜尋分類" placeholder="搜尋分類" className="sf-field mb-3" value={categoryQuery} onChange={event => setCategoryQuery(event.target.value)} />}
          <div className="sf-category-grid">
            {visibleCategories.map(cat => (
              <button
                key={cat.id}
                aria-pressed={selectedCategory === cat.id}
                onClick={() => { setSelectedCategory(cat.id); setFormError(''); }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${selectedCategory === cat.id ? cat.color + ' text-white scale-110 shadow-lg ring-2 ring-white/20' : 'sf-control text-gray-400 group-active:scale-95'
                  }`}>
                  {cat.icon.startsWith('emoji:')
                    ? <span className="text-lg">{cat.icon.replace('emoji:', '')}</span>
                    : <Icon name={cat.icon} size={20} />}
                </div>
                <span className={`sf-category-name transition-colors ${selectedCategory === cat.id ? 'text-white' : 'text-gray-500'}`}>{cat.name}</span>
              </button>
            ))}
            {/* Add New Category Button */}
            {showAllCategories && <button onClick={() => navigate('/categories')} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full sf-control text-primary flex items-center justify-center active:scale-95 transition-transform">
                <Plus size={24} />
              </div>
              <span className="text-[10px] text-gray-500">新增</span>
            </button>}
          </div>
        </div>

        {/* Date */}
        <div>
          <h3 className="text-gray-400 text-sm mb-2 ml-1">日期</h3>
          <div className="sf-control rounded-xl px-4 py-3">
            <input
              aria-label="交易日期"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              onInput={e => setDate(e.currentTarget.value)}
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

              <label className="block">備註 <span className="text-xs text-gray-400">描述呢筆交易，可留空</span>
              <input
                type="text"
                placeholder="輸入備註..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full sf-control rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />

              </label>
              <TagPicker value={tags} onChange={setTags} />

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
                    const value = ['none', 'weekly', 'biweekly', 'monthly'][idx] as RecurrenceFrequency | 'none';
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


      </fieldset>

      {/* Shared navigation; hide both actions while the numeric keypad is open. */}
      {!isNumPadOpen && <BottomNavigation action={
        <div className="sf-entry-save">
          {formError && <p role="alert" className="sf-entry-error">{formError}</p>}
          <button disabled={saving} onClick={handleSave} className="w-full bg-primary text-white font-semibold py-4 rounded-2xl text-base shadow-lg active:scale-[0.99] transition-transform">{saving ? '儲存中…' : '儲存'}</button>
        </div>
      } />}

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
                  if (txCurrency !== Currency.JPY && !amount.includes('.')) setAmount((amount || '0') + '.');
                } else if (amount === '0') {
                  setAmount(num);
                } else {
                  // Limit to 2 decimal places
                  const parts = amount.split('.');
                  if (parts.length === 2 && parts[1].length >= 2) return;
                  if (amount.length < 12) setAmount(amount + num);
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
