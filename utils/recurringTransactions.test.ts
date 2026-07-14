import { describe, expect, it } from 'vitest';
import { RecurrenceFrequency, Transaction, TransactionType } from '../types';
import { processDueRecurringTransactions } from './recurringTransactions';

const source = (date: string, recurrence: RecurrenceFrequency = 'monthly'): Transaction => ({
  id: 'source-1',
  amount: 12.34,
  date,
  note: '固定支出',
  categoryId: 'food',
  type: TransactionType.EXPENSE,
  isRecurring: true,
  recurrence,
});

describe('recurring transaction processing', () => {
  it('posts every overdue weekly occurrence', () => {
    let id = 0;
    const result = processDueRecurringTransactions({
      transactions: [source('2026-07-01', 'weekly')],
      today: new Date(2026, 6, 22),
      makeTransactionId: () => `tx-${++id}`,
    });
    expect(result.transactions.map(item => item.date)).toEqual(['2026-07-08', '2026-07-15', '2026-07-22']);
  });

  it('supports biweekly schedules', () => {
    const result = processDueRecurringTransactions({
      transactions: [source('2026-06-01', 'biweekly')],
      today: new Date(2026, 6, 1),
      makeTransactionId: () => 'generated',
    });
    expect(result.transactions.map(item => item.date)).toEqual(['2026-06-15', '2026-06-29']);
  });

  it('preserves the monthly anchor after a short month', () => {
    const result = processDueRecurringTransactions({
      transactions: [source('2026-01-31')],
      today: new Date(2026, 3, 30),
      makeTransactionId: () => crypto.randomUUID(),
    });
    expect(result.transactions.map(item => item.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('does not create an occurrence twice', () => {
    const recurringSource = source('2026-05-15');
    const existing = { ...recurringSource, id: 'existing', date: '2026-06-15', recurrence: undefined, recurrenceSourceId: recurringSource.id };
    const result = processDueRecurringTransactions({
      transactions: [recurringSource, existing],
      today: new Date(2026, 6, 20),
      makeTransactionId: () => 'july',
    });
    expect(result.transactions.map(item => item.date)).toEqual(['2026-07-15']);
    expect(result.transactions[0].recurrenceSourceId).toBe('source-1');
  });

  it('ignores invalid, future and generated-only schedules', () => {
    const invalid = source('2026-02-31');
    const future = { ...source('2027-01-01'), id: 'future' };
    const generatedOnly = { ...source('2026-01-01'), id: 'generated', recurrenceSourceId: 'missing-source' };
    const result = processDueRecurringTransactions({
      transactions: [invalid, future, generatedOnly],
      today: new Date(2026, 6, 20),
      makeTransactionId: () => 'unused',
    });
    expect(result.transactions).toHaveLength(0);
    expect(result.changed).toBe(false);
  });
});
