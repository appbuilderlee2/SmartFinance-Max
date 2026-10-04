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
  recurrenceOccurrenceDate?: string;
  recurrenceFrom?: string;
  recurrenceUntil?: string;
  recurrenceTemplate?: Pick<Transaction, 'amount' | 'date' | 'note' | 'categoryId' | 'type' | 'currency' | 'tags'>;
  skippedDates?: string[]; // Deliberately deleted occurrences, retained on the source
  receiptUrl?: string;
  tags?: string[];
  currency?: Currency; // Optional per-transaction currency; defaults to app currency
  subscriptionId?: string;
  subscriptionOccurrenceDate?: string;
  walletItemId?: string;
}

export interface WalletItem {
  id: string;
  name: string;
  kind: 'stored' | 'count' | 'voucher';
  currency: Currency;
  openingBalance: number;
  faceValue?: number;
  expiresOn?: string;
  notes: string;
  events: { id: string; date: string; amount: number; kind: 'add' | 'use'; note: string }[];
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
  billingCycle: 'Monthly' | 'Yearly' | 'Weekly' | 'BiWeekly' | 'Custom';
  intervalCount?: number;
  intervalUnit?: 'days' | 'months';
  status?: 'active' | 'paused' | 'cancelled';
  recordingMode?: 'auto' | 'track';
  trialEndDate?: string;
  serviceEndDate?: string;
  cardId?: string;
  managementUrl?: string;
  priceChange?: { amount: number; effectiveDate: string };
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
