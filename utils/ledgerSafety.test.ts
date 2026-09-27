import { expect, test } from 'vitest';
import { Currency, TransactionType, type Transaction } from '../types';
import { pinCurrency, pinSnapshotCurrencies } from './ledgerCurrency';
import { mergeBackupSnapshots, previewBackupMerge, parseBackupJson, createBackupFromSnapshot, backupToCsv, parseBackupCsv } from './backup';
import { editRecurringTransactions, processDueRecurringTransactions, removeRecurringOccurrence } from './recurringTransactions';
import { captureDeletion, restoreDeletion } from './transactionUndo';

const source: Transaction = { id: 'source', amount: 100, date: '2026-01-10', type: TransactionType.EXPENSE, categoryId: 'food', note: 'sample', currency: Currency.AUD, recurrence: 'monthly' };
const process = (rows: Transaction[], today = new Date(2026, 3, 12)) => { let id = 0; return processDueRecurringTransactions({ transactions: rows, today, makeTransactionId: () => `generated-${++id}` }).transactions; };

test('legacy currency is fixed before changing the default or merging different currencies', () => {
  const rows = pinCurrency([{ ...source, currency: undefined }], Currency.AUD);
  expect(pinCurrency(rows, Currency.HKD)[0].currency).toBe(Currency.AUD);
  const current = { smartfinance_currency: 'HKD', smartfinance_transactions: JSON.stringify([{ ...source, id: 'hkd', currency: undefined }]) };
  const incoming = { smartfinance_currency: 'AUD', smartfinance_transactions: JSON.stringify([{ ...source, currency: undefined }]) };
  const merged = mergeBackupSnapshots(current, incoming);
  expect(merged.smartfinance_currency).toBe('HKD');
  expect(JSON.parse(merged.smartfinance_transactions).map((row: Transaction) => row.currency)).toEqual(['HKD', 'AUD']);
});

test('merge preserves conflicts and deleted rows unless explicitly requested', () => {
  const current = { smartfinance_transactions: JSON.stringify([source]), smartfinance_deleted_transaction_ids: '["deleted"]' };
  const incoming = { smartfinance_transactions: JSON.stringify([{ ...source, amount: 10 }, { ...source, id: 'deleted' }, { ...source, id: 'new' }]) };
  expect(previewBackupMerge(current, incoming)).toEqual({ added: 1, conflicts: 1, deleted: 1 });
  const safe = JSON.parse(mergeBackupSnapshots(current, incoming).smartfinance_transactions);
  expect(safe.map((row: Transaction) => row.id)).toEqual(['source', 'new']);
  expect(safe[0].amount).toBe(100);
  const restored = mergeBackupSnapshots(current, incoming, { conflict: 'incoming', restoreDeleted: true });
  expect(JSON.parse(restored.smartfinance_transactions)).toHaveLength(3);
  expect(JSON.parse(restored.smartfinance_transactions)[0].amount).toBe(10);
  expect(restored.smartfinance_deleted_transaction_ids).toBe('[]');
  const migrated = mergeBackupSnapshots({}, { ...incoming, smartfinance_deleted_transaction_ids: '["past-deletion","new"]' });
  expect(JSON.parse(migrated.smartfinance_deleted_transaction_ids)).toEqual(['past-deletion']);
});

test('next-only recurring source does not backfill earlier months after single edit', () => {
  const rows = editRecurringTransactions([{ ...source, recurrenceFrom: '2026-04-13' }], source.id, { amount: 5, recurrenceFrom: undefined, date: '2026-01-11' }, 'only');
  expect(process(rows)).toHaveLength(0);
  const next = process(rows, new Date(2026, 4, 11));
  expect(next).toHaveLength(1);
  expect(next[0]).toMatchObject({ amount: 100, date: '2026-05-10' });
});

test('moving one generated occurrence does not recreate it; delete and undo use original occurrence identity', () => {
  const rows = [source, ...process([source])];
  const feb = rows.find(row => row.date === '2026-02-10')!;
  const edited = editRecurringTransactions(rows, feb.id, { date: '2026-02-12', amount: 200 }, 'only');
  expect(process(edited)).toHaveLength(0);
  const deletion = captureDeletion(edited, feb.id)!;
  const deleted = removeRecurringOccurrence(edited, feb.id);
  expect(deletion.addedSkip).toBe('2026-02-10');
  expect(process(deleted)).toHaveLength(0);
  expect(restoreDeletion(deleted, deletion).find(row => row.id === source.id)?.skippedDates).not.toContain('2026-02-10');
});

test('future edit splits a series, preserves earlier entries and rebuilds later occurrences', () => {
  const rows = [source, ...process([source])];
  const march = rows.find(row => row.date === '2026-03-10')!;
  const next = editRecurringTransactions(rows, march.id, { amount: 250, recurrence: 'monthly', date: '2026-03-15' }, 'future');
  expect(next.find(row => row.date === '2026-02-10')?.amount).toBe(100);
  expect(next.find(row => row.id === source.id)?.recurrenceUntil).toBe('2026-03-10');
  const generated = process(next, new Date(2026, 3, 16));
  expect(generated).toHaveLength(1);
  expect(generated[0]).toMatchObject({ amount: 250, date: '2026-04-15', recurrenceSourceId: march.id });
  expect(process([...next, ...generated], new Date(2026, 3, 16))).toHaveLength(0);
});

test('stopping a series retains earlier history and prevents subsequent generation', () => {
  const rows = [source, ...process([source])];
  const march = rows.find(row => row.date === '2026-03-10')!;
  const next = editRecurringTransactions(rows, march.id, { recurrence: undefined, isRecurring: false }, 'future');
  expect(next).toHaveLength(3);
  expect(process(next, new Date(2027, 1, 1))).toHaveLength(0);
});

test('backup round-trip preserves images, pinned currencies, recurrence rules, and tombstones', () => {
  const rows = editRecurringTransactions([source], source.id, { amount: 250 }, 'only');
  const snapshot = pinSnapshotCurrencies({ smartfinance_currency: 'AUD', smartfinance_transactions: JSON.stringify(rows), smartfinance_categories: JSON.stringify([{ id: 'food', name: 'sample', type: 'EXPENSE', icon: 'emoji-image:data:image/png;base64,abc', color: 'bg-blue-500' }]), smartfinance_deleted_transaction_ids: '["deleted"]' });
  const backup = createBackupFromSnapshot(snapshot, 'test');
  expect(parseBackupJson(JSON.stringify(backup)).storage).toEqual(snapshot);
  expect(parseBackupCsv(backupToCsv(backup)).storage).toEqual(snapshot);
});
