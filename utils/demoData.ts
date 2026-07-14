import { TransactionType, Currency } from '../types';
import { toLocalYMD } from './date';
import type { Transaction, Budget, Subscription } from '../types';
import type { CreditCard } from '../contexts/DataContext';

export type DemoPayload = {
  transactions: Transaction[];
  budgets: Budget[];
  subscriptions: Subscription[];
  creditCards: CreditCard[];
  currency: Currency;
  themeColor: string;
};

// Demo data is only applied when the user explicitly chooses "Demo".
export const DEMO_PAYLOAD: DemoPayload = {
  currency: Currency.HKD,
  themeColor: 'blue',
  transactions: [
    {
      id: 'demo-t1',
      amount: 68,
      date: toLocalYMD(new Date()),
      note: '示範：午餐',
      categoryId: '1',
      type: TransactionType.EXPENSE,
      tags: ['demo'],
    },
    {
      id: 'demo-t2',
      amount: 1200,
      date: toLocalYMD(new Date(Date.now() - 86400000)),
      note: '示範：交通月票',
      categoryId: '2',
      type: TransactionType.EXPENSE,
      tags: ['demo'],
    },
    {
      id: 'demo-t3',
      amount: 25000,
      date: toLocalYMD(new Date(Date.now() - 3 * 86400000)),
      note: '示範：出糧',
      categoryId: '7',
      type: TransactionType.INCOME,
      tags: ['demo'],
    },
  ],
  budgets: [
    { categoryId: '1', limit: 3000, spent: 0 },
    { categoryId: '2', limit: 2000, spent: 0 },
  ],
  subscriptions: [
    {
      id: 'demo-s1',
      name: 'Netflix (Demo)',
      amount: 78,
      billingCycle: 'Monthly',
      nextBillingDate: toLocalYMD(new Date(Date.now() + 7 * 86400000)),
      autoRenewal: true,
      lastProcessedDate: '',
      notes: 'demo',
    },
  ],
  creditCards: [
    {
      id: 'demo-cc1',
      name: 'Demo Card',
      lastFourDigits: '1234',
      annualFee: 0,
      feeMonth: new Date().getMonth() + 1,
      cashbackType: 'Demo',
      expiryDate: '2099-12',
      creditLimit: 50000,
      rewardCategories: ['餐飲', '交通'],
    },
  ],
};
