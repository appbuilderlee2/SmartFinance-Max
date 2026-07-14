// utils/creditCardCycles.ts

import { toLocalYMD } from './date';
import { getStatementAndDueForMonth } from './creditCardSchedule';

export type CreditCardCycle = {
  id: string; // cycle id
  cardId: string;
  year: number;
  month0: number; // 0-11
  yearMonth: string; // YYYY-MM

  statementDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD

  amountDue?: number;
  currency?: string;

  // entered after statement
  amountDueEnteredAt?: string;

  paidAt?: string; // ISO
  status: 'open' | 'closed';
};

export const CYCLES_KEY = 'smartfinance_creditcard_cycles';

export function ym(year: number, month0: number): string {
  const m = String(month0 + 1).padStart(2, '0');
  return `${year}-${m}`;
}

export function getCurrentYearMonth(now = new Date()): { year: number; month0: number; yearMonth: string } {
  const year = now.getFullYear();
  const month0 = now.getMonth();
  return { year, month0, yearMonth: ym(year, month0) };
}

export function getNextYearMonth(year: number, month0: number): { year: number; month0: number; yearMonth: string } {
  const d = new Date(year, month0 + 1, 1);
  return { year: d.getFullYear(), month0: d.getMonth(), yearMonth: ym(d.getFullYear(), d.getMonth()) };
}

export function computeCycleForMonth(card: any, year: number, month0: number): Pick<CreditCardCycle, 'statementDate'|'dueDate'> {
  return getStatementAndDueForMonth(year, month0, card);
}

export function makeCycleId(cardId: string, yearMonth: string): string {
  return `ccyc_${cardId}_${yearMonth}`;
}

export function createOpenCycle(card: any, year: number, month0: number): CreditCardCycle {
  const yearMonth = ym(year, month0);
  const { statementDate, dueDate } = computeCycleForMonth(card, year, month0);
  return {
    id: makeCycleId(card.id, yearMonth),
    cardId: card.id,
    year,
    month0,
    yearMonth,
    statementDate,
    dueDate,
    status: 'open',
  };
}

export function isTodayAfterOrEqual(ymd: string, now = new Date()): boolean {
  return ymd <= toLocalYMD(now);
}
