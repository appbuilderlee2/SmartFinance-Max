import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, ChevronRight, CloudOff, Database, FileDown,
  Info, Palette, RefreshCw, Search, ShieldCheck, Upload, X,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { toLocalYMD } from '../utils/date';
import { forceReloadPwa } from '../utils/pwa';
import {
  backupToCsv,
  createBackupFromSnapshot,
  parseBackupCsv,
  parseBackupJson,
  SmartFinanceBackup,
} from '../utils/backup';
import { getStorageSnapshot, replaceStorageSnapshot } from '../utils/storage';

type Notice = { tone: 'success' | 'warning' | 'info'; text: string } | null;

const ARRAY_KEYS = [
  'smartfinance_transactions', 'smartfinance_categories', 'smartfinance_budgets',
  'smartfinance_subscriptions', 'smartfinance_creditcards', 'smartfinance_creditcard_cycles',
] as const;

const downloadText = (contents: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const countArray = (snapshot: Record<string, string>, key: string): number => {
  try {
    const value = JSON.parse(snapshot[key] || '[]');
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const {
    resetData, currency, setCurrency, themeColor, setThemeColor, storageBackend,
  } = useData();
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [dangerText, setDangerText] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [diagnosticTick, setDiagnosticTick] = useState(0);
  const [versionTapCount, setVersionTapCount] = useState(0);
  const [rewardsUnlocked, setRewardsUnlocked] = useState(false);

  useEffect(() => {
    try { setRewardsUnlocked(localStorage.getItem('sf_rewards_unlocked') === 'true'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!versionTapCount) return;
    const timer = window.setTimeout(() => setVersionTapCount(0), 5000);
    return () => window.clearTimeout(timer);
  }, [versionTapCount]);

  const snapshot = useMemo(() => getStorageSnapshot(), [diagnosticTick]);
  const diagnostics = useMemo(() => {
    const invalidKeys: string[] = [];
    for (const key of ARRAY_KEYS) {
      if (!snapshot[key]) continue;
      try {
        if (!Array.isArray(JSON.parse(snapshot[key]))) invalidKeys.push(key);
      } catch {
        invalidKeys.push(key);
      }
    }
    const bytes = new Blob(Object.entries(snapshot).flat()).size;
    return {
      invalidKeys,
      bytes,
      keys: Object.keys(snapshot).length,
      transactions: countArray(snapshot, 'smartfinance_transactions'),
      budgets: countArray(snapshot, 'smartfinance_budgets'),
      subscriptions: countArray(snapshot, 'smartfinance_subscriptions'),
      cards: countArray(snapshot, 'smartfinance_creditcards'),
    };
  }, [snapshot]);

  const matches = (...terms: string[]) => {
    const normalized = query.trim().toLocaleLowerCase('zh-Hant');
    return !normalized || terms.some(term => term.toLocaleLowerCase('zh-Hant').includes(normalized));
  };

  const exportBackup = (format: 'json' | 'csv', prefix = 'smartfinance_backup') => {
    const backup = createBackupFromSnapshot(getStorageSnapshot(), __APP_VERSION__);
    const date = toLocalYMD(new Date());
    if (format === 'json') {
      downloadText(JSON.stringify(backup, null, 2), `${prefix}_${date}.json`, 'application/json');
    } else {
      downloadText(`\uFEFF${backupToCsv(backup)}`, `${prefix}_${date}.csv`, 'text/csv;charset=utf-8');
    }
    setNotice({ tone: 'success', text: '備份已匯出，請妥善保存檔案。' });
  };

  const restoreParsedBackup = async (backup: SmartFinanceBackup) => {
    const summary = [
      `App 版本：${backup.appVersion}`,
      `交易：${countArray(backup.storage, 'smartfinance_transactions')} 筆`,
      `預算：${countArray(backup.storage, 'smartfinance_budgets')} 項`,
      `訂閱：${countArray(backup.storage, 'smartfinance_subscriptions')} 項`,
      `信用卡：${countArray(backup.storage, 'smartfinance_creditcards')} 張`,
    ].join('\n');
    const mode = window.prompt(`${summary}\n\n輸入「合併」保留現有資料，或輸入「取代」完全還原：`);
    if (mode !== '合併' && mode !== '取代') {
      setNotice({ tone: 'info', text: '已取消還原，現有資料沒有改動。' });
      return;
    }

    // Always give the user a recovery file before any destructive replacement.
    exportBackup('json', 'smartfinance_還原前自動備份');
    const next = mode === '合併'
      ? { ...getStorageSnapshot(), ...backup.storage }
      : backup.storage;
    await replaceStorageSnapshot(next);
    window.alert(`${mode}完成，App 將重新載入。`);
    window.location.reload();
  };

  const importBackup = (format: 'json' | 'csv') => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ tone: 'warning', text: '匯入失敗：備份檔案不可大過 10MB。' });
      return;
    }
    try {
      const text = await file.text();
      await restoreParsedBackup(format === 'json' ? parseBackupJson(text) : parseBackupCsv(text));
    } catch (error) {
      setNotice({ tone: 'warning', text: `匯入失敗：${error instanceof Error ? error.message : '檔案格式錯誤'}` });
    }
  };

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    try {
      if (!navigator.onLine) {
        setNotice({ tone: 'info', text: '目前離線，繼續使用現有快取版本；恢復網絡後會自動檢查。' });
        return;
      }
      const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
      await Promise.all(registrations.map(registration => registration.update()));
      setNotice({ tone: 'success', text: '已完成更新檢查；如有新版，畫面上方會顯示「重新載入」。' });
    } catch {
      setNotice({ tone: 'warning', text: '暫時無法檢查更新，稍後會在背景重試。' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const runIntegrityCheck = () => {
    setDiagnosticTick(value => value + 1);
    setNotice(diagnostics.invalidKeys.length
      ? { tone: 'warning', text: `發現 ${diagnostics.invalidKeys.length} 個資料項目格式異常，請先匯出備份。` }
      : { tone: 'success', text: `資料檢查完成：${diagnostics.keys} 個資料項目格式正常。` });
  };

  const sections = {
    finance: matches('帳務', '信用卡', '訂閱', '分類', '預算', '報表'),
    preferences: matches('個人化', '貨幣', '主題', '外觀', '通知'),
    data: matches('資料', 'IndexedDB', '儲存', '備份', '匯出', '匯入', '還原', '完整性'),
    update: matches('離線', '更新', '快取', '重新載入', '版本'),
    danger: matches('進階', '危險', '清除', '重置', '刪除'),
  };

  return (
    <div className="p-4 pt-safe-top mt-4 space-y-6 pb-28">
      <header className="text-center">
        <h1 className="text-lg font-bold">設定與資料管理中心</h1>
        <p className="text-xs text-gray-500 mt-1">SmartFinance v{__APP_VERSION__}</p>
      </header>

      <label className="sf-panel flex items-center gap-3 px-4 py-3">
        <Search size={18} className="text-gray-500" />
        <input
          aria-label="搜尋設定"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="搜尋設定，例如：備份、貨幣、更新"
          className="bg-transparent flex-1 min-w-0 text-sm text-white placeholder:text-gray-600 outline-none"
        />
        {query ? <button aria-label="清除搜尋" onClick={() => setQuery('')}><X size={17} /></button> : null}
      </label>

      {notice ? (
        <div role="status" className={`rounded-xl border p-3 text-sm ${notice.tone === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-300' : notice.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-blue-500/40 bg-blue-500/10 text-blue-200'}`}>
          {notice.text}
        </div>
      ) : null}

      {!Object.values(sections).some(Boolean) ? (
        <div className="sf-panel p-8 text-center text-gray-400">搵唔到「{query}」相關設定</div>
      ) : null}

      {sections.finance ? (
        <section>
          <h2 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">帳務管理</h2>
          <div className="sf-panel divide-y sf-divider overflow-hidden">
            {[
              ['信用卡管理', '/settings/creditcards'], ['信用卡週期', '/settings/creditcard-cycles'],
              ['訂閱服務', '/subscriptions'], ['分類管理', '/categories'], ['月預算設定', '/budget'], ['報告統計', '/reports'],
              ...(rewardsUnlocked ? [['回贈助手', '/settings/creditcards2']] : []),
            ].map(([label, path]) => (
              <button key={path} onClick={() => navigate(path, path === '/subscriptions' ? { state: { from: '/settings' } } : undefined)} className="w-full p-4 flex items-center justify-between text-white hover:bg-surface/80">
                <span>{label}</span><ChevronRight size={18} className="text-gray-500" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {sections.preferences ? (
        <section>
          <h2 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">個人化</h2>
          <div className="sf-panel divide-y sf-divider overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Database size={17} /><span>主貨幣</span></div>
              <select aria-label="主貨幣" className="bg-transparent text-gray-300 outline-none" value={currency} onChange={event => setCurrency(event.target.value as never)}>
                {['TWD', 'HKD', 'USD', 'AUD', 'CNY', 'JPY', 'EUR', 'GBP'].map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            </div>
            <button onClick={() => navigate('/settings/notifications')} className="w-full p-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><Bell size={17} />通知與提醒</span><ChevronRight size={18} className="text-gray-500" />
            </button>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3"><Palette size={17} /><span>主題</span></div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ['blue', '藍色'], ['red', '紅色'], ['green', '綠色'], ['purple', '紫色'], ['orange', '橙色'],
                  ['pink', '粉紅'], ['ios26', '玻璃'], ['blackgold', '黑金'], ['tech', '科技'], ['light', '淺色'],
                ].map(([value, label]) => (
                  <button key={value} onClick={() => setThemeColor(value)} className={`rounded-lg border px-2 py-3 text-xs ${themeColor === value ? 'border-primary text-primary bg-primary/10' : 'sf-divider text-gray-400'}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sections.data ? (
        <section>
          <h2 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">資料、備份與還原</h2>
          <div className="sf-panel divide-y sf-divider overflow-hidden">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Database size={18} />資料庫狀態</span>
                <span className="text-xs text-green-400">{storageBackend === 'indexeddb' ? 'IndexedDB 正常' : 'localStorage 後備'}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[[diagnostics.transactions, '交易'], [diagnostics.budgets, '預算'], [diagnostics.subscriptions, '訂閱'], [diagnostics.cards, '信用卡']].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-background/60 p-2"><div className="font-semibold">{value}</div><div className="text-[11px] text-gray-500">{label}</div></div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500"><span>{diagnostics.keys} 個資料項目</span><span>約 {formatBytes(diagnostics.bytes)}</span></div>
              <button onClick={runIntegrityCheck} className="w-full rounded-lg border sf-divider py-2 text-sm flex items-center justify-center gap-2"><ShieldCheck size={16} />檢查資料完整性</button>
            </div>
            <div className="grid grid-cols-2 divide-x sf-divider">
              <button onClick={() => exportBackup('json')} className="p-4 flex items-center justify-center gap-2"><FileDown size={16} />匯出 JSON</button>
              <button onClick={() => jsonInputRef.current?.click()} className="p-4 flex items-center justify-center gap-2"><Upload size={16} />還原 JSON</button>
            </div>
            <div className="grid grid-cols-2 divide-x sf-divider">
              <button onClick={() => exportBackup('csv')} className="p-4 flex items-center justify-center gap-2"><FileDown size={16} />匯出 CSV</button>
              <button onClick={() => csvInputRef.current?.click()} className="p-4 flex items-center justify-center gap-2"><Upload size={16} />還原 CSV</button>
            </div>
            <div className="p-4 text-xs text-gray-400 flex gap-2"><CloudOff size={16} className="shrink-0" />資料只儲存於此裝置。還原可選擇合併或取代；操作前會自動匯出復原備份。</div>
          </div>
          <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup('json')} />
          <input ref={csvInputRef} type="file" accept="text/csv,.csv" className="hidden" onChange={importBackup('csv')} />
        </section>
      ) : null}

      {sections.update ? (
        <section>
          <h2 className="text-gray-500 text-xs ml-3 mb-2 uppercase tracking-wider">離線與更新</h2>
          <div className="sf-panel divide-y sf-divider overflow-hidden">
            <button
              className="w-full p-4 flex justify-between"
              title={rewardsUnlocked ? '已解鎖' : `再按 ${Math.max(0, 20 - versionTapCount)} 次解鎖`}
              onClick={() => {
                if (rewardsUnlocked) return;
                const next = versionTapCount + 1;
                if (next < 20) { setVersionTapCount(next); return; }
                try { localStorage.setItem('sf_rewards_unlocked', 'true'); } catch { /* ignore */ }
                setRewardsUnlocked(true);
                setVersionTapCount(0);
                setNotice({ tone: 'success', text: '已解鎖信用卡回贈助手。' });
              }}
            ><span>目前版本</span><span className="text-gray-400">v{__APP_VERSION__}</span></button>
            <div className="p-4 flex justify-between"><span>網絡狀態</span><span className={navigator.onLine ? 'text-green-400' : 'text-amber-300'}>{navigator.onLine ? '已連線' : '離線模式'}</span></div>
            <button disabled={checkingUpdate} onClick={checkUpdate} className="w-full p-4 flex items-center justify-center gap-2 disabled:opacity-60"><RefreshCw size={17} className={checkingUpdate ? 'animate-spin' : ''} />{checkingUpdate ? '檢查中…' : '檢查更新'}</button>
            <button onClick={() => window.location.reload()} className="w-full p-4 flex items-center justify-center gap-2"><RefreshCw size={17} />重新載入 App</button>
            <button onClick={async () => { if (window.confirm('只會清除 App 快取，不會刪除 IndexedDB 財務資料。繼續嗎？')) await forceReloadPwa(); }} className="w-full p-4 flex items-center justify-center gap-2"><RefreshCw size={17} />清除快取並重新載入</button>
          </div>
        </section>
      ) : null}

      {sections.danger ? (
        <section>
          <h2 className="text-red-400/80 text-xs ml-3 mb-2 uppercase tracking-wider">進階及危險操作</h2>
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
            <button onClick={() => setDangerOpen(true)} className="w-full p-4 text-red-300 flex items-center justify-center gap-2"><AlertTriangle size={17} />刪除所有財務資料</button>
          </div>
        </section>
      ) : null}

      <div className="text-center text-xs text-gray-600 flex items-center justify-center gap-1"><Info size={13} />SmartFinance-Max · 本機優先 PWA</div>

      {dangerOpen ? (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="danger-title">
          <div className="sf-panel w-full max-w-md p-5 space-y-4">
            <h2 id="danger-title" className="text-lg font-bold text-red-300">永久刪除所有資料？</h2>
            <p className="text-sm text-gray-300">交易、預算、訂閱及信用卡資料將會刪除。建議先匯出 JSON 備份。</p>
            <label className="block text-xs text-gray-400">輸入「刪除」確認
              <input autoFocus value={dangerText} onChange={event => setDangerText(event.target.value)} className="mt-2 w-full rounded-lg border border-red-500/40 bg-background p-3 text-white outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setDangerOpen(false); setDangerText(''); }} className="rounded-lg border sf-divider p-3">取消</button>
              <button disabled={dangerText !== '刪除'} onClick={async () => { setDangerOpen(false); await resetData(true); }} className="rounded-lg bg-red-600 p-3 text-white disabled:opacity-40">確認刪除</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Settings;
