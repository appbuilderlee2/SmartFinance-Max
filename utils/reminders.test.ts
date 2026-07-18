import { describe, expect, it } from 'vitest';
import { Currency, TransactionType } from '../types';
import { regenerateReminders } from './reminders';

describe('budget reminders', () => {
  it('creates near-limit and over-budget reminders with stable actions', () => {
    const reminders = regenerateReminders({
      creditCards: [], subscriptions: [], currency: Currency.HKD,
      categories: [
        { id: 'food', name: '餐飲', icon: 'food', color: 'red', type: TransactionType.EXPENSE },
        { id: 'travel', name: '交通', icon: 'car', color: 'blue', type: TransactionType.EXPENSE },
      ],
      budgets: [
        { categoryId: 'food', limit: 1000, spent: 850 },
        { categoryId: 'travel', limit: 500, spent: 520 },
      ],
      now: new Date(2026, 6, 18),
    });
    expect(reminders.find(item => item.type === 'budget_near_limit')?.title).toContain('餐飲');
    expect(reminders.find(item => item.type === 'budget_over_limit')).toMatchObject({ severity: 'urgent', action: { kind: 'navigate', to: '/budget' } });
  });
});
