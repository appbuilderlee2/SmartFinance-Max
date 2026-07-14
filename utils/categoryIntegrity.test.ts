import { describe, expect, it } from 'vitest';
import { Currency, TransactionType } from '../types';
import { canUseReplacement, getCategoryUsage, reassignCategoryReferences } from './categoryIntegrity';

const source = { id: 'food', name: '餐飲', icon: 'Tag', color: 'bg-red-500', type: TransactionType.EXPENSE };
const replacement = { id: 'living', name: '生活', icon: 'Tag', color: 'bg-blue-500', type: TransactionType.EXPENSE };

describe('category integrity', () => {
  it('counts linked records and ignores an empty generated budget row', () => {
    const usage = getCategoryUsage(
      'food',
      [{ id: 'tx1', amount: 10, date: '2026-07-01', note: '', categoryId: 'food', type: TransactionType.EXPENSE }],
      [{ id: 'sub1', name: 'Lunch', amount: 10, billingCycle: 'Monthly', nextBillingDate: '2026-08-01', categoryId: 'food' }],
      [{ categoryId: 'food', limit: 0, spent: 10 }],
    );
    expect(usage).toEqual({ transactionCount: 1, subscriptionCount: 1, hasBudget: false });
  });

  it('reassigns transactions/subscriptions and merges budget limits', () => {
    const result = reassignCategoryReferences(
      'food',
      'living',
      [{ id: 'tx1', amount: 10, date: '2026-07-01', note: '', categoryId: 'food', type: TransactionType.EXPENSE }],
      [{ id: 'sub1', name: 'Lunch', amount: 10, billingCycle: 'Monthly', nextBillingDate: '2026-08-01', categoryId: 'food' }],
      [{ categoryId: 'food', limit: 100, spent: 10 }, { categoryId: 'living', limit: 200, spent: 20 }],
      Currency.HKD,
    );
    expect(result.transactions[0].categoryId).toBe('living');
    expect(result.subscriptions[0].categoryId).toBe('living');
    expect(result.budgets).toContainEqual({ categoryId: 'living', limit: 300, spent: 20 });
    expect(result.budgets.some((item) => item.categoryId === 'food')).toBe(false);
  });

  it('only accepts a different category with the same transaction type', () => {
    expect(canUseReplacement(source, replacement)).toBe(true);
    expect(canUseReplacement(source, source)).toBe(false);
    expect(canUseReplacement(source, { ...replacement, type: TransactionType.INCOME })).toBe(false);
  });
});
