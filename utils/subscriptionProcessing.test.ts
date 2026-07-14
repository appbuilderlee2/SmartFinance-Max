import { describe, expect, it } from 'vitest';
import { TransactionType } from '../types';
import { processDueSubscriptions } from './subscriptionProcessing';

const categories = [{ id: 'entertainment', name: '娛樂', icon: 'Film', color: 'bg-purple-500', type: TransactionType.EXPENSE }];

describe('subscription processing', () => {
  it('posts every overdue monthly charge once and advances the next date', () => {
    let id = 0;
    const result = processDueSubscriptions({
      subscriptions: [{ id: 'netflix', name: 'Netflix', amount: 20, billingCycle: 'Monthly', nextBillingDate: '2026-05-15' }],
      transactions: [],
      categories,
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
      today: new Date(2026, 6, 20),
      makeTransactionId: () => 'tx-bad',
    });
    expect(result.transactions).toHaveLength(0);
    expect(result.changed).toBe(false);
  });
});
