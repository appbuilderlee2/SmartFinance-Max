import { captureDeletion, restoreDeletion, type DeletedTransaction } from '../utils/transactionUndo';
import { BACKUP_EXPORT_MARKER } from '../utils/backupReminder';
import { clearEntryDraft } from '../utils/entryDraft';
import { writeJson } from '../utils/storage';
import { renameTransactionTags, tagKey, normalizeTag, uniqueTags } from '../utils/tags';
import { loadTagHistory } from '../utils/tagHistory';
import { observeLocalDay } from '../utils/dayBoundary';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, Category, Budget, Subscription, TransactionType, Currency } from '../types';
import { CATEGORIES } from '../constants';
import {
  clearStorageData, flushStorage, retryStorage, getSaveStatus,
  initializeStorage,
  readJson,
  readText,
  reportStorageError,
  StorageBackend,
  writeCoreData,
  writeText,
} from '../utils/storage';
import { makeId } from '../utils/id';
import { ensureSchemaVersion } from '../utils/storageVersion';
import { parseDate, isSameMonth, toLocalYMD } from '../utils/date';
import { canUseReplacement, getCategoryUsage, reassignCategoryReferences } from '../utils/categoryIntegrity';
import { processDueSubscriptions } from '../utils/subscriptionProcessing';
import { fromMinorUnits, toMinorUnits } from '../utils/money';
import { processDueRecurringTransactions, removeRecurringOccurrence } from '../utils/recurringTransactions';
import { resetSecurityCache } from '../utils/security';
import { loadCycles, migrateCreditCardCurrencies, saveCycles } from '../utils/creditCardCycleStorage';
import { showAppAlert, showAppConfirm } from '../utils/appDialog';

export interface CreditCard {
  id: string;
  name: string;
  lastFourDigits?: string;
  annualFee: number;
  feeMonth?: number;
  cashbackType: string;
  expiryDate: string;
  creditLimit?: number;
  imageUrl?: string;
  rewardCategories?: string[];
  currency?: Currency; // Independent card currency; legacy cards are migrated to the then-current main currency.

  // Billing cycle dates (day of month, 1-31). Optional.
  statementDay?: number; // 截數日
  dueDay?: number; // 繳費日
  dueInNextMonth?: boolean; // 繳費日是否屬於截數後下一個月

  // Reminder toggles (optional; default on when dates are set)
  remindStatement?: boolean;
  remindDue?: boolean;
}

export type ThemeName = string;

const normalizeCategories = (cats: Category[]): Category[] => {
  const sorted = [...cats].sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) return nameCompare;
    return a.id.localeCompare(b.id);
  });

  return sorted.map((c, idx) => ({ ...c, order: idx + 1 }));
};

interface DataContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  subscriptions: Subscription[];
  currency: Currency;
  creditCards: CreditCard[];
  themeColor: ThemeName;
  storageBackend: StorageBackend;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  saveTransaction: (tx: Transaction) => Promise<void>;
  saveEditedTransaction: (id: string, fields: Partial<Transaction>) => Promise<void>;
  saveBudgetLimit: (categoryId: string, limit: number) => Promise<void>;
  saveCreditCardChange: (card: CreditCard) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  renameTag: (source: string, target: string) => void;
  addSubscription: (sub: Omit<Subscription, 'id'>) => void;
  updateSubscription: (id: string, updates: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  getCategory: (id: string) => Category | undefined;
  addBudget: (budget: Omit<Budget, 'spent'>) => void;
  deleteBudget: (categoryId: string) => void;
  updateBudget: (categoryId: string, limit: number) => void;
  deleteCategory: (id: string, replacementId?: string) => boolean;
  addCategory: (cat: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  reorderCategories: (type: TransactionType, orderedIds: string[]) => void;
  setCurrency: (c: Currency) => void;
  addCreditCard: (card: CreditCard) => void;
  deleteCreditCard: (id: string) => void;
  updateCreditCard: (id: string, updates: Partial<CreditCard>) => void;
  setCreditCards: (cards: CreditCard[]) => void;
  setThemeColor: (color: ThemeName) => void;
  resetData: (confirmed?: boolean) => Promise<void>;
}

type LedgerData = Pick<DataContextType, 'transactions' | 'categories' | 'budgets' | 'currency' | 'getCategory'> & { byMonth: Map<string, Transaction[]> };
const LedgerContext = createContext<LedgerData>(null!);
export const useLedger = () => useContext(LedgerContext);

const DataContext = createContext<DataContextType>({} as DataContextType);

export const useData = () => useContext(DataContext);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [today, setToday] = useState(() => toLocalYMD(new Date()));
  useEffect(() => observeLocalDay(setToday), []);
  const DEFAULT_THEME: ThemeName = 'blue';
  const normalizeThemeName = (value: unknown): ThemeName => {
    if (typeof value !== 'string') return DEFAULT_THEME;
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_THEME;
    // v2.4 compatibility: the original Apple Fluid theme was dark-only.
    if (trimmed === 'applefluid') return 'applefluid-dark';
    // Only allow safe class suffixes (matches `.theme-xxx` blocks in CSS)
    if (!/^[a-z0-9-]+$/i.test(trimmed)) return DEFAULT_THEME;
    return trimmed;
  };

  const [loadError, setLoadError] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [storageBackend, setStorageBackend] = useState<StorageBackend>('indexeddb');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const saveWaiters = useRef(new Map<string, { row: Transaction; resolve: (ok: boolean) => void }>());
  const changeWaiters = useRef<Array<(ok: boolean) => void>>([]);
  const [changeRevision, setChangeRevision] = useState(0);
  const [deleted, setDeleted] = useState<DeletedTransaction | null>(null);
  const [undoError, setUndoError] = useState('');
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [currency, setCurrencyState] = useState<Currency>(Currency.HKD);

  const getTxCurrency = (t: Transaction): Currency => (t.currency as Currency) || currency;

  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [themeColor, setThemeColorState] = useState<ThemeName>(DEFAULT_THEME);

  // Run existing localStorage schema upgrades before the one-time IndexedDB copy.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        ensureSchemaVersion();
      } catch (error) {
        reportStorageError('schema-migration', error);
      }
      let result;
      try { result = await initializeStorage(); }
      catch (error) { if (active) setLoadError(error instanceof Error ? error.message : '資料庫載入失敗'); return; }
      if (!active) return;
      setTransactions(readJson<Transaction[]>('smartfinance_transactions') ?? []);
      setCategories(normalizeCategories(readJson<Category[]>('smartfinance_categories') ?? CATEGORIES));
      setBudgets(readJson<Budget[]>('smartfinance_budgets') ?? []);
      setSubscriptions(readJson<Subscription[]>('smartfinance_subscriptions') ?? []);
      const loadedCurrency = (readText('smartfinance_currency') as Currency) || Currency.HKD;
      const migration = migrateCreditCardCurrencies(readJson<CreditCard[]>('smartfinance_creditcards') ?? [], loadCycles(), loadedCurrency);
      setCurrencyState(loadedCurrency);
      setCreditCards(migration.cards);
      if (migration.changed) saveCycles(migration.cycles);
      setThemeColorState(normalizeThemeName(readText('smartfinance_themecolor')));
      setStorageBackend(result.backend);
      setStorageReady(true);
    })();
    return () => { active = false; };
  }, []);

  // Related entity changes commit in one database transaction.
  useEffect(() => {
    if (!storageReady) return;
    const waiters = [...saveWaiters.current.entries()].filter(([, item]) => transactions.includes(item.row));
    const changes = changeWaiters.current.splice(0);
    void writeCoreData(transactions, {
      smartfinance_categories: JSON.stringify(categories),
      smartfinance_budgets: JSON.stringify(budgets),
      smartfinance_subscriptions: JSON.stringify(subscriptions),
      smartfinance_creditcards: JSON.stringify(creditCards),
      smartfinance_currency: currency,
    }).then(ok => { for (const [id, waiter] of waiters) { if (saveWaiters.current.get(id) === waiter) { saveWaiters.current.delete(id); waiter.resolve(ok); } } changes.forEach(resolve => resolve(ok)); });
  }, [storageReady, transactions, categories, budgets, subscriptions, creditCards, currency, changeRevision]);

  // Budget Spending Logic (recalculate spent whenever transactions/categories/currency change)
  // Improvement: avoid JSON.stringify object-wide compare and reduce repeated date parsing.
  useEffect(() => {
    if (!storageReady) return;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1) Ensure every category has a budget row
    const existingBudgetIds = new Set(budgets.map(b => b.categoryId));
    const missingBudgets = categories
      .filter(c => !existingBudgetIds.has(c.id))
      .map(c => ({ categoryId: c.id, limit: 0, spent: 0 }));

    const baseBudgets = missingBudgets.length ? [...budgets, ...missingBudgets] : budgets;

    // 2) Pre-compute spending per category for this month
    const spentByCategory = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== TransactionType.EXPENSE) continue;
      if (getTxCurrency(t) !== currency) continue;
      const dt = parseDate(t.date);
      if (!dt) continue;
      if (!isSameMonth(dt, currentMonth, currentYear)) continue;
      const prev = spentByCategory.get(t.categoryId) || 0;
      spentByCategory.set(t.categoryId, prev + toMinorUnits(Number(t.amount) || 0, currency));
    }

    // 3) Compute next budgets and apply only if changed
    let changed = missingBudgets.length > 0;
    const nextBudgets = baseBudgets.map((b) => {
      const spent = fromMinorUnits(spentByCategory.get(b.categoryId) || 0, currency);
      if (b.spent !== spent) changed = true;
      return { ...b, spent };
    });

    if (changed) setBudgets(nextBudgets);
  }, [storageReady, transactions, categories, currency, today]);

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...tx,
      id: makeId('tx'),
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const saveTransaction = async (row: Transaction) => {
    if (saveWaiters.current.has(row.id)) throw new Error('帳目正在儲存');
    if (getSaveStatus() === 'error') await retryStorage();
    await flushStorage();
    const committed = new Promise<boolean>(resolve => saveWaiters.current.set(row.id, { row, resolve }));
    setTransactions(previous => [row, ...previous.filter(tx => tx.id !== row.id)]);
    if (!await committed) throw new Error('儲存失敗，輸入已保留。請重試。');
    await flushStorage();
  };

  const persistCoreChange = async (change: () => void) => {
    if (getSaveStatus() === 'error') await retryStorage();
    await flushStorage();
    const committed = new Promise<boolean>(resolve => changeWaiters.current.push(resolve));
    change();
    setChangeRevision(previous => previous + 1);
    if (!await committed) throw new Error('儲存失敗，請重試。');
    await flushStorage();
  };
  const saveEditedTransaction = (id: string, fields: Partial<Transaction>) =>
    persistCoreChange(() => updateTransaction(id, fields));
  const saveBudgetLimit = (id: string, limit: number) =>
    persistCoreChange(() => updateBudget(id, limit));
  const saveCreditCardChange = (card: CreditCard) =>
    persistCoreChange(() => setCreditCards(previous => {
      const index = previous.findIndex(item => item.id === card.id);
      if (index < 0) return [...previous, card];
      return previous.map(item => item.id === card.id ? { ...item, ...card } : item);
    }));

  const renameTag = (source: string, target: string) => {
    const name = normalizeTag(target);
    if (!name) return;
    setTransactions(previous => renameTransactionTags(previous, source, name));
    writeJson('sf.tagHistory.v1', { mru: uniqueTags(loadTagHistory().map(tag => tagKey(tag) === tagKey(source) ? name : tag)) });
  };

  const updateTransaction = (id: string, updatedFields: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
  };

  const deleteTransaction = (id: string) => {
    setDeleted(captureDeletion(transactions, id)); setUndoError('');
    setTransactions(prev => removeRecurringOccurrence(prev, id));
  };

  const addSubscription = (sub: Omit<Subscription, 'id'>) => {
    const newSub = { ...sub, id: makeId('sub') };
    setSubscriptions(prev => [...prev, newSub]);
  };

  const getCategory = (id: string) => categories.find(c => c.id === id);

  const updateBudget = (categoryId: string, limit: number) => {
    setBudgets(prev => prev.map(b => b.categoryId === categoryId ? { ...b, limit } : b));
  };

  const addBudget = (budget: Omit<Budget, 'spent'>) => {
    const newBudget = { ...budget, spent: 0 };
    setBudgets(prev => [...prev, newBudget]);
  };

  const deleteBudget = (categoryId: string) => {
    setBudgets(prev => prev.filter(b => b.categoryId !== categoryId));
  };

  const updateSubscription = (id: string, updates: Partial<Subscription>) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSubscription = (id: string) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const deleteCategory = (id: string, replacementId?: string): boolean => {
    const source = categories.find((category) => category.id === id);
    if (!source) return false;
    const usage = getCategoryUsage(id, transactions, subscriptions, budgets);
    const isUsed = usage.transactionCount > 0 || usage.subscriptionCount > 0 || usage.hasBudget;

    if (isUsed) {
      const replacement = categories.find((category) => category.id === replacementId);
      if (!canUseReplacement(source, replacement)) return false;
      const reassigned = reassignCategoryReferences(
        id,
        replacement!.id,
        transactions,
        subscriptions,
        budgets,
        currency,
      );
      setTransactions(reassigned.transactions);
      setSubscriptions(reassigned.subscriptions);
      setBudgets(reassigned.budgets);
    } else {
      setBudgets((previous) => previous.filter((budget) => budget.categoryId !== id));
    }

    setCategories((previous) => previous.filter((category) => category.id !== id));
    return true;
  };

  const addCategory = (cat: Category) => {
    setCategories(prev => normalizeCategories([...prev, cat]));
    // Budget will be synced by the useEffect, but we can add it here optimistically if we want,
    // but the useEffect covering 'categories' change will handle it.
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const reorderCategories = (type: TransactionType, orderedIds: string[]) => {
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, idx) => {
      orderMap.set(id, idx + 1);
    });
    setCategories(prev => prev.map(c => {
      if (c.type !== type) return c;
      const nextOrder = orderMap.get(c.id);
      if (!nextOrder) return c;
      return { ...c, order: nextOrder };
    }));
  };

  const addCreditCard = (card: CreditCard) => {
    setCreditCards(prev => [...prev, card]);
  };

  const deleteCreditCard = (id: string) => {
    setCreditCards(prev => prev.filter(c => c.id !== id));
  };

  const updateCreditCard = (id: string, updates: Partial<CreditCard>) => {
    setCreditCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const resetData = async (confirmed = false) => {
    if (!confirmed && !await showAppConfirm('這將清除交易、訂閱、信用卡及其他本機紀錄。此操作無法復原。', { title: '重置所有資料？', confirmLabel: '重置資料', destructive: true })) return;

    try {
      await clearStorageData();
      if (!await clearEntryDraft()) reportStorageError('entry-draft-reset', new Error('草稿未能清除'));
      try { localStorage.removeItem(BACKUP_EXPORT_MARKER); } catch { /* UI marker only */ }
      setDeleted(null);
      resetSecurityCache();
    } catch {
      await showAppAlert('資料未能重置，請先處理儲存錯誤。'); return;
    }

    // Also clear any app caches / stale service worker state (best-effort).
    // IMPORTANT: Do NOT unregister other apps' service workers on the same origin.
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys
            .filter((k) => k.startsWith('smartfinance-') || k.startsWith('smartfinance'))
            .forEach((k) => caches.delete(k));
        });
      }

      // Unregister only service workers whose scope looks like this app (best-effort).
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => {
            const scope = r.scope || '';
            // Only unregister OUR service worker (service-worker.js) if it is controlling
            // a scope that looks like this app. Avoid touching other SW registrations.
            if (scope.endsWith('/dist/') || scope.endsWith('/SmartFinance/')) {
              const sw: any = r.active || r.waiting || r.installing;
              const scriptUrl: string = sw?.scriptURL || '';
              if (scriptUrl.includes('service-worker.js')) {
                r.unregister();
              }
            }
          });
        });
      }
    } catch {
      // ignore
    }

    // Reset in-memory state to truly empty, so "記錄" 不會殘留舊資料
    // (and avoid subscription auto-post creating new transactions immediately).
    setTransactions([]);
    setCategories(CATEGORIES);
    setBudgets([]); // will be auto-synced to categories with limit 0
    setSubscriptions([]);
    setCurrencyState(Currency.HKD);
    setCreditCards([]);
    setThemeColorState('blue');

    await showAppAlert('資料已重置');
  };

  // Persistence and application of theme (UI skin)
  useEffect(() => {
    if (!storageReady) return;
    const normalized = normalizeThemeName(themeColor);
    writeText('smartfinance_themecolor', normalized);
    const root = document.documentElement;
    const systemScheme = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      for (const className of Array.from(root.classList)) {
        if (className.startsWith('theme-')) root.classList.remove(className);
      }

      const resolved = normalized === 'applefluid-system'
        ? `applefluid-${systemScheme.matches ? 'dark' : 'light'}`
        : normalized;
      root.classList.add(`theme-${resolved}`);
      root.dataset.sfTheme = normalized;
      root.dataset.sfResolvedTheme = resolved;

      if (resolved === 'light' || resolved === 'applefluid-light') root.classList.remove('dark');
      else root.classList.add('dark');
    };

    applyTheme();
    if (normalized !== 'applefluid-system') return;
    systemScheme.addEventListener('change', applyTheme);
    return () => systemScheme.removeEventListener('change', applyTheme);
  }, [storageReady, themeColor]);

  // Auto-create expense transactions for due subscriptions
  // Guardrail: avoid tight loops / double processing when this effect updates state.
  const isAutoPostingRef = useRef(false);
  useEffect(() => {
    if (!storageReady) return;
    if (isAutoPostingRef.current) return;
    if (!subscriptions.length) return;

    const result = processDueSubscriptions({
      subscriptions,
      transactions,
      categories,
      defaultCurrency: currency,
      makeTransactionId: () => makeId('tx'),
    });

    if (result.transactions.length || result.changed) {
      // Mark this run as “mutating” to prevent immediate re-entry.
      isAutoPostingRef.current = true;
    }

    if (result.transactions.length) {
      setTransactions(prev => [...result.transactions, ...prev]);
    }
    if (result.changed) {
      setSubscriptions(result.subscriptions);
    }

    if (result.transactions.length || result.changed) {
      // Release guard on next tick.
      setTimeout(() => { isAutoPostingRef.current = false; }, 0);
    }
  }, [storageReady, subscriptions, categories, transactions, currency, today]);

  // Generate due occurrences for transactions configured as weekly,
  // biweekly or monthly. The pure processor records source/date identity so
  // repeated effects, reloads and React StrictMode cannot double-post them.
  useEffect(() => {
    if (!storageReady) return;
    const result = processDueRecurringTransactions({
      transactions,
      makeTransactionId: () => makeId('tx'),
    });
    if (!result.changed) return;

    setTransactions((previous) => {
      const existing = new Set(previous.flatMap((transaction) => {
        if (!transaction.recurrenceSourceId) return [];
        const date = parseDate(transaction.date);
        return date ? [`${transaction.recurrenceSourceId}:${toLocalYMD(date)}`] : [];
      }));
      const missing = result.transactions.filter((transaction) => {
        const date = parseDate(transaction.date);
        const key = date && transaction.recurrenceSourceId
          ? `${transaction.recurrenceSourceId}:${toLocalYMD(date)}`
          : '';
        if (!key || existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      return missing.length ? [...missing, ...previous] : previous;
    });
  }, [storageReady, transactions, today]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  const categoryMap = useMemo(() => new Map(sortedCategories.map(category => [category.id, category])), [sortedCategories]);
  const byMonth = useMemo(() => {
    const byMonth = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const date = parseDate(tx.date);
      if (!date) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const rows = byMonth.get(key) || [];
      rows.push(tx); byMonth.set(key, rows);
    }
    return byMonth;
  }, [transactions]);
  const ledger = useMemo<LedgerData>(() => ({
    transactions, categories: sortedCategories, budgets, currency, byMonth, getCategory: id => categoryMap.get(id),
  }), [transactions, sortedCategories, budgets, currency, byMonth, categoryMap]);

  if (loadError) return <div role="alert" className="p-6">{loadError}<button className="block p-3" onClick={() => window.location.reload()}>重新載入</button></div>;
  if (!storageReady) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">正在載入本機資料庫…</div>;
  }

  return (
    <DataContext.Provider value={{
      transactions,
      categories: sortedCategories,
      budgets,
      subscriptions,
      currency,
      creditCards,
      themeColor,
      storageBackend,
      addTransaction, saveTransaction, saveEditedTransaction, saveBudgetLimit, saveCreditCardChange,
      deleteTransaction,
      updateTransaction,
      renameTag,
      getCategory,
      addCategory,
      deleteCategory,
      updateCategory,
      reorderCategories,
  addBudget,
  deleteBudget,
  updateBudget,
      addSubscription,
      deleteSubscription,
      updateSubscription,
      setCurrency: setCurrencyState,
      resetData,
      addCreditCard,
      deleteCreditCard,
      updateCreditCard,
      setCreditCards,
      setThemeColor: setThemeColorState
    }}>
      <LedgerContext.Provider value={ledger}>{children}</LedgerContext.Provider>
      {deleted && <div role="status" className="sf-undo-toast">
        <span>{undoError || '帳目已移除'}</span>
        <button onClick={() => {
          if (!categories.some(cat => cat.id === deleted.row.categoryId)) { setUndoError('原分類已移除，請先還原分類再復原帳目'); return; }
          setTransactions(previous => restoreDeletion(previous, deleted)); setDeleted(null);
        }}>復原</button>
        <button aria-label="關閉復原提示" onClick={() => setDeleted(null)}>✕</button>
      </div>}
    </DataContext.Provider>
  );
};
