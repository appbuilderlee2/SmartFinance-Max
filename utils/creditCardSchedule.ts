// utils/creditCardSchedule.ts

import { toLocalYMD } from './date';

export type CreditCardCycle = {
  statementDay?: number;
  dueDay?: number;

  /**
   * If true, due date is interpreted as a date in the NEXT month
   * relative to the statement month.
   * Example: statement=Mar 19, due=Apr 14.
   */
  dueInNextMonth?: boolean;
};

function clampDayToMonth(year: number, month0: number, day: number): number {
  // month0: 0-11
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
}

export function getCycleDate(year: number, month0: number, day: number): string {
  const d = clampDayToMonth(year, month0, day);
  return toLocalYMD(new Date(year, month0, d));
}

/**
 * For a given statement month, return the statement and due dates (YYYY-MM-DD) if configured.
 * If day doesn't exist in month (e.g., 31), clamps to last day.
 *
 * If `dueInNextMonth=true`, dueDate is computed in (month0+1).
 */
export function getStatementAndDueForMonth(
  year: number,
  month0: number,
  cycle: CreditCardCycle
): { statementDate?: string; dueDate?: string } {
  const statementDate = (typeof cycle.statementDay === 'number' && cycle.statementDay >= 1)
    ? getCycleDate(year, month0, cycle.statementDay)
    : undefined;

  const dueMonth0 = cycle.dueInNextMonth ? (month0 + 1) : month0;
  const dueYear = cycle.dueInNextMonth ? new Date(year, dueMonth0, 1).getFullYear() : year;
  const dueMonthNorm0 = cycle.dueInNextMonth ? new Date(year, dueMonth0, 1).getMonth() : month0;

  const dueDate = (typeof cycle.dueDay === 'number' && cycle.dueDay >= 1)
    ? getCycleDate(dueYear, dueMonthNorm0, cycle.dueDay)
    : undefined;

  return { statementDate, dueDate };
}
