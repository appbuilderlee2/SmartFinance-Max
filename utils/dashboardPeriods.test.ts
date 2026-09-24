import { expect, test } from 'vitest';
import { dashboardTrendPeriods } from './dashboardPeriods';

test('six-month trend keeps February and the previous year in order', () => {
  expect(dashboardTrendPeriods(2026, 1, 'month').map(({ year, month }) => `${year}-${month + 1}`))
    .toEqual(['2025-9', '2025-10', '2025-11', '2025-12', '2026-1', '2026-2']);
});

test('yearly trend includes every month once', () => {
  expect(dashboardTrendPeriods(2026, 8, 'year').map(({ month }) => month))
    .toEqual(Array.from({ length: 12 }, (_, index) => index));
});
