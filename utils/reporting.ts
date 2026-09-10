import { Currency, Transaction, TransactionType } from '../types';
import { parseDate, toLocalYMD } from './date';
import { sumMoney } from './money';
import { userTags } from './tags';
export interface ReportFilter { start: string; end: string; currency: Currency; note: string; tags: string[]; categories: string[]; min: string; max: string; }
export function selectReportRows(rows: Transaction[], filter: ReportFilter, fallback: Currency) {
  return rows.filter(tx => {
    const date = parseDate(tx.date);
    if (!date) return false;
    const day = toLocalYMD(date);
    return (tx.currency || fallback) === filter.currency && (!filter.start || day >= filter.start) && (!filter.end || day <= filter.end)
      && tx.note.toLocaleLowerCase().includes(filter.note.trim().toLocaleLowerCase())
      && (!filter.tags.length || filter.tags.some(tag => userTags(tx).includes(tag)))
      && (!filter.categories.length || filter.categories.includes(tx.categoryId))
      && (!filter.min || tx.amount >= Number(filter.min)) && (!filter.max || tx.amount <= Number(filter.max));
  });
}
export function monthRange(month: number) {
  const year = Math.floor(month / 12), index = month - year * 12;
  return { start: toLocalYMD(new Date(year, index, 1)), end: toLocalYMD(new Date(year, index + 1, 0)) };
}
export function reportTotals(rows: Transaction[], currency: Currency) {
  return { income: sumMoney(rows.filter(tx => tx.type === TransactionType.INCOME).map(tx => tx.amount), currency), expense: sumMoney(rows.filter(tx => tx.type === TransactionType.EXPENSE).map(tx => tx.amount), currency) };
}
