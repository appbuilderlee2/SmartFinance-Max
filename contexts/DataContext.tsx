
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, Category, Budget, Subscription, TransactionType, Currency } from '../types';
import { CATEGORIES } from '../constants';
import {
  clearStorageData,
  initializeStorage,
  readJson,
  readText,
  reportStorageError,
  StorageBackend,
  writeJson,
  writeText,
} from '../utils/storage';
import { makeId } from '../utils/id';
import { ensureSchemaVersion } from '../utils/storageVersion';
import { parseDate, isSameMonth, toLocalYMD } from '../utils/date';
import { canUseReplacement, getCategoryUsage, reassignCategoryReferences } from '../utils/categoryIntegrity';
import { processDueSubscriptions } from '../utils/subscriptionProcessing';
import { fromMinorUnits, toMinorUnits } from '../utils/money';
import { processDueRecurringTransactions } from '../utils/recurringTransactions';

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
  updateTransaction: (id: string, tx: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
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

const DataContext = createContext<DataContextType>({} as DataContextType);

export const useData = () => useContext(DataContext);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const DEFAULT_THEME: ThemeName = 'blue';
  const normalizeThemeName = (value: unknown): ThemeName => {
    if (typeof value !== 'string') return DEFAULT_THEME;
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_THEME;
    // Only allow safe class suffixes (matches `.theme-xxx` blocks in CSS)
    if (!/^[a-z0-9-]+$/i.test(trimmed)) return DEFAULT_THEME;
    return trimmed;
  };

  const [storageReady, setStorageReady] = useState(false);
  const [storageBackend, setStorageBackend] = useState<StorageBackend>('indexeddb');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
      const result = await initializeStorage();
      if (!active) return;
      setTransactions(readJson<Transaction[]>('smartfinance_transactions') ?? []);
      setCategories(normalizeCategories(readJson<Category[]>('smartfinance_categories') ?? CATEGORIES));
      setBudgets(readJson<Budget[]>('smartfinance_budgets') ?? []);
      setSubscriptions(readJson<Subscription[]>('smartfinance_subscriptions') ?? []);
      setCurrencyState((readText('smartfinance_currency') as Currency) || Currency.HKD);
      setCreditCards(readJson<CreditCard[]>('smartfinance_creditcards') ?? []);
      setThemeColorState(normalizeThemeName(readText('smartfinance_themecolor')));
      setStorageBackend(result.backend);
      setStorageReady(true);
    })();
    return () => { active = false; };
  }, []);

  // Persistence Effects
  useEffect(() => {
    if (!storageReady) return;
    writeJson('smartfinance_transactions', transactions);
  }, [storageReady, transactions]);

  useEffect(() => {
    if (!storageReady) return;
    writeJson('smartfinance_categories', categories);
  }, [storageReady, categories]);

  useEffect(() => {
    if (!storageReady) return;
    writeJson('smartfinance_budgets', budgets);
  }, [storageReady, budgets]);

  useEffect(() => {
    if (!storageReady) return;
    writeJson('smartfinance_subscriptions', subscriptions);
  }, [storageReady, subscriptions]);

  useEffect(() => {
    if (!storageReady) return;
    writeText('smartfinance_currency', currency);
  }, [storageReady, currency]);

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
  }, [storageReady, transactions, categories, currency]);

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...tx,
      id: makeId('tx'),
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const updateTransaction = (id: string, updatedFields: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedFields } : t));
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
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
    if (!confirmed && !window.confirm("確定要重置所有資料？這將清除您的所有紀錄（包含交易/訂閱/信用卡等）。")) return;

    try {
      await clearStorageData();
    } catch {
      // ignore
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

    alert("資料已重置");
  };

  // Persistence for credit cards
  useEffect(() => {
    if (!storageReady) return;
    writeJson('smartfinance_creditcards', creditCards);
  }, [storageReady, creditCards]);

  // Persistence and application of theme (UI skin)
  useEffect(() => {
    if (!storageReady) return;
    writeText('smartfinance_themecolor', themeColor);
    const root = document.documentElement;

    // Remove previous theme-* classes
    for (const className of Array.from(root.classList)) {
      if (className.startsWith('theme-')) root.classList.remove(className);
    }

    const normalized = normalizeThemeName(themeColor);
    root.classList.add(`theme-${normalized}`);
    root.dataset.sfTheme = normalized;

    // Tailwind `darkMode: 'class'` support
    if (themeColor === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
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
  }, [storageReady, subscriptions, categories, transactions, currency]);

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
  }, [storageReady, transactions]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

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
      addTransaction,
      deleteTransaction,
      updateTransaction,
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
      {children}
    </DataContext.Provider>
  );
};
