import { describe, expect, it } from 'vitest';
import { Currency, TransactionType } from '../types';
import { DEFAULT_REMINDER_SETTINGS, regenerateReminders } from './reminders';

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

it('keeps the prior statement month’s payment reminder when it falls in the current month', () => {
  const card = {
    id: 'card', name: 'Card', annualFee: 0, cashbackType: '', expiryDate: '',
    statementDay: 19, dueDay: 14, dueInNextMonth: true,
  };
  const reminders = regenerateReminders({
    creditCards: [card], subscriptions: [], scheduleAhead: true, now: new Date(2026, 1, 1),
  });
  expect(reminders).toContainEqual(expect.objectContaining({
    dedupeKey: 'cc_payment_due|card|2026-01', dueYmd: '2026-02-14', status: 'open',
  }));
});

it('can turn off statement and payment alerts without disabling amount-entry reminders', () => {
  const reminders = regenerateReminders({
    creditCards: [{ id: 'card', name: 'Card', annualFee: 0, cashbackType: '', expiryDate: '', statementDay: 5, dueDay: 20 }],
    subscriptions: [], scheduleAhead: true, now: new Date(2026, 1, 1),
    settings: { ...DEFAULT_REMINDER_SETTINGS, ccStatementEnabled: false, ccPaymentEnabled: false },
  });
  expect(reminders.some(item => item.type === 'cc_amount_due')).toBe(true);
  expect(reminders.some(item => item.type === 'cc_statement' || item.type === 'cc_payment_due')).toBe(false);
});
