export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  order?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO date string
  note: string;
  categoryId: string;
  type: TransactionType;
  isRecurring?: boolean;
  recurrence?: RecurrenceFrequency;
  recurrenceSourceId?: string;
  receiptUrl?: string;
  tags?: string[];
  currency?: Currency; // Optional per-transaction currency; defaults to app currency
  subscriptionId?: string;
}

export enum Currency {
  TWD = 'TWD',
  HKD = 'HKD',
  USD = 'USD',
  AUD = 'AUD',
  RMB = 'CNY',
  JPY = 'JPY',
  EUR = 'EUR',
  GBP = 'GBP'
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'Monthly' | 'Yearly' | 'Weekly' | 'BiWeekly';
  nextBillingDate: string;
  autoRenewal?: boolean;
  notes?: string;
  icon?: string;
  categoryId?: string;
  lastProcessedDate?: string; // 用來避免同一天重複生成交易紀錄
  currency?: Currency;
  billingAnchorDay?: number;
}

export interface Budget {
  categoryId: string;
  limit: number;
  spent: number;
}
