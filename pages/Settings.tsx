
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, RefreshCw, FileDown, Upload, CloudOff, Info, CreditCard } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { toLocalYMD } from '../utils/date';
import { forceReloadPwa } from '../utils/pwa';
import { loadCycles } from '../utils/creditCardCycleStorage';
import { getCurrentYearMonth, createOpenCycle } from '../utils/creditCardCycles';
import {
   backupToCsv,
   createBackupFromSnapshot,
   parseBackupCsv,
   parseBackupJson,
} from '../utils/backup';
import { getStorageSnapshot, replaceStorageSnapshot } from '../utils/storage';

const Settings: React.FC = () => {
   const navigate = useNavigate();
   const { resetData, subscriptions, currency, setCurrency, themeColor, setThemeColor, creditCards, storageBackend } = useData();
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
      const backup = createBackupFromSnapshot(getStorageSnapshot(), __APP_VERSION__);
      const blob = new Blob(['\uFEFF' + backupToCsv(backup)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartfinance_backup_${toLocalYMD(new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(url);
   };

   const handleExportJSON = () => {
      const backup = createBackupFromSnapshot(getStorageSnapshot(), __APP_VERSION__);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `smartfinance_backup_${toLocalYMD(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
   };


   // Firebase cloud backup/restore removed: local-only mode

   const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      e.target.value = '';
      if (!selectedFile) return;
      if (selectedFile.size > 10 * 1024 * 1024) {
         alert('匯入失敗：備份檔案不可大過 10MB');
         return;
      }
      selectedFile.text().then(async (text) => {
         const backup = parseBackupJson(text);
         const ok = window.confirm(`將會以備份資料取代目前資料（備份版本 ${backup.backupVersion}）。要繼續嗎？`);
         if (!ok) return;
         await replaceStorageSnapshot(backup.storage);
         alert('JSON 匯入完成，將重新載入資料');
         window.location.reload();
      }).catch((error: unknown) => {
         alert(`匯入失敗：${error instanceof Error ? error.message : '檔案格式錯誤'}`);
      });
   };

   const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      e.target.value = '';
      if (!selectedFile) return;
      if (selectedFile.size > 10 * 1024 * 1024) {
         alert('匯入失敗：備份檔案不可大過 10MB');
         return;
      }
      selectedFile.text().then(async (text) => {
         const backup = parseBackupCsv(text);
         const ok = window.confirm('將會以 CSV 備份取代目前資料。要繼續嗎？');
         if (!ok) return;
         await replaceStorageSnapshot(backup.storage);
         alert('CSV 匯入完成，將重新載入資料');
         window.location.reload();
      }).catch((error: unknown) => {
         alert(`匯入失敗：${error instanceof Error ? error.message : '檔案格式錯誤'}`);
      });
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
                     <span className="text-xs text-gray-500">{storageBackend === 'indexeddb' ? 'IndexedDB' : 'localStorage 後備'}</span>
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
