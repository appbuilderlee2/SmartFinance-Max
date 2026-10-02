import { expect, test } from 'vitest';
import { resolveEntryDate } from './entryDate';
import { calendarDaysUntil } from './date';

test('new and legacy drafts default to the current local day', () => {
  const now = new Date(2026, 9, 2, 0, 5);
  expect(resolveEntryDate(undefined, undefined, now)).toBe('2026-10-02');
  expect(resolveEntryDate('2026-09-24', undefined, now)).toBe('2026-10-02');
  expect(resolveEntryDate('2026-09-24', 'today', now)).toBe('2026-10-02');
});
test('explicit backdated entries survive reopening and midnight', () => {
  expect(resolveEntryDate('2026-09-24', 'manual', new Date(2026, 9, 3))).toBe('2026-09-24');
});
test('subscription countdown uses calendar dates across daylight saving', () => {
  expect(calendarDaysUntil('2026-10-04', new Date(2026, 9, 4, 0, 5))).toBe(0);
  expect(calendarDaysUntil('2026-10-05', new Date(2026, 9, 4, 23, 55))).toBe(1);
  expect(calendarDaysUntil('2026-10-03', new Date(2026, 9, 4, 0, 5))).toBe(-1);
});
