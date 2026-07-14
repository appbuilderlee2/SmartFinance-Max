
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, Category, Budget, Subscription, TransactionType, Currency } from '../types';
import { CATEGORIES } from '../constants';
import { readJson, writeJson } from '../utils/storage';
import { makeId } from '../utils/id';
import { ensureSchemaVersion } from '../utils/storageVersion';
import { parseDate, isSameMonth, toLocalYMD } from '../utils/date';
import { clearAppStorage } from '../utils/backup';

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
  deleteCategory: (id: string) => void;
  addCategory: (cat: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  reorderCategories: (type: TransactionType, orderedIds: string[]) => void;
  setCurrency: (c: Currency) => void;
  addCreditCard: (card: CreditCard) => void;
  deleteCreditCard: (id: string) => void;
  updateCreditCard: (id: string, updates: Partial<CreditCard>) => void;
  setCreditCards: (cards: CreditCard[]) => void;
  setThemeColor: (color: ThemeName) => void;
  resetData: () => void;
}

const DataContext = createContext<DataContextType>({} as DataContextType);

export const useData = () => useContext(DataContext);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mark schema version early to help future migrations.
  useEffect(() => {
    ensureSchemaVersion();
  }, []);

  const DEFAULT_THEME: ThemeName = 'blue';
  const normalizeThemeName = (value: unknown): ThemeName => {
    if (typeof value !== 'string') return DEFAULT_THEME;
    const trimmed = value.trim();
    if (!trimmed) return DEFAULT_THEME;
    // Only allow safe class suffixes (matches `.theme-xxx` blocks in CSS)
    if (!/^[a-z0-9-]+$/i.test(trimmed)) return DEFAULT_THEME;
    return trimmed;
  };

  // Load data from localStorage or fallback to Mock Data
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return readJson<Transaction[]>('smartfinance_transactions') ?? [];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const parsed = readJson<Category[]>('smartfinance_categories') ?? CATEGORIES;
    return normalizeCategories(parsed);
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    return readJson<Budget[]>('smartfinance_budgets') ?? [];
  });

  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    return readJson<Subscription[]>('smartfinance_subscriptions') ?? [];
  });

  const [currency, setCurrencyState] = useState<Currency>(() => {
    // currency is stored as a string
    const saved = (() => {
      try { return localStorage.getItem('smartfinance_currency'); } catch { return null; }
    })();
    return (saved as Currency) || Currency.HKD;
  });

  const getTxCurrency = (t: Transaction): Currency => (t.currency as Currency) || currency;

  const [creditCards, setCreditCards] = useState<CreditCard[]>(() => {
    return readJson<CreditCard[]>('smartfinance_creditcards') ?? [];
  });

  const [themeColor, setThemeColorState] = useState<ThemeName>(() => {
    const saved = (() => {
      try { return localStorage.getItem('smartfinance_themecolor'); } catch { return null; }
    })();
    return normalizeThemeName(saved);
  });

  // Persistence Effects
  useEffect(() => {
    writeJson('smartfinance_transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    writeJson('smartfinance_categories', categories);
  }, [categories]);

  useEffect(() => {
    writeJson('smartfinance_budgets', budgets);
  }, [budgets]);

  useEffect(() => {
    writeJson('smartfinance_subscriptions', subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem('smartfinance_currency', currency);
  }, [currency]);

  // Budget Spending Logic (recalculate spent whenever transactions/categories/currency change)
  // Improvement: avoid JSON.stringify object-wide compare and reduce repeated date parsing.
  useEffect(() => {
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
      spentByCategory.set(t.categoryId, prev + (Number(t.amount) || 0));
    }

    // 3) Compute next budgets and apply only if changed
    let changed = missingBudgets.length > 0;
    const nextBudgets = baseBudgets.map((b) => {
      const spent = spentByCategory.get(b.categoryId) || 0;
      if (b.spent !== spent) changed = true;
      return { ...b, spent };
    });

    if (changed) setBudgets(nextBudgets);
  }, [transactions, categories, currency]);

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

  const deleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
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

  const resetData = () => {
    if (!window.confirm("確定要重置所有資料？這將清除您的所有紀錄（包含交易/訂閱/信用卡等）。")) return;

    try {
      // Clear every SmartFinance-owned key, including credit-card cycles,
      // reminders, tag history and future versioned keys.
      clearAppStorage(localStorage);
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
    writeJson('smartfinance_creditcards', creditCards);
  }, [creditCards]);

  // Persistence and application of theme (UI skin)
  useEffect(() => {
    localStorage.setItem('smartfinance_themecolor', themeColor);
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
  }, [themeColor]);

  // Auto-create expense transactions for due subscriptions
  // Guardrail: avoid tight loops / double processing when this effect updates state.
  const isAutoPostingRef = useRef(false);
  useEffect(() => {
    if (isAutoPostingRef.current) return;
    if (!subscriptions.length) return;

    const now = new Date();
    const todayStr = toLocalYMD(now);

    const addCycle = (date: Date, cycle: Subscription['billingCycle']) => {
      const d = new Date(date);
      if (cycle === 'Weekly') d.setDate(d.getDate() + 7);
      else if (cycle === 'BiWeekly') d.setDate(d.getDate() + 14);
      else if (cycle === 'Monthly') d.setMonth(d.getMonth() + 1);
      else if (cycle === 'Yearly') d.setFullYear(d.getFullYear() + 1);
      return toLocalYMD(d);
    };

    const pickCategoryId = (sub: Subscription) => {
      if (sub.categoryId) return sub.categoryId;
      const subscriptionCat = categories.find(c => c.name.includes('訂閱'));
      if (subscriptionCat) return subscriptionCat.id;
      const entertainment = categories.find(c => c.name.includes('娛樂'));
      const firstExpense = categories.find(c => c.type === TransactionType.EXPENSE);
      return (subscriptionCat || entertainment || firstExpense || categories[0])?.id || '';
    };

    let newTransactions: Transaction[] = [];
    let changed = false;

    const updatedSubs = subscriptions.map(sub => {
      const parsed = new Date(sub.nextBillingDate);
      if (isNaN(parsed.getTime())) return sub;

      let nextDate = parsed;
      let iterations = 0;
      let processed = false;
      let lastProcessed = sub.lastProcessedDate || '';

      while (toLocalYMD(nextDate) <= todayStr && iterations < 24) {
        const dueStr = toLocalYMD(nextDate);
        if (lastProcessed && lastProcessed >= dueStr) {
          // already processed this due date (or later)
          nextDate = new Date(addCycle(nextDate, sub.billingCycle));
          iterations += 1;
          continue;
        }

        const categoryId = pickCategoryId(sub);
        const tx: Transaction = {
          id: makeId('tx'),
          amount: sub.amount,
          date: dueStr,
          note: `訂閱：${sub.name}`,
          categoryId,
          type: TransactionType.EXPENSE,
          isRecurring: true,
          subscriptionId: sub.id,
          tags: ['subscription']
        };
        const alreadyExists = transactions.some(t => {
          if (t.subscriptionId && t.subscriptionId === sub.id) {
            return t.date.split('T')[0] === dueStr;
          }
          return t.date.split('T')[0] === dueStr &&
            t.amount === sub.amount &&
            t.note === `訂閱：${sub.name}`;
        });
        if (!alreadyExists) {
          newTransactions.push(tx);
        }
        processed = true;
        lastProcessed = dueStr;

        if (sub.autoRenewal === false) {
          // Stop after one-time posting when不自動續訂
          nextDate = parsed;
          break;
        }

        nextDate = new Date(addCycle(nextDate, sub.billingCycle));
        iterations += 1;
      }

      if (processed) {
        changed = true;
        const nextBilling = sub.autoRenewal === false ? '' : toLocalYMD(nextDate);
        return { ...sub, nextBillingDate: nextBilling, lastProcessedDate: lastProcessed || todayStr };
      }

      return sub;
    });

    if (newTransactions.length || changed) {
      // Mark this run as “mutating” to prevent immediate re-entry.
      isAutoPostingRef.current = true;
    }

    if (newTransactions.length) {
      setTransactions(prev => [...newTransactions, ...prev]);
    }
    if (changed) {
      setSubscriptions(updatedSubs);
    }

    if (newTransactions.length || changed) {
      // Release guard on next tick.
      setTimeout(() => { isAutoPostingRef.current = false; }, 0);
    }
  }, [subscriptions, categories, transactions]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  return (
    <DataContext.Provider value={{
      transactions,
      categories: sortedCategories,
      budgets,
      subscriptions,
      currency,
      creditCards,
      themeColor,
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
