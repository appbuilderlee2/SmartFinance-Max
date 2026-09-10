import { describe, it, expect } from 'vitest';
import { Currency, Transaction, TransactionType } from '../types';
import { monthRange, reportTotals, selectReportRows, ReportFilter } from './reporting';
import { renameTransactionTags, userTags, uniqueTags } from './tags';
const row: Transaction = { id: '1', date: '2026-09-10T12:00:00', amount: 12.30, note: '午餐', tags: ['旅行', 'Travel'], categoryId: 'food', type: TransactionType.EXPENSE, currency: Currency.AUD };
const filter: ReportFilter = { start: '2026-09-01', end: '2026-09-30', currency: Currency.AUD, note: '', categories: [], tags: [], min: '', max: '' };
describe('report filters and tag management', () => {
  it('isolates currencies, notes and tags without double-counting multiple matching tags', () => {
    const rows = [row, { ...row, id: '2', currency: Currency.HKD }, { ...row, id: '3', date: '2026-08-10T12:00:00' }];
    expect(selectReportRows(rows, { ...filter, tags: ['旅行','Travel'] }, Currency.AUD)).toEqual([row]);
    expect(selectReportRows(rows, { ...filter, note: 'Travel' }, Currency.AUD)).toEqual([]);
    expect(selectReportRows(rows, { ...filter, min: '13' }, Currency.AUD)).toEqual([]);
  });
  it('handles leap years and year boundaries', () => {
    expect(monthRange(2024 * 12 + 1)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthRange(2026 * 12 - 1)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
  it('sums using currency precision', () => {
    expect(reportTotals([{ ...row, amount: .1 }, { ...row, amount: .2 }], Currency.AUD).expense).toBe(.3);
  });
  it('merges tags without altering notes, amounts, or unrelated rows', () => {
    const unrelated = { ...row, id: '2', tags: ['其他'] };
    const result = renameTransactionTags([row, unrelated], '#travel', '旅行');
    expect(result[0]).toEqual({ ...row, tags: ['旅行'] });
    expect(result[1]).toBe(unrelated);
    expect(renameTransactionTags([row], '旅行', ' ')).toEqual([row]);
    expect(uniqueTags([' #Trip ', 'trip', ''])).toEqual(['Trip']);
  });
  it('preserves legacy system metadata and manual subscription tags', () => {
    const linked = { ...row, subscriptionId: 's1', tags: ['subscription', '旅行'] };
    expect(userTags(linked)).toEqual(['旅行']);
    expect(userTags({ ...row, tags: ['subscription'] })).toEqual(['subscription']);
    expect(renameTransactionTags([linked], '旅行', '假期')[0].tags).toEqual(['subscription', '假期']);
  });
});
