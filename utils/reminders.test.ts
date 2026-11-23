import { describe, expect, it, vi } from 'vitest';
import { Currency, TransactionType, type Subscription } from '../types';
import { DEFAULT_REMINDER_SETTINGS, markReminderDone, regenerateReminders, snoozeReminder } from './reminders';
import * as storage from './storage';

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

it('keeps a completed and a snoozed subscription reminder across type and master toggles', () => {
  const values = new Map<string, unknown>();
  const read = vi.spyOn(storage, 'readJson').mockImplementation(<T>(key: string) => (values.get(key) as T) ?? null);
  const write = vi.spyOn(storage, 'writeJson').mockImplementation(async (key, value) => {
    values.set(key, value);
    return true;
  });
  try {
    const subscriptions: Subscription[] = ['done', 'snoozed'].map(id => ({
      id, name: id, amount: 1, billingCycle: 'Monthly', nextBillingDate: '2026-02-03',
    }));
    const settings = { ...DEFAULT_REMINDER_SETTINGS, backupEnabled: false };
    const inputs = { creditCards: [], subscriptions, now: new Date(2026, 1, 1), settings };
    const [done, snoozed] = regenerateReminders(inputs);
    markReminderDone(done.id);
    snoozeReminder(snoozed.id, 2);

    expect(regenerateReminders({ ...inputs, settings: { ...settings, subEnabled: false } })).toEqual([]);
    expect(regenerateReminders({ ...inputs, settings: { ...settings, enabled: false } })).toEqual([]);
    expect(regenerateReminders(inputs)).toEqual([
      expect.objectContaining({ id: done.id, status: 'done', doneAt: expect.any(String) }),
      expect.objectContaining({ id: snoozed.id, status: 'open', dueYmd: '2026-02-05', snoozeUntilYmd: '2026-02-05' }),
    ]);
  } finally {
    read.mockRestore();
    write.mockRestore();
  }
});
