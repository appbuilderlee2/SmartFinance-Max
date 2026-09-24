import { userTags } from '../utils/tags';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, X } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Icon } from '../components/Icon';
import { getCurrencySymbol } from '../utils/currency';
import { Currency, RecurrenceFrequency, TransactionType } from '../types';
import { localYMDToStoredISOString, toLocalYMD } from '../utils/date';
import { rememberTags } from '../utils/tagHistory';
import TagPicker from '../components/TagPicker';
import { parseMoneyInput } from '../utils/money';
import { showAppAlert } from '../utils/appDialog';

const TransactionDetail: React.FC = () => {
   const { id } = useParams();
   const navigate = useNavigate();
   const { transactions, categories, saveEditedTransaction, currency } = useData();
   const [saving, setSaving] = useState(false);
   const [saveError, setSaveError] = useState('');

   const categoryById = useMemo(() => {
      return new Map(categories.map(c => [c.id, c] as const));
   }, [categories]);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const tx = transactions.find(t => t.id === id);

   // Local state for editing
   const [amount, setAmount] = useState(tx?.amount?.toString() || '0');
   const [selectedCategory, setSelectedCategory] = useState(tx?.categoryId || '');
   const [note, setNote] = useState(tx?.note || '');
   const [tags, setTags] = useState<string[]>(tx ? userTags(tx) : []);
   const [receiptUrl, setReceiptUrl] = useState<string | undefined>(tx?.receiptUrl);
   const [recurrence, setRecurrence] = useState<RecurrenceFrequency | 'none'>(tx?.recurrence || 'none');
   const [date, setDate] = useState(tx?.date ? toLocalYMD(new Date(tx.date)) : '');
   const [txCurrency, setTxCurrency] = useState<Currency>((tx?.currency as Currency) || currency);

   // Keep local edit state in sync when route param changes.
   // React Router may reuse this component instance across /edit/:id navigations,
   // and useState initializers only run on first mount. Without this, saving can
   // accidentally overwrite tags (and other fields) with stale/empty state.
   useEffect(() => {
      if (!tx) return;
      setAmount(tx.amount?.toString() || '0');
      setSelectedCategory(tx.categoryId || '');
      setNote(tx.note || '');
      setTags(userTags(tx));
      setReceiptUrl(tx.receiptUrl);
      setRecurrence(tx.recurrence || 'none');
      setDate(tx.date ? toLocalYMD(new Date(tx.date)) : '');
      setTxCurrency(((tx.currency as Currency) || currency) as Currency);
   }, [id, tx?.id]);

   if (!tx) return <div className="pt-safe-top p-4 text-white">Not found</div>;

   const currentCategory = categoryById.get(selectedCategory);
   const transactionType = currentCategory?.type || tx.type;

   const handleSave = async () => {
      if (saving) return;
      setSaveError('');
      const amountValue = parseMoneyInput(amount, txCurrency);
      if (!selectedCategory) {
         await showAppAlert('請選擇分類');
         return;
      }
      if (amountValue === null || amountValue <= 0) {
         await showAppAlert(`請輸入有效金額（${txCurrency === Currency.JPY ? '不可輸入小數' : '最多兩位小數'}）`);
         return;
      }
      if (!date) {
         await showAppAlert('請選擇日期');
         return;
      }
      const storedDate = localYMDToStoredISOString(date);
      if (!storedDate) {
         await showAppAlert('日期格式不正確');
         return;
      }
      // Persist tags MRU on save as well
      if (tags.length > 0) {
         rememberTags(tags);
      }

      setSaving(true);
      try {
      await saveEditedTransaction(tx.id, {
         amount: amountValue,
         categoryId: selectedCategory || tx.categoryId,
         note,
         tags,
         receiptUrl,
         isRecurring: recurrence !== 'none',
         recurrence: recurrence === 'none' ? undefined : recurrence,
         date: storedDate,
         type: transactionType,
         currency: txCurrency
      });
      navigate(-1);
      } catch (error) {
         setSaveError(error instanceof Error ? error.message : '儲存失敗，請重試');
      } finally { setSaving(false); }
   };

   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            setReceiptUrl(reader.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   return (
      <div className="min-h-screen bg-background pb-safe-bottom">
         {/* Header */}
         <div className="pt-safe-top px-4 py-3 flex justify-between items-center sf-topbar sticky top-0 z-50">
            <button onClick={() => navigate(-1)} className="flex items-center text-primary text-base active:opacity-70">
               <ChevronLeft size={24} />
               <span>返回</span>
            </button>
            <h2 className="text-lg font-semibold text-white">編輯帳目</h2>
            <button onClick={() => void handleSave()} disabled={saving} className="text-primary font-bold text-base active:opacity-70 disabled:opacity-50">
               {saving ? '儲存中…' : '儲存'}
            </button>
         </div>
         {saveError && <div role="alert" className="mx-4 mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{saveError}</div>}

         <div className="p-4 space-y-6">
            {/* Amount Card - Editable */}
            <div className={`sf-card p-6 text-center ${transactionType === TransactionType.INCOME ? 'bg-green-900/30' : ''}`}>
               <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-2xl text-gray-400">{getCurrencySymbol(txCurrency)}</span>
                  <input
                     type="number"
                     value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                     className="text-4xl font-bold text-white bg-transparent text-center w-40 focus:outline-none border-b-2 border-gray-600 focus:border-primary"
                     inputMode="decimal"
                  />
               </div>

               {/* Currency */}
               <div className="mt-2 flex justify-center">
                  <div className="sf-control rounded-full px-3 py-1.5 flex items-center gap-2">
                     <span className="text-xs text-gray-400">幣別</span>
                     <select
                        value={txCurrency}
                        onChange={(e) => setTxCurrency(e.target.value as Currency)}
                        className="bg-transparent text-gray-200 focus:outline-none text-xs cursor-pointer"
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
               </div>

               {/* Category Selection */}
               <div className="mt-4">
                  <p className="text-gray-400 text-sm mb-3">選擇分類</p>
                  <div className="flex flex-wrap justify-center gap-3">
                     {categories.filter(c => c.type === transactionType).map(cat => (
                        <button
                           key={cat.id}
                           onClick={() => setSelectedCategory(cat.id)}
                           className="flex flex-col items-center gap-1"
                        >
                           <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${cat.id === selectedCategory
                                 ? `${cat.color} ring-2 ring-white scale-110`
                                 : 'bg-gray-700 text-gray-400'
                              }`}>
                              <Icon name={cat.icon} size={20} />
                           </div>
                           <span className={`text-xs ${cat.id === selectedCategory ? 'text-white' : 'text-gray-500'}`}>{cat.name}</span>
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            {/* Details List */}
            <div className="sf-panel overflow-hidden divide-y sf-divider">
               <div className="p-4">
                  <span className="text-white text-base block mb-1">日期</span>
                  <input
                     type="date"
                     value={date}
                     onChange={(e) => setDate(e.target.value)}
                     className="w-full bg-transparent text-gray-400 focus:outline-none"
                  />
               </div>

               <div className="p-4">
                  <span className="text-white text-base block mb-1">備註</span>
                  <input
                     type="text"
                     value={note}
                     onChange={(e) => setNote(e.target.value)}
                     className="w-full bg-transparent text-gray-400 focus:outline-none border-b border-gray-700 focus:border-primary pb-1 transition-colors"
                  />
               </div>

               <div className="p-4"><TagPicker value={tags} onChange={setTags} /></div>

               <div className="p-4 space-y-2">
                  <span className="text-white text-base">週期性帳目</span>
                  <div className="flex sf-control rounded-xl p-1">
                     {([
                        ['none', '無'],
                        ['weekly', '每週'],
                        ['biweekly', '每2週'],
                        ['monthly', '每月'],
                     ] as Array<[RecurrenceFrequency | 'none', string]>).map(([value, label]) => (
                        <button
                           key={value}
                           type="button"
                           onClick={() => setRecurrence(value)}
                           className={`flex-1 py-2 rounded-lg text-sm ${recurrence === value ? 'bg-primary text-white' : 'text-gray-400'}`}
                        >
                           {label}
                        </button>
                     ))}
                  </div>
                  {tx.recurrenceSourceId && <p className="text-xs text-gray-500">此帳目由週期設定自動建立；修改只影響本次。</p>}
               </div>

               {/* Receipt Editing */}
               <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-white text-base">收據照片</span>
                     <button onClick={() => fileInputRef.current?.click()} className="text-primary text-sm">
                        {receiptUrl ? '更換' : '新增'}
                     </button>
                  </div>

                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

                  {receiptUrl ? (
                     <div className="relative inline-block mt-2 w-full">
                        <img src={receiptUrl} alt="Receipt" className="h-48 w-full object-cover rounded-lg border border-gray-700 shadow-md" />
                        <button onClick={() => setReceiptUrl(undefined)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
                           <X size={12} className="text-white" />
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 text-sm text-primary mt-1 border border-dashed border-gray-700 rounded-lg hover:bg-surface/50">
                           更換照片
                        </button>
                     </div>
                  ) : (
                     <div onClick={() => fileInputRef.current?.click()} className="h-32 rounded-lg border border-dashed border-gray-600 flex items-center justify-center text-gray-500 cursor-pointer mt-2 bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
                        <Camera size={20} />
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};

export default TransactionDetail;
