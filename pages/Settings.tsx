
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, RefreshCw, FileDown, Upload, CloudOff, Info, CreditCard } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { makeId } from '../utils/id';
import { toLocalYMD } from '../utils/date';
import { forceReloadPwa } from '../utils/pwa';
import { loadCycles } from '../utils/creditCardCycleStorage';
import { getCurrentYearMonth, createOpenCycle } from '../utils/creditCardCycles';
import {
   backupToCsv,
   createBackup,
   parseBackupCsv,
   parseBackupJson,
   restoreBackup,
} from '../utils/backup';

const Settings: React.FC = () => {
   const navigate = useNavigate();
   const { resetData, transactions, categories, budgets, subscriptions, currency, setCurrency, themeColor, setThemeColor, creditCards } = useData();

   const categoryById = useMemo(() => {
      return new Map(categories.map(c => [c.id, c] as const));
   }, [categories]);
   const fileInputRef = useRef<HTMLInputElement>(null);
   const csvInputRef = useRef<HTMLInputElement>(null);

   // Easter egg: tap version 20 times to unlock credit card rewards entry.
   const [versionTapCount, setVersionTapCount] = useState(0);
   const [rewardsUnlocked, setRewardsUnlocked] = useState(false);

   useEffect(() => {
      try {
         setRewardsUnlocked(localStorage.getItem('sf_rewards_unlocked') === 'true');
      } catch {
         setRewardsUnlocked(false);
      }
   }, []);

   useEffect(() => {
      if (versionTapCount <= 0) return;
      const t = setTimeout(() => setVersionTapCount(0), 5000);
      return () => clearTimeout(t);
   }, [versionTapCount]);

   // Credit card cycle preview (current month only)
   const ccPreview = useMemo(() => {
      const { year, month0, yearMonth } = getCurrentYearMonth(new Date());
      const cycles = loadCycles();

      return (creditCards || []).map((card) => {
         const id = `ccyc_${card.id}_${yearMonth}`;
         const cycle = cycles.find((c: any) => c.id === id) || createOpenCycle(card as any, year, month0);
         return { card, cycle };
      });
   }, [creditCards]);


   const handleExportCSV = () => {
      {
         const backup = createBackup(localStorage, __APP_VERSION__);
         const blob = new Blob(['\uFEFF' + backupToCsv(backup)], { type: 'text/csv;charset=utf-8' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `smartfinance_backup_${toLocalYMD(new Date())}.csv`;
         link.click();
         URL.revokeObjectURL(url);
         return;
      }

      // Unified CSV headers for full backup (all entities)
      const headers = [
         'recordType', 'ID', 'Name', 'Date', 'TxType', 'CategoryId', 'CategoryName', 'Amount', 'Currency', 'Note', 'Tags',
         'BudgetLimit', 'BudgetSpent',
         'Icon', 'Color', 'CategoryType',
         'BillingCycle', 'NextBillingDate', 'AutoRenewal', 'SubNotes', 'LastProcessedDate',
         'CreditLimit', 'AnnualFee', 'FeeMonth', 'CashbackType', 'ExpiryDate',
         'ThemeColor'
      ];

      const defaultCurrencyCode = currency;

      const txRows = transactions.map(tx => {
         const category = categoryById.get(tx.categoryId);
         const tags = tx.tags ? tx.tags.join(';') : '';
         const dateStr = new Date(tx.date).toISOString();
         const safeNote = `"${(tx.note || '').replace(/"/g, '""')}"`;
         const txCurrency = tx.currency || defaultCurrencyCode;
         return [
            'transaction',
            tx.id,
            '',
            dateStr,
            tx.type,
            tx.categoryId,
            category?.name || 'Unknown',
            tx.amount,
            txCurrency,
            safeNote,
            tags,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
         ].join(',');
      });

      const budgetRows = budgets.map(b => {
         const category = categoryById.get(b.categoryId);
         return [
            'budget',
            `budget-${b.categoryId}`,
            '',
            '',
            '',
            b.categoryId,
            category?.name || 'Unknown',
            '',
            '',
            '',
            '',
            b.limit,
            b.spent,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
         ].join(',');
      });

      const categoryRows = categories.map(c => [
         'category',
         c.id,
         c.name,
         '',
         '',
         c.id,
         c.name,
         '',
         '',
         '',
         '',
         '',
         '',
         c.icon,
         c.color,
         c.type,
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         ''
      ].join(','));

      const subRows = subscriptions.map(s => [
         'subscription',
         s.id,
         s.name,
         '',
         '',
         s.categoryId || '',
         '',
         s.amount,
         defaultCurrencyCode,
         `"${(s.notes || '').replace(/"/g, '""')}"`,
         '',
         '',
         '',
         '',
         '',
         '',
         s.billingCycle,
         s.nextBillingDate,
         s.autoRenewal ? 'true' : 'false',
         s.notes || '',
         s.lastProcessedDate || '',
         '',
         '',
         '',
         '',
         '',
         ''
      ].join(','));

      const cardRows = creditCards.map(c => [
         'creditcard',
         c.id,
         c.name,
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         c.creditLimit ?? '',
         c.annualFee,
         c.feeMonth,
         `"${(c.cashbackType || '').replace(/"/g, '""')}"`,
         c.expiryDate,
         ''
      ].join(','));

      const settingsRow = [
         'setting',
         'app-setting',
         '',
         '',
         '',
         '',
         '',
         '',
         currency,
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         themeColor
      ].join(',');

      const csvContent = [headers.join(','), ...txRows, ...budgetRows, ...categoryRows, ...subRows, ...cardRows, settingsRow].join('\n');

      // Add BOM (\uFEFF) so Excel opens UTF-8 CSV with Chinese characters correctly
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `smartfinance_export_${toLocalYMD(new Date())}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   const handleExportJSON = () => {
      {
         const backup = createBackup(localStorage, __APP_VERSION__);
         const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `smartfinance_backup_${toLocalYMD(new Date())}.json`;
         link.click();
         URL.revokeObjectURL(url);
         return;
      }

      const payload = {
         transactions,
         categories,
         budgets,
         subscriptions,
         currency,
         creditCards,
         themeColor
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartfinance_backup_${toLocalYMD(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
   };

   // Firebase cloud backup/restore removed: local-only mode

   const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      {
         const selectedFile = e.target.files?.[0];
         e.target.value = '';
         if (!selectedFile) return;
         if (selectedFile.size > 10 * 1024 * 1024) {
            alert('匯入失敗：備份檔案不可大過 10MB');
            return;
         }
         selectedFile.text().then((text) => {
            const backup = parseBackupJson(text);
            const ok = window.confirm(`將會以備份資料取代目前資料（備份版本 ${backup.backupVersion}）。要繼續嗎？`);
            if (!ok) return;
            restoreBackup(backup, localStorage);
            alert('JSON 匯入完成，將重新載入資料');
            window.location.reload();
         }).catch((error: unknown) => {
            alert(`匯入失敗：${error instanceof Error ? error.message : '檔案格式錯誤'}`);
         });
         return;
      }

      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
         try {
            const data = JSON.parse(String(evt.target?.result || '{}'));
            if (data.transactions) localStorage.setItem('smartfinance_transactions', JSON.stringify(data.transactions));
            if (data.categories) localStorage.setItem('smartfinance_categories', JSON.stringify(data.categories));
            if (data.budgets) localStorage.setItem('smartfinance_budgets', JSON.stringify(data.budgets));
            if (data.subscriptions) localStorage.setItem('smartfinance_subscriptions', JSON.stringify(data.subscriptions));
            if (data.currency) localStorage.setItem('smartfinance_currency', data.currency);
            if (data.creditCards) localStorage.setItem('smartfinance_creditcards', JSON.stringify(data.creditCards));
            if (data.themeColor) localStorage.setItem('smartfinance_themecolor', data.themeColor);
            alert('匯入完成，將重新載入資料');
            window.location.reload();
         } catch (err) {
            alert('匯入失敗：檔案格式錯誤');
         }
      };
      reader.readAsText(file as File);
   };

   const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
      {
         const selectedFile = e.target.files?.[0];
         e.target.value = '';
         if (!selectedFile) return;
         if (selectedFile.size > 10 * 1024 * 1024) {
            alert('匯入失敗：備份檔案不可大過 10MB');
            return;
         }
         selectedFile.text().then((text) => {
            const backup = parseBackupCsv(text);
            const ok = window.confirm('將會以 CSV 備份取代目前資料。要繼續嗎？');
            if (!ok) return;
            restoreBackup(backup, localStorage);
            alert('CSV 匯入完成，將重新載入資料');
            window.location.reload();
         }).catch((error: unknown) => {
            alert(`匯入失敗：${error instanceof Error ? error.message : '檔案格式錯誤'}`);
         });
         return;
      }

      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
         try {
            const text = String(evt.target?.result || '');
            const lines = text.split(/\r?\n/).filter(Boolean);
            if (!lines.length) throw new Error('empty');
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
            const rtIdx = idx('recordType');
            const idIdx = idx('id');
            const dateIdx = idx('date');
            const txTypeIdx = idx('txtype');
            const catIdIdx = idx('categoryid');
            const catNameIdx = idx('categoryname');
            const amtIdx = idx('amount');
            const noteIdx = idx('note');
            const currencyIdx = idx('currency');
            const tagsIdx = idx('tags');
            const budgetLimitIdx = idx('budgetlimit');
            const budgetSpentIdx = idx('budgetspent');
            const iconIdx = idx('icon');
            const colorIdx = idx('color');
            const catTypeIdx = idx('categorytype');
            const billingIdx = idx('billingcycle');
            const nextBillIdx = idx('nextbillingdate');
            const autoIdx = idx('autorenewal');
            const subNotesIdx = idx('subnotes');
            const lastProcIdx = idx('lastprocesseddate');
            const creditLimitIdx = idx('creditlimit');
            const annualFeeIdx = idx('annualfee');
            const feeMonthIdx = idx('feemonth');
            const cashbackIdx = idx('cashbacktype');
            const expiryIdx = idx('expirydate');
            const themeIdx = idx('themecolor');
            if (idIdx < 0 || (txTypeIdx < 0 && budgetLimitIdx < 0)) throw new Error('headers missing');

            const parseCurrency = (raw: string | undefined) => {
               const v = String(raw || '').trim();
               if (!v) return null;
               const upper = v.toUpperCase();
               if (['TWD','HKD','USD','AUD','CNY','JPY','EUR','GBP'].includes(upper)) return upper;
               // Legacy exports used symbols
               if (v === 'NT$') return 'TWD';
               if (v === 'HK$') return 'HKD';
               if (v === 'A$') return 'AUD';
               if (v === '$') return 'USD';
               if (v === '€') return 'EUR';
               if (v === '£') return 'GBP';
               if (v === '¥') return 'JPY';
               return null;
            };

            const importedTx: any[] = [];
            const importedBudgets: any[] = [];
            const importedCategories: any[] = [];
            const importedSubs: any[] = [];
            const importedCards: any[] = [];
            let importedCurrency: string | null = null;
            let importedTheme: string | null = null;

            lines.slice(1).forEach(row => {
               const cols = row.split(',');
               const recordType = rtIdx >= 0 ? cols[rtIdx]?.toLowerCase() : 'transaction';
               if (recordType === 'budget' || (budgetLimitIdx >= 0 && cols[budgetLimitIdx])) {
                  const catId = catIdIdx >= 0 ? cols[catIdIdx] : '';
                  importedBudgets.push({
                     categoryId: catId,
                     limit: Number(cols[budgetLimitIdx]) || 0,
                     spent: Number(cols[budgetSpentIdx]) || 0
                  });
               } else {
                  if (recordType === 'category') {
                    importedCategories.push({
                      id: cols[idIdx] || makeId('cat'),
                      name: cols[catNameIdx] || cols[idIdx],
                      icon: iconIdx >= 0 ? cols[iconIdx] : 'HelpCircle',
                      color: colorIdx >= 0 ? cols[colorIdx] : 'bg-blue-500',
                      type: catTypeIdx >= 0 ? cols[catTypeIdx] : 'EXPENSE'
                    });
                  } else if (recordType === 'subscription') {
                    importedSubs.push({
                      id: cols[idIdx] || makeId('sub'),
                      name: cols[catNameIdx] || cols[idIdx],
                      amount: Number(cols[amtIdx]) || 0,
                      billingCycle: billingIdx >= 0 ? cols[billingIdx] : 'Monthly',
                      nextBillingDate: nextBillIdx >= 0 ? cols[nextBillIdx] : '',
                      autoRenewal: autoIdx >= 0 ? cols[autoIdx] === 'true' : true,
                      notes: subNotesIdx >= 0 ? cols[subNotesIdx] : '',
                      lastProcessedDate: lastProcIdx >= 0 ? cols[lastProcIdx] : '',
                      categoryId: catIdIdx >= 0 ? cols[catIdIdx] : ''
                    });
                  } else if (recordType === 'creditcard') {
                    importedCards.push({
                      id: cols[idIdx] || makeId('card'),
                      name: cols[catNameIdx] || cols[idIdx],
                      creditLimit: creditLimitIdx >= 0 ? Number(cols[creditLimitIdx]) || 0 : undefined,
                      annualFee: annualFeeIdx >= 0 ? Number(cols[annualFeeIdx]) || 0 : 0,
                      feeMonth: feeMonthIdx >= 0 ? Number(cols[feeMonthIdx]) || 1 : 1,
                      cashbackType: cashbackIdx >= 0 ? cols[cashbackIdx] : '',
                      expiryDate: expiryIdx >= 0 ? cols[expiryIdx] : '',
                      lastFourDigits: ''
                    });
                  } else if (recordType === 'setting') {
                    if (currencyIdx >= 0 && cols[currencyIdx]) importedCurrency = cols[currencyIdx];
                    if (themeIdx >= 0 && cols[themeIdx]) importedTheme = cols[themeIdx];
                  } else {
                    const catId = catIdIdx >= 0
                      ? cols[catIdIdx]
                      : categories.find(c => c.name === cols[catNameIdx])?.id || categories[0]?.id || '';
                    const parsedCurrency = currencyIdx >= 0 ? parseCurrency(cols[currencyIdx]) : null;
                    importedTx.push({
                      id: cols[idIdx] || makeId('tx'),
                      date: dateIdx >= 0 ? new Date(((cols[dateIdx] || '').trim()) + 'T00:00:00').toISOString() : new Date().toISOString(),
                      type: txTypeIdx >= 0 ? cols[txTypeIdx] : 'EXPENSE',
                      categoryId: catId,
                      amount: Number(cols[amtIdx]) || 0,
                      note: noteIdx >= 0 ? cols[noteIdx]?.replace(/^"|"$/g, '') : '',
                      tags: tagsIdx >= 0 && cols[tagsIdx] ? cols[tagsIdx].split(';') : [],
                      currency: parsedCurrency || undefined
                    });
                  }
               }
            });
            if (!importedTx.length && !importedBudgets.length) throw new Error('no rows');
            if (importedTx.length) localStorage.setItem('smartfinance_transactions', JSON.stringify(importedTx));
            if (importedBudgets.length) localStorage.setItem('smartfinance_budgets', JSON.stringify(importedBudgets));
            if (importedCategories.length) localStorage.setItem('smartfinance_categories', JSON.stringify(importedCategories));
            if (importedSubs.length) localStorage.setItem('smartfinance_subscriptions', JSON.stringify(importedSubs));
            if (importedCards.length) localStorage.setItem('smartfinance_creditcards', JSON.stringify(importedCards));
            if (importedCurrency) localStorage.setItem('smartfinance_currency', importedCurrency);
            if (importedTheme) localStorage.setItem('smartfinance_themecolor', importedTheme);
            alert('CSV 匯入完成，將重新載入（交易與預算）');
            window.location.reload();
         } catch (err) {
            alert('匯入失敗：請確認欄位包含 ID,Date,TxType/Category/Amount 或 BudgetLimit');
         }
      };
      reader.readAsText(file as File);
   };

   return (
      <div className="p-4 pt-safe-top mt-4 space-y-8 pb-24">
         <header className="text-center mb-6">
            <h1 className="text-lg font-bold">設定</h1>
         </header>

         {/* 帳務管理 */}
         <div>
            <h3 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">帳務管理</h3>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/settings/creditcards')}>
                  <span className="text-white">信用卡管理</span>
                  <ChevronRight className="text-gray-500" size={18} />
               </div>
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/settings/creditcard-cycles')}>
                  <span className="text-white">信用卡週期</span>
                  <ChevronRight className="text-gray-500" size={18} />
               </div>

               {/* Credit card cycle preview (current month only) — placed right under credit card cycles */}
               <div className="bg-background px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                     <p className="text-xs text-gray-500">信用卡週期（本月預覽）</p>
                     <button
                        type="button"
                        onClick={() => navigate('/settings/creditcard-cycles')}
                        className="text-xs text-primary"
                     >
                        查看
                     </button>
                  </div>


                  {ccPreview.length ? (
                     ccPreview.map(({ card, cycle }) => (
                        <div key={card.id} className="flex items-center justify-between text-xs text-gray-200 gap-2">
                           <div className="flex items-center gap-2 min-w-0">
                              <CreditCard size={14} className="text-gray-400" />
                              <span className="truncate">{card.name}</span>
                           </div>
                           <div className="shrink-0 text-right">
                              <span className={cycle.status === 'closed' ? 'text-green-400' : 'text-yellow-400'}>
                                 {cycle.status}
                              </span>
                              <span className="text-gray-500"> · </span>
                              <span className="text-gray-200">
                                 應繳 {typeof cycle.amountDue === 'number' ? cycle.amountDue : '-'}
                              </span>
                           </div>
                        </div>
                     ))
                  ) : (
                     <p className="text-xs text-gray-500">未有信用卡</p>
                  )}

               </div>

               {rewardsUnlocked && (
                  <>
                     <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors"
                        onClick={() => window.open('https://www.swipewhich.com', '_blank', 'noopener,noreferrer')}
                     >
                        <span className="text-white">信用卡回贈</span>
                        <ChevronRight className="text-gray-500" size={18} />
                     </div>

                     <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors"
                        onClick={() => navigate('/settings/creditcards2')}
                     >
                        <span className="text-white">回贈助手</span>
                        <ChevronRight className="text-gray-500" size={18} />
                     </div>
                  </>
               )}

               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/subscriptions', { state: { from: '/settings' } })}>
                  <span className="text-white">訂閱服務</span>
                  <ChevronRight className="text-gray-500" size={18} />
               </div>

               {/* Upcoming subscription preview */}
               <div className="bg-background px-4 py-3 space-y-2 border-t sf-divider">
                  <p className="text-xs text-gray-500">最近扣款</p>
                  {subscriptions
                     .filter(s => s.nextBillingDate && new Date(s.nextBillingDate) >= new Date(new Date().toDateString()))
                     .sort((a, b) => new Date(a.nextBillingDate!).getTime() - new Date(b.nextBillingDate!).getTime())
                     .slice(0, 3)
                     .map(sub => {
                        const daysLeft = Math.ceil((new Date(sub.nextBillingDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        return (
                           <div key={sub.id} className="flex items-center justify-between text-xs text-gray-200">
                              <span className="truncate">{sub.name}</span>
                              <span className="text-primary">剩餘 {daysLeft} 天</span>
                           </div>
                        );
                     })}
                  {subscriptions.filter(s => s.nextBillingDate).length === 0 && (
                     <p className="text-xs text-gray-500">無預定扣款</p>
                  )}
               </div>
            </div>
         </div>

         {/* 主要設定 */}
         <div>
            <h3 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">主要設定</h3>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/categories')}>
                  <span className="text-white">分類管理</span>
                  <ChevronRight className="text-gray-500" size={18} />
               </div>
               {/* Currency Selector */}
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors">
                  <span className="text-white">主貨幣</span>
                  <select
                     className="bg-transparent text-right text-gray-400 focus:outline-none cursor-pointer"
                     value={currency}
                     onChange={(e) => setCurrency(e.target.value as any)}
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
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/budget')}>
                  <span className="text-white">月預算設定</span>
                  <ChevronRight className="text-gray-500" size={18} />
               </div>
            </div>
         </div>

         {/* 進階功能 */}
         <div>
            <h3 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">進階功能</h3>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/settings/notifications')}>
                  <span className="text-white">通知提醒</span>
                  <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-400">開啟</span>
                     <ChevronRight className="text-gray-500" size={18} />
                  </div>
               </div>
               <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors" onClick={() => navigate('/reports')}>
                  <span className="text-white">報告統計</span>
                  <ChevronRight className="text-gray-500" size={18} />
               </div>
            </div>
         </div>

         {/* Theme Color Section */}
         <div>
            <h3 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">外觀設定</h3>
            <div className="sf-panel overflow-hidden">
               <div className="p-4">
                  <span className="text-white text-sm mb-3 block">主題顏色</span>
                  <div className="flex gap-2 flex-wrap">
                     {(['blue', 'red', 'green', 'purple', 'orange', 'pink'] as const).map(color => (
                        <button
                           key={color}
                           onClick={() => setThemeColor(color)}
                           className={`w-8 h-8 rounded-full transition-all ${color === 'blue' ? 'bg-blue-500' :
                                 color === 'red' ? 'bg-red-500' :
                                    color === 'green' ? 'bg-green-500' :
                                       color === 'purple' ? 'bg-purple-500' :
                                          color === 'orange' ? 'bg-orange-500' :
                                             'bg-pink-500'
                              } ${themeColor === color ? 'ring-2 ring-white scale-110' : ''}`}
                        />
                     ))}
                  </div>
               </div>
               <div className="border-t sf-divider p-4">
                  <span className="text-white text-sm mb-3 block">主題風格</span>
                  <div className="grid grid-cols-2 gap-2">
                     <button
                        onClick={() => setThemeColor('ios26')}
                        className={`p-3 rounded-xl text-center transition-all ${themeColor === 'ios26' ? 'ring-2 ring-primary' : ''}`}
                        style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(15,23,42,0.8))' }}
                     >
                        <span className="text-xs text-white">iOS26 玻璃</span>
                     </button>
                     <button
                        onClick={() => setThemeColor('blackgold')}
                        className={`p-3 rounded-xl text-center transition-all bg-black ${themeColor === 'blackgold' ? 'ring-2 ring-yellow-500' : ''}`}
                     >
                        <span className="text-xs text-yellow-500">黑金</span>
                     </button>
                     <button
                        onClick={() => setThemeColor('tech')}
                        className={`p-3 rounded-xl text-center transition-all ${themeColor === 'tech' ? 'ring-2 ring-primary' : ''}`}
                        style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(3,7,18,0.95))' }}
                     >
                        <span className="text-xs text-white">科技感</span>
                     </button>
                     <button
                        onClick={() => setThemeColor('light')}
                        className={`p-3 rounded-xl text-center transition-all bg-white ${themeColor === 'light' ? 'ring-2 ring-blue-500' : ''}`}
                     >
                        <span className="text-xs text-gray-800">淺色</span>
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Section 2 */}
         <div>
            <h3 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">模式</h3>
            <div className="sf-panel overflow-hidden divide-y sf-divider">
               <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        <CloudOff size={16} />
                     </div>
                     <span className="text-sm text-gray-300">本機模式（無登入／無雲端）</span>
                  </div>
               </div>

               {/* Version (tap 20x easter egg) */}
               <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface/80 active:bg-gray-700/50 transition-colors"
                  onClick={() => {
                     if (rewardsUnlocked) return;
                     const next = versionTapCount + 1;
                     setVersionTapCount(next);
                     if (next >= 20) {
                        try {
                           localStorage.setItem('sf_rewards_unlocked', 'true');
                        } catch {
                           // ignore
                        }
                        setRewardsUnlocked(true);
                        setVersionTapCount(0);
                        alert('已解鎖：信用卡回贈');
                     }
                  }}
                  title={rewardsUnlocked ? '已解鎖' : `再按 ${Math.max(0, 20 - versionTapCount)} 次解鎖`}
               >
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        <Info size={16} />
                     </div>
                     <span className="text-sm text-gray-300">版本</span>
                     {!rewardsUnlocked && versionTapCount > 0 && (
                        <span className="text-xs text-gray-500">（{versionTapCount}/20）</span>
                     )}
                     {rewardsUnlocked && (
                        <span className="text-xs text-primary">（已解鎖）</span>
                     )}
                  </div>
                  <span className="text-sm text-gray-400">{__APP_VERSION__}</span>
               </div>
            </div>
         </div>

         {/* Section 3 */}
         <div>
            <h3 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">資料管理</h3>
            <div className="sf-panel divide-y sf-divider overflow-hidden">
               <div className="grid grid-cols-2 gap-0 divide-x sf-divider">
                  <button onClick={handleExportJSON} className="p-4 text-white flex items-center justify-center gap-2 hover:bg-surface/80">
                     <FileDown size={16} /> 匯出 JSON
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-4 text-white flex items-center justify-center gap-2 hover:bg-surface/80">
                     <Upload size={16} /> 匯入 JSON
                  </button>
                  <input
                     ref={fileInputRef}
                     type="file"
                     accept="application/json"
                     className="hidden"
                     onChange={handleImport}
                  />
               </div>
               <div className="grid grid-cols-2 gap-0 divide-x sf-divider">
                  <button onClick={handleExportCSV} className="p-4 text-white flex items-center justify-center gap-2 hover:bg-surface/80">
                     <FileDown size={16} /> 匯出 CSV
                  </button>
                  <button onClick={() => csvInputRef.current?.click()} className="p-4 text-white flex items-center justify-center gap-2 hover:bg-surface/80">
                     <Upload size={16} /> 匯入 CSV
                  </button>
                  <input
                     ref={csvInputRef}
                     type="file"
                     accept=".csv,text/csv"
                     className="hidden"
                     onChange={handleImportCSV}
                  />
               </div>
               <div className="sf-panel p-4 text-gray-300 text-sm flex items-start gap-2">
                  <CloudOff size={16} className="mt-0.5" />
                  <div>
                     <div className="font-semibold text-gray-100">本機模式</div>
                     <div className="text-gray-400">資料只儲存喺本機（無登入／無雲端備份）。建議定期匯出 JSON/CSV 自己留底。</div>
                  </div>
               </div>
               <button
                  type="button"
                  onClick={async () => {
                     const ok = window.confirm('將會清除 PWA 快取並重新載入（不會刪除你的記帳資料）。要繼續嗎？');
                     if (!ok) return;
                     await forceReloadPwa();
                  }}
                  className="w-full p-4 text-white text-center hover:bg-surface/80 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
               >
                  <RefreshCw size={18} /> 清除快取並重新載入
               </button>

               <button onClick={resetData} className="w-full p-4 text-red-400 text-center hover:bg-surface/80 active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                  <RefreshCw size={18} /> 重置所有資料 (Reset)
               </button>
            </div>
         </div>
      </div>
   );
};

export default Settings;
