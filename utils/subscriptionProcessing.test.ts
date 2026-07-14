import { describe, expect, it } from 'vitest';
import { Currency, TransactionType } from '../types';
import { processDueSubscriptions } from './subscriptionProcessing';

const categories = [{ id: 'entertainment', name: '娛樂', icon: 'Film', color: 'bg-purple-500', type: TransactionType.EXPENSE }];

describe('subscription processing', () => {
  it('posts every overdue monthly charge once and advances the next date', () => {
    let id = 0;
    const result = processDueSubscriptions({
      subscriptions: [{ id: 'netflix', name: 'Netflix', amount: 20, billingCycle: 'Monthly', nextBillingDate: '2026-05-15' }],
      transactions: [],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 6, 20),
      makeTransactionId: () => `tx-${++id}`,
    });
    expect(result.transactions.map((item) => item.date)).toEqual(['2026-05-15', '2026-06-15', '2026-07-15']);
    expect(result.subscriptions[0].nextBillingDate).toBe('2026-08-15');
  });

  it('recognises an existing ISO transaction without split-T timezone logic', () => {
    const result = processDueSubscriptions({
      subscriptions: [{ id: 'netflix', name: 'Netflix', amount: 20, billingCycle: 'Monthly', nextBillingDate: '2026-07-15' }],
      transactions: [{
        id: 'existing', amount: 20, date: new Date(2026, 6, 15).toISOString(), note: '訂閱：Netflix',
        categoryId: 'entertainment', type: TransactionType.EXPENSE, subscriptionId: 'netflix',
      }],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 6, 20),
      makeTransactionId: () => 'should-not-be-used',
    });
    expect(result.transactions).toHaveLength(0);
    expect(result.subscriptions[0].nextBillingDate).toBe('2026-08-15');
  });

  it('posts a non-renewing subscription once and closes its schedule', () => {
    const result = processDueSubscriptions({
      subscriptions: [{ id: 'once', name: 'Once', amount: 5, billingCycle: 'Monthly', nextBillingDate: '2026-07-01', autoRenewal: false }],
      transactions: [],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 6, 20),
      makeTransactionId: () => 'tx-once',
    });
    expect(result.transactions).toHaveLength(1);
    expect(result.subscriptions[0].nextBillingDate).toBe('');
  });

  it('ignores invalid billing dates instead of rolling them over', () => {
    const result = processDueSubscriptions({
      subscriptions: [{ id: 'bad', name: 'Bad', amount: 5, billingCycle: 'Monthly', nextBillingDate: '2026-02-31' }],
      transactions: [],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 6, 20),
      makeTransactionId: () => 'tx-bad',
    });
    expect(result.transactions).toHaveLength(0);
    expect(result.changed).toBe(false);
  });

  it('keeps each subscription currency when posting a transaction', () => {
    const result = processDueSubscriptions({
      subscriptions: [{
        id: 'aud-service', name: 'Australian service', amount: 12.5, currency: Currency.AUD,
        billingCycle: 'Monthly', nextBillingDate: '2026-07-01',
      }],
      transactions: [],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 6, 1),
      makeTransactionId: () => 'aud-charge',
    });
    expect(result.transactions[0].currency).toBe(Currency.AUD);
    expect(result.subscriptions[0].currency).toBe(Currency.AUD);
  });

  it('preserves a month-end anchor across short months and reloads', () => {
    const first = processDueSubscriptions({
      subscriptions: [{
        id: 'month-end', name: 'Month end', amount: 10, billingCycle: 'Monthly', nextBillingDate: '2026-01-31',
      }],
      transactions: [],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 1, 28),
      makeTransactionId: () => crypto.randomUUID(),
    });
    expect(first.transactions.map(item => item.date)).toEqual(['2026-01-31', '2026-02-28']);
    expect(first.subscriptions[0].nextBillingDate).toBe('2026-03-31');
    expect(first.subscriptions[0].billingAnchorDay).toBe(31);

    const second = processDueSubscriptions({
      subscriptions: first.subscriptions,
      transactions: first.transactions,
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2026, 3, 30),
      makeTransactionId: () => crypto.randomUUID(),
    });
    expect(second.transactions.map(item => item.date)).toEqual(['2026-03-31', '2026-04-30']);
    expect(second.subscriptions[0].nextBillingDate).toBe('2026-05-31');
  });

  it('restores a leap-day annual anchor in the next leap year', () => {
    const result = processDueSubscriptions({
      subscriptions: [{
        id: 'leap', name: 'Leap', amount: 10, billingCycle: 'Yearly',
        nextBillingDate: '2024-02-29', billingAnchorDay: 29,
      }],
      transactions: [],
      categories,
      defaultCurrency: Currency.HKD,
      today: new Date(2028, 1, 29),
      makeTransactionId: () => crypto.randomUUID(),
    });
    expect(result.transactions.map(item => item.date)).toEqual([
      '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29',
    ]);
  });
});
